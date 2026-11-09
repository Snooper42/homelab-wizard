import Foundation
import Network
import Observation

/// Follows `/api/events` and keeps the newest `HomelabStatus` for the screens.
///
/// - The stream is read with `URLSession.bytes` in a detached task, off the
///   main actor, and parsed by the bounded `SSEParser`. Only decoded
///   changes come back to the main actor.
/// - A change that carries its own Status is applied directly. One without
///   it, or one marked `again`, causes a single coalesced `Status` call.
/// - It reconnects with capped exponential backoff and jitter, and fetches
///   Status after every reconnect, because changes during the gap were missed.
/// - A 401, or a missing credential, stops it and calls `onUnauthorized`.
///   It doesn't retry.
/// - `stop()` cancels everything. `clear()` also drops the data it holds,
///   so nothing about the homelab stays in memory while the app is locked.
@MainActor
@Observable
final class LiveEventManager {
    enum ConnectionState: Equatable {
        case idle
        case connecting
        case live
        case reconnecting(attempt: Int, at: Date)
        case stopped(String)

        /// What to tell the person while nothing has been read: nil while
        /// connecting, or after the first try.
        var problem: String? {
            switch self {
            case .reconnecting(let attempt, _) where attempt >= 2:
                "The computer isn't answering. Is it on, and is this device at home (or on Tailscale, if you use it)?"
            case .stopped(let reason):
                reason
            default:
                nil
            }
        }

        var label: String {
            switch self {
            case .idle: "Not connected"
            case .connecting: "Connecting…"
            case .live: "Live"
            case .reconnecting: "Reconnecting…"
            case .stopped(let reason): reason
            }
        }
    }

    private(set) var connection: ConnectionState = .idle
    private(set) var status: HomelabStatus?
    /// When `status` was read (by the agent, for `LastStatus`; now, otherwise).
    private(set) var statusReadAt: Date?
    /// The last refresh's error, shown until the next one succeeds.
    private(set) var refreshError: String?
    /// Whether the last refresh failed because nothing answered: not home,
    /// and not the tunnel either (Away mode, ADR-0023).
    private(set) var cannotReach = false
    private(set) var isRefreshing = false

    /// Called on the main actor when the computer no longer accepts this device.
    @ObservationIgnored var onUnauthorized: (@MainActor () -> Void)?

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private var streamTask: Task<Void, Never>?
    /// The wait before the next reconnect, cut short when the network comes back.
    @ObservationIgnored private var backoffWait: Task<Void, Never>?
    @ObservationIgnored private var pathMonitor: NWPathMonitor?
    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    @ObservationIgnored private var lastReadingTask: Task<Void, Never>?
    @ObservationIgnored private var refreshAgain = false

    init(api: APIClient) {
        self.api = api
    }

    // MARK: Lifecycle

    func start() {
        guard streamTask == nil else { return }
        Log.events.info("Following live events")
        if status == nil { loadLastReading() }
        watchNetwork()
        streamTask = Task { [weak self] in await self?.run() }
    }

    func stop() {
        streamTask?.cancel()
        streamTask = nil
        backoffWait?.cancel()
        backoffWait = nil
        pathMonitor?.cancel()
        pathMonitor = nil
        refreshTask?.cancel()
        refreshTask = nil
        lastReadingTask?.cancel()
        lastReadingTask = nil
        refreshAgain = false
        isRefreshing = false
        connection = .idle
    }

    /// Stops and forgets everything shown. Called when the app locks or unpairs.
    func clear() {
        stop()
        status = nil
        statusReadAt = nil
        refreshError = nil
        cannotReach = false
    }

    /// A Status read by some other call (StatusBoard), so it isn't read twice.
    func ingest(_ fresh: HomelabStatus) {
        guard streamTask != nil else { return } // stopped or locked: keep nothing
        status = fresh
        statusReadAt = Date()
        refreshError = nil
    }

    /// A fresh Status now (pull to refresh, ⌘R).
    func refreshNow() async {
        scheduleRefresh()
        await refreshTask?.value
    }

    // MARK: Stream

    private func run() async {
        var attempt = 0
        while !Task.isCancelled {
            connection = attempt == 0 ? .connecting : connection
            do {
                let (request, endpoint) = try await api.eventStreamRequest()
                let stream = Self.open(request, endpoint: endpoint, session: api.streamingSession)
                for try await item in stream {
                    switch item {
                    case .opened:
                        attempt = 0
                        connection = .live
                        Log.events.info("Live events connected")
                        scheduleRefresh() // whatever changed while not connected
                    case .heartbeat:
                        if connection != .live { connection = .live }
                    case .change(let change):
                        apply(change)
                    }
                }
                Log.events.info("The event stream ended; reconnecting")
            } catch is CancellationError {
                return
            } catch {
                let apiError = APIError.from(error)
                if Task.isCancelled { return }
                switch apiError {
                case .unauthorized, .notPaired:
                    Log.events.error("Live events refused: \(apiError.logName, privacy: .public)")
                    connection = .stopped(apiError.errorDescription ?? "Not paired")
                    streamTask = nil
                    onUnauthorized?()
                    return
                default:
                    Log.events.error("Live events dropped: \(apiError.logName, privacy: .public)")
                }
            }

            // A cancelled stream ends without throwing, so check again
            // before stop()'s `.idle` gets overwritten.
            if Task.isCancelled { return }
            attempt += 1
            let delay = Self.backoff(attempt: attempt)
            connection = .reconnecting(attempt: attempt, at: Date().addingTimeInterval(delay))
            // A wait of its own, so the network coming back can cut it short.
            let wait = Task { _ = try? await Task.sleep(for: .seconds(delay)) }
            backoffWait = wait
            await wait.value
            backoffWait = nil
            if Task.isCancelled { return }
        }
    }

    /// Reconnects at once when the network comes back (Wi-Fi to cellular,
    /// Tailscale up again) instead of waiting out the backoff. Nothing
    /// changes while the stream is live. A change of network also has the
    /// next read try home first again (away from home, ADR-0023).
    private func watchNetwork() {
        guard pathMonitor == nil else { return }
        let monitor = NWPathMonitor()
        // @Sendable on purpose: written in a main-actor method, the closure
        // would otherwise be main-actor isolated, and Swift 6 traps when the
        // monitor calls it on its own queue.
        monitor.pathUpdateHandler = { @Sendable [weak self] path in
            let kind = NetworkKind(path)
            // A strong let for the Task: a captured weak var can't cross into it.
            guard let self else { return }
            Task { @MainActor in self.networkUpdated(kind) }
        }
        monitor.start(queue: DispatchQueue(label: "homelab.live-events.path"))
        pathMonitor = monitor
    }

    /// The network as last seen. Kept while stopped, so a change while the
    /// app was locked still counts when it opens.
    @ObservationIgnored private var network: NetworkKind?

    private func networkUpdated(_ kind: NetworkKind) {
        if NetworkKind.isChange(from: network, to: kind) {
            let api = self.api
            Task { await api.networkChanged() }
        }
        network = kind
        if kind.reachable { networkCameBack() }
    }

    private func networkCameBack() {
        guard case .reconnecting = connection, let wait = backoffWait else { return }
        Log.events.info("The network is back; reconnecting now")
        wait.cancel()
    }

    private enum StreamItem: Sendable {
        case opened
        case heartbeat
        case change(EngineChange)
    }

    /// Opens the stream and parses it in a detached task, so reading bytes
    /// never runs on the main actor. Cancelling the consumer cancels the
    /// request.
    private nonisolated static func open(_ request: URLRequest, endpoint: ServerEndpoint, session: URLSession) -> AsyncThrowingStream<StreamItem, Error> {
        AsyncThrowingStream { continuation in
            let task = Task.detached(priority: .utility) {
                do {
                    let (bytes, response) = try await session.bytes(for: request)
                    try APIClient.check(response, from: endpoint, errorBody: nil)
                    let type = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type") ?? ""
                    guard type.lowercased().hasPrefix("text/event-stream") else {
                        throw APIError.invalidResponse
                    }
                    continuation.yield(.opened)

                    let decoder = JSONDecoder.homelab()
                    var parser = SSEParser()
                    for try await byte in bytes {
                        switch try parser.consume(byte) {
                        case nil:
                            continue
                        case .comment:
                            continuation.yield(.heartbeat)
                        case .event(let event):
                            do {
                                let change = try decoder.decode(EngineChange.self, from: Data(event.data.utf8))
                                continuation.yield(.change(change))
                            } catch {
                                // The payload is homelab data, so its size is the most that's logged.
                                Log.events.error("Skipped an event that couldn't be decoded (\(event.data.utf8.count, privacy: .public) bytes)")
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func apply(_ change: EngineChange) {
        Log.events.debug("Change: \(change.apps.count, privacy: .public) apps, runtime=\(change.runtime, privacy: .public), again=\(change.again, privacy: .public)")
        if let fresh = change.status {
            status = fresh
            statusReadAt = Date()
            refreshError = nil
        }
        if change.needsRefresh {
            scheduleRefresh()
        }
    }

    /// 1, 2, 4, 8, 16, then 30 seconds, plus up to a second of jitter, so
    /// several devices don't all reconnect at the same moment.
    nonisolated static func backoff(attempt: Int) -> Double {
        let base = min(30, pow(2, Double(max(0, attempt - 1))))
        return base + Double.random(in: 0..<1)
    }

    // MARK: Status

    /// Draws the agent's last reading at once, while the stream connects.
    private func loadLastReading() {
        lastReadingTask = Task { [weak self] in
            guard let self else { return }
            let reading = try? await api.lastStatus()
            // Locked or stopped meanwhile: drop it, don't put it back in memory.
            guard !Task.isCancelled, let reading, status == nil else { return }
            status = reading.status
            statusReadAt = reading.at
        }
    }

    /// Fetches Status. A request made while one is running causes exactly
    /// one more fetch after it, not one per request.
    private func scheduleRefresh() {
        if refreshTask != nil {
            refreshAgain = true
            return
        }
        refreshTask = Task { [weak self] in
            guard let self else { return }
            repeat {
                refreshAgain = false
                isRefreshing = true
                do {
                    let fresh = try await api.status()
                    try Task.checkCancellation()
                    status = fresh
                    statusReadAt = Date()
                    refreshError = nil
                    cannotReach = false
                } catch is CancellationError {
                    break
                } catch {
                    let apiError = APIError.from(error)
                    if apiError == .unauthorized || apiError == .notPaired {
                        isRefreshing = false
                        refreshTask = nil
                        onUnauthorized?()
                        return
                    }
                    refreshError = apiError.errorDescription
                    cannotReach = apiError.unreachable
                    Log.network.error("Status refresh failed: \(apiError.logName, privacy: .public)")
                }
            } while refreshAgain && !Task.isCancelled
            // A cancelled task leaves the state alone: stop() already reset
            // it, and a newer task may own refreshTask by now.
            guard !Task.isCancelled else { return }
            isRefreshing = false
            refreshTask = nil
        }
    }
}
