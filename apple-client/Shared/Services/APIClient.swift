import Foundation

/// Talks to the companion (`homelab serve`, internal/companion/server.go).
///
/// The wire contract, as the server implements it:
///
/// | Endpoint                   | Auth   | Body / answer                                   |
/// |----------------------------|--------|-------------------------------------------------|
/// | `POST /api/pair`           | none   | `{code, name, kiosk}` → `{token, device}`       |
/// | `GET  /api/me`             | Bearer | → `{id, name, canChange, finances}`             |
/// | `POST /api/call/<Method>`  | Bearer | JSON array of args → `{result, log}` / `{error}`|
/// | `GET  /api/events`         | Bearer | `text/event-stream`, `data: <engine.Change>`    |
///
/// Status is the `Status` method. The cards (the engine's `/v1/cards`) are
/// the `StatusBoard` method, which answers in ndjson. The engine's own
/// `/v1/*` routes aren't reachable from a phone.
///
/// Security:
/// - The token is read from the Keychain for each request and isn't cached
///   here. Unpairing takes effect at once, and the token is in memory only
///   while a request is being built.
/// - The token goes only to the origin stored with it. Each request URL is
///   checked against that origin, and so is each response's final URL.
/// - Redirects are never followed (see `RedirectRefusal`). A redirect could
///   carry the Authorization header to another host.
/// - The sessions are ephemeral, with no cookies, cache or credential
///   storage, and TLS 1.2 at least. ATS stays fully on: no exceptions are
///   needed or wanted.
/// - Logs carry status codes and method names (`.public`), hosts and server
///   messages (`.private`), and never tokens, codes or bodies.
actor APIClient {
    /// The most this client reads from one REST answer.
    static let maxResponseBytes = 8 << 20

    private let keychain: any CredentialStore
    private let session: URLSession
    /// For `/api/events`. A request times out after 75 seconds without
    /// bytes (the companion sends a heartbeat every 30), so a dead
    /// connection is noticed without a separate watchdog.
    nonisolated let streamingSession: URLSession
    /// For changes. A start or restart can pull an image first, which takes
    /// minutes with no bytes in between. The computer gives a command up to
    /// 30 minutes.
    private let actionSession: URLSession

    init(keychain: any CredentialStore = KeychainManager()) {
        self.keychain = keychain
        let delegate = RedirectRefusal()
        session = URLSession(configuration: .hardened(idleTimeout: 30, resourceTimeout: 120), delegate: delegate, delegateQueue: nil)
        streamingSession = URLSession(configuration: .hardened(idleTimeout: 75, resourceTimeout: 60 * 60 * 24), delegate: delegate, delegateQueue: nil)
        actionSession = URLSession(configuration: .hardened(idleTimeout: 300, resourceTimeout: 30 * 60), delegate: delegate, delegateQueue: nil)
    }

    // MARK: Pairing

    /// Uses a pairing code. On success, the credential is in the Keychain
    /// before this returns.
    func pair(code: PairingCode, deviceName: String, at endpoint: ServerEndpoint) async throws -> DeviceInfo {
        var request = URLRequest(url: endpoint.url(path: "/api/pair"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let name = String(deviceName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(64))
        request.httpBody = try JSONEncoder().encode(PairRequest(code: code.value, name: name, kiosk: false))

        Log.security.info("Pairing with \(endpoint.displayName, privacy: .private(mask: .hash))")
        let data = try await send(request, to: endpoint)

        let reply: PairResponse
        do {
            reply = try JSONDecoder.homelab().decode(PairResponse.self, from: data)
        } catch {
            Log.network.error("The pairing answer couldn't be decoded")
            throw APIError.decoding
        }
        guard DeviceCredential.isWellFormed(token: reply.token) else {
            Log.security.error("The pairing answer's token had an unexpected shape; it was dropped")
            throw APIError.invalidResponse
        }

        let credential = DeviceCredential(
            endpoint: endpoint,
            token: reply.token,
            deviceID: reply.device.id,
            deviceName: reply.device.name,
            pairedAt: Date()
        )
        do {
            try keychain.saveCredential(credential)
        } catch {
            throw APIError.from(error)
        }
        Log.security.notice("Paired as device \(reply.device.id, privacy: .private(mask: .hash)); canChange=\(reply.device.canChange, privacy: .public)")
        return reply.device
    }

    /// Deletes this device's credential. The computer still lists the device
    /// until `homelab phone remove <id>` runs there, but the token is gone.
    func forgetDevice() throws {
        do {
            try keychain.deleteCredential()
        } catch {
            throw APIError.from(error)
        }
    }

    // MARK: REST

    func me() async throws -> DeviceInfo {
        let (request, endpoint) = try authorizedRequest(path: "/api/me")
        let data = try await send(request, to: endpoint)
        return try decode(DeviceInfo.self, from: data)
    }

    /// A fresh reading of every app (the `Status` method).
    func status() async throws -> HomelabStatus {
        try await call("Status", as: HomelabStatus.self)
    }

    /// The agent's last reading, which comes back at once. Nil before the
    /// first reading.
    func lastStatus() async throws -> StatusReading? {
        try await call("LastStatus", as: StatusReading?.self)
    }

    /// Calls one of the desktop app's methods that a phone may use (see
    /// `phoneMethods` in cmd/homelab/serve.go).
    func call<Value: Decodable & Sendable>(_ method: String, _ arguments: [JSONValue] = [], as type: Value.Type) async throws -> Value {
        let (request, endpoint) = try callRequest(method, arguments)
        let data = try await send(request, to: endpoint)
        do {
            return try JSONDecoder.homelab().decode(CallEnvelope<Value>.self, from: data).result
        } catch {
            Log.network.error("The \(method, privacy: .public) answer couldn't be decoded")
            throw APIError.decoding
        }
    }

    /// The app's last `lines` log lines (`homelab logs <id> --tail N`). The
    /// computer removes `.env`'s secrets and anything shaped like a password
    /// or token before sending, because every paired device may read logs.
    func logs(appID: String, lines: Int) async throws -> String {
        guard AppStatus.isValidID(appID) else { throw APIError.invalidAppID }
        let count = min(max(lines, 1), 5000)
        return try await call("Logs", [.string(appID), .number(Double(count))], as: String.self)
    }

    // MARK: The computer

    func host() async throws -> HostInfo {
        try await call("Host", as: HostInfo.self)
    }

    /// A diagnostics report. The computer removes every secret before
    /// sending it. Making one takes up to 3 minutes, so it goes on the
    /// long-timeout session. It's a read, not a change.
    func report() async throws -> DiagnosticsReport {
        let (request, endpoint) = try callRequest("Report", [])
        let data = try await send(request, to: endpoint, using: actionSession)
        do {
            return try JSONDecoder.homelab().decode(CallEnvelope<DiagnosticsReport>.self, from: data).result
        } catch {
            throw APIError.decoding
        }
    }

    /// Pauses or resumes the nightly image updates. This is a change.
    func setUpdatesPaused(_ paused: Bool) async throws -> UpdatesState {
        let (request, endpoint) = try callRequest("SetUpdatesPaused", [.bool(paused)])
        Log.network.notice("SetUpdatesPaused \(paused, privacy: .public)")
        let data = try await send(request, to: endpoint, using: actionSession)
        do {
            return try JSONDecoder.homelab().decode(CallEnvelope<UpdatesState>.self, from: data).result
        } catch {
            throw APIError.decoding
        }
    }

    /// Runs a whole-homelab job and returns what it printed. This is a
    /// change, and it's never retried.
    func run(_ task: HomelabTask, apply: Bool = false) async throws -> [String] {
        let (request, endpoint) = try callRequest("Homelab", [.string(task.rawValue), .string(""), .bool(apply)])
        Log.network.notice("Homelab \(task.rawValue, privacy: .public) apply=\(apply, privacy: .public)")
        let data = try await send(request, to: endpoint, using: actionSession)
        let envelope = try? JSONDecoder().decode(LogEnvelope.self, from: data)
        return APIError.sanitizeLog(envelope?.log)
    }

    // MARK: Finances

    /// The money card: the next payday, what's left after it, and the next
    /// bills. Any Finances level may read it (card, view or edit).
    func moneyCard() async throws -> MoneyCard {
        try await call("FinancesWall", as: MoneyCard.self)
    }

    /// The plan read forward: accounts today and the pay periods ahead,
    /// with the plan itself as raw JSON, so an edit can send it back whole.
    /// It needs the view or edit level.
    func financesPlan() async throws -> FinancesRead {
        let (request, endpoint) = try callRequest("Finances", [])
        return try Self.financesRead(from: try await send(request, to: endpoint))
    }

    /// Saves the plan, which must be the raw plan as read, edited, with its
    /// `rev`. The computer refuses it if another device saved since. It
    /// needs the edit level, and it's never retried.
    func saveFinances(_ plan: JSONValue) async throws -> FinancesRead {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        let body = try encoder.encode([plan])
        guard body.count <= 4 << 20 else { throw APIError.responseTooLarge } // the companion's MaxCall
        let (request, endpoint) = try authorizedRequest(path: "/api/call/SaveFinances", method: "POST", body: body)
        Log.network.notice("SaveFinances, \(body.count, privacy: .public) bytes")
        return try Self.financesRead(from: try await send(request, to: endpoint, using: actionSession))
    }

    private static func financesRead(from data: Data) throws -> FinancesRead {
        do {
            let decoder = JSONDecoder.homelab()
            let view = try decoder.decode(CallEnvelope<FinancesPlanView>.self, from: data).result
            let raw = try decoder.decode(CallEnvelope<RawFinancesView>.self, from: data).result
            return FinancesRead(view: view, rawPlan: raw.plan)
        } catch {
            Log.network.error("The Finances answer couldn't be decoded")
            throw APIError.decoding
        }
    }

    /// The transactions on record, with the ledger as raw JSON for an
    /// edit to send back whole. It needs the view or edit level.
    func financesLedger() async throws -> LedgerRead {
        let (request, endpoint) = try callRequest("FinancesLedger", [])
        return try Self.ledgerRead(from: try await send(request, to: endpoint))
    }

    /// Saves the ledger, which must be the raw ledger as read, edited, with
    /// its `rev`. It needs the edit level, and it's never retried.
    func saveFinancesLedger(_ ledger: JSONValue) async throws -> LedgerRead {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        let body = try encoder.encode([ledger])
        guard body.count <= 4 << 20 else { throw APIError.responseTooLarge }
        let (request, endpoint) = try authorizedRequest(path: "/api/call/SaveFinancesLedger", method: "POST", body: body)
        Log.network.notice("SaveFinancesLedger, \(body.count, privacy: .public) bytes")
        return try Self.ledgerRead(from: try await send(request, to: endpoint, using: actionSession))
    }

    /// A kept receipt, as a data URL. It needs the view or edit level.
    func receipt(named name: String) async throws -> String {
        guard ReceiptCodec.isValidName(name) else { throw APIError.invalidResponse }
        let (request, endpoint) = try callRequest("FinancesReceipt", [.string(name)])
        let data = try await send(request, to: endpoint, using: actionSession)
        do {
            return try JSONDecoder().decode(CallEnvelope<String>.self, from: data).result
        } catch {
            throw APIError.decoding
        }
    }

    /// Keeps a receipt (a data URL) and returns the name the computer gave
    /// it. It needs the edit level. The receipt is kept a day unless a
    /// saved transaction names it.
    func saveReceipt(dataURL: String) async throws -> String {
        let body = try JSONEncoder().encode([dataURL])
        guard body.count <= 4 << 20 else { throw APIError.responseTooLarge }
        let (request, endpoint) = try authorizedRequest(path: "/api/call/SaveFinancesReceipt", method: "POST", body: body)
        Log.network.notice("SaveFinancesReceipt, \(body.count, privacy: .public) bytes")
        let data = try await send(request, to: endpoint, using: actionSession)
        let name: String
        do {
            name = try JSONDecoder().decode(CallEnvelope<String>.self, from: data).result
        } catch {
            throw APIError.decoding
        }
        guard ReceiptCodec.isValidName(name) else { throw APIError.invalidResponse }
        return name
    }

    private static func ledgerRead(from data: Data) throws -> LedgerRead {
        do {
            let decoder = JSONDecoder.homelab()
            let ledger = try decoder.decode(CallEnvelope<FinanceLedger>.self, from: data).result
            let raw = try decoder.decode(CallEnvelope<JSONValue>.self, from: data).result
            return LedgerRead(ledger: ledger, raw: raw)
        } catch {
            Log.network.error("The ledger answer couldn't be decoded")
            throw APIError.decoding
        }
    }

    // MARK: Changes

    /// Starts, stops or restarts an app on the computer (the `AppAction`
    /// method). Returns what the command printed.
    ///
    /// - The device needs `canChange`. The computer checks that too, and
    ///   answers 403 otherwise.
    /// - The computer runs one change from a phone at a time. A second one
    ///   fails with its explanation.
    /// - This is never retried. A change isn't idempotent, and a timed-out
    ///   request may still be running on the computer.
    /// - A stop with `until` is Stop for a while (the `StopUntil` method).
    ///   The computer starts the app again by itself at that time.
    func perform(_ action: AppAction, appID: String, until: StopChoice? = nil) async throws -> [String] {
        guard AppStatus.isValidID(appID) else { throw APIError.invalidAppID }
        let built: (URLRequest, ServerEndpoint)
        if action == .stop, let until {
            built = try callRequest("StopUntil", [.string(appID), .string(until.untilArgument)])
        } else {
            built = try callRequest("AppAction", [.string(appID), .string(action.rawValue)])
        }
        let (request, endpoint) = built
        Log.network.notice("\(action.rawValue, privacy: .public)\(until == nil ? "" : " for a while", privacy: .public) on \(appID, privacy: .private(mask: .hash))")
        let data = try await send(request, to: endpoint, using: actionSession)
        let envelope = try? JSONDecoder().decode(LogEnvelope.self, from: data)
        return APIError.sanitizeLog(envelope?.log)
    }

    /// Changes one of an app's settings. This is a change.
    func setAppSetting(_ setting: AppSetting, on: Bool, appID: String) async throws -> [String] {
        guard AppStatus.isValidID(appID) else { throw APIError.invalidAppID }
        let (request, endpoint) = try callRequest("SetAppSetting", [.string(appID), .string(setting.rawValue), .bool(on)])
        Log.network.notice("SetAppSetting \(setting.rawValue, privacy: .public)=\(on, privacy: .public) on \(appID, privacy: .private(mask: .hash))")
        let data = try await send(request, to: endpoint, using: actionSession)
        let envelope = try? JSONDecoder().decode(LogEnvelope.self, from: data)
        return APIError.sanitizeLog(envelope?.log)
    }

    /// Status, then each card as it's read (the `StatusBoard` method, ndjson).
    /// `board` is the caller's number for this request. It comes back on
    /// every card.
    func statusBoard(board: Int, cards: [String]) throws -> AsyncThrowingStream<StatusBoardUpdate, Error> {
        let (request, endpoint) = try callRequest("StatusBoard", [.number(Double(board)), .array(cards.map { .string($0) })])
        let session = streamingSession
        return AsyncThrowingStream { continuation in
            let task = Task.detached(priority: .userInitiated) {
                do {
                    let (bytes, response) = try await session.bytes(for: request)
                    try Self.check(response, from: endpoint, errorBody: nil)
                    let decoder = JSONDecoder.homelab()
                    var lines = LineBuffer(maxLineBytes: Self.maxResponseBytes)
                    for try await byte in bytes {
                        guard let line = try lines.append(byte), !line.isEmpty else { continue }
                        let entry = try decoder.decode(BoardLine.self, from: Data(line))
                        if let message = entry.error {
                            throw APIError.server(status: 200, message: APIError.sanitize(message))
                        }
                        if let status = entry.result { continuation.yield(.status(status)) }
                        if let card = entry.card { continuation.yield(.card(card)) }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: APIError.from(error))
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: Events

    /// The request for `/api/events`, with the token attached. Use it with
    /// `streamingSession`, then pass the response to `check(_:from:errorBody:)`.
    func eventStreamRequest() throws -> (URLRequest, ServerEndpoint) {
        let (authorized, endpoint) = try authorizedRequest(path: "/api/events")
        var request = authorized
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 75
        return (request, endpoint)
    }

    // MARK: Request building

    private func authorizedRequest(path: String, method: String = "GET", body: Data? = nil) throws -> (URLRequest, ServerEndpoint) {
        let credential: DeviceCredential
        do {
            guard let stored = try keychain.loadCredential() else { throw APIError.notPaired }
            credential = stored
        } catch {
            throw APIError.from(error)
        }
        let url = credential.endpoint.url(path: path)
        guard credential.endpoint.owns(url) else { throw APIError.originMismatch }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        request.setValue("Bearer \(credential.token)", forHTTPHeaderField: "Authorization")
        return (request, credential.endpoint)
    }

    private func callRequest(_ method: String, _ arguments: [JSONValue]) throws -> (URLRequest, ServerEndpoint) {
        // Method names are Go identifiers. Anything else could change the path.
        guard !method.isEmpty, method.count <= 64,
              method.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.contains($0) && $0.isASCII })
        else {
            throw APIError.invalidMethodName
        }
        let body = try JSONEncoder().encode(arguments)
        return try authorizedRequest(path: "/api/call/\(method)", method: "POST", body: body)
    }

    // MARK: Sending

    private func send(_ request: URLRequest, to endpoint: ServerEndpoint, using override: URLSession? = nil) async throws -> Data {
        let path = request.url?.path ?? "?"
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await (override ?? session).data(for: request)
        } catch {
            let mapped = APIError.from(error)
            Log.network.error("\(request.httpMethod ?? "GET", privacy: .public) \(path, privacy: .public) failed: \(mapped.logName, privacy: .public)")
            throw mapped
        }
        guard data.count <= Self.maxResponseBytes else { throw APIError.responseTooLarge }
        try Self.check(response, from: endpoint, errorBody: data)
        Log.network.debug("\(request.httpMethod ?? "GET", privacy: .public) \(path, privacy: .public) ok, \(data.count, privacy: .public) bytes")
        return data
    }

    /// Checks an answer's origin and status. A non-2xx status becomes an
    /// `APIError`, with the server's `{"error": "..."}` message cleaned up.
    static func check(_ response: URLResponse, from endpoint: ServerEndpoint, errorBody: Data?) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard endpoint.owns(http.url) else {
            Log.network.fault("An answer came from an origin other than the one asked")
            throw APIError.originMismatch
        }
        let status = http.statusCode
        if (200..<300).contains(status) { return }

        let body = errorBody.flatMap { try? JSONDecoder().decode(ErrorBody.self, from: $0) }
        let clean = APIError.sanitize(body?.error)
        if let clean {
            Log.network.error("HTTP \(status, privacy: .public): \(clean, privacy: .private)")
        } else {
            Log.network.error("HTTP \(status, privacy: .public)")
        }
        switch status {
        case 300..<400: throw APIError.redirectRefused
        case 401: throw APIError.unauthorized
        case 403: throw APIError.forbidden(clean ?? "The computer refused.")
        case 429: throw APIError.rateLimited(clean ?? "Too many tries. Wait a few minutes.")
        case 500 where !(body?.log ?? []).isEmpty:
            // A command ran and failed. Its output explains why.
            throw APIError.actionFailed(message: clean ?? "It didn't work on the computer.", log: APIError.sanitizeLog(body?.log))
        default: throw APIError.server(status: status, message: clean)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder.homelab().decode(type, from: data)
        } catch {
            Log.network.error("An answer couldn't be decoded as \(String(describing: type), privacy: .public)")
            throw APIError.decoding
        }
    }
}

// MARK: - Wire shapes

private struct CallEnvelope<Value: Decodable>: Decodable {
    let result: Value
}

private struct ErrorBody: Decodable {
    let error: String?
    let log: [String]?
}

/// A Finances view with only its plan kept, as raw JSON.
private struct RawFinancesView: Decodable {
    let plan: JSONValue
}

/// The `log` of a call's answer. `result` is ignored (AppAction answers null).
private struct LogEnvelope: Decodable {
    let log: [String]?
}

/// One ndjson line of `StatusBoard`: `{"result": Status}`, `{"error": "..."}`,
/// or `{"event": "status:card", "data": Card}`.
private struct BoardLine: Decodable {
    let result: HomelabStatus?
    let error: String?
    let card: StatusCard?

    enum CodingKeys: String, CodingKey { case result, error, event, data }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        result = try c.decodeIfPresent(HomelabStatus.self, forKey: .result)
        error = try c.decodeIfPresent(String.self, forKey: .error)
        if try c.decodeIfPresent(String.self, forKey: .event) == "status:card" {
            card = try c.decodeIfPresent(StatusCard.self, forKey: .data)
        } else {
            card = nil
        }
    }
}

// MARK: - Session hardening

extension URLSessionConfiguration {
    /// Ephemeral, with nothing kept on disk, no cookies, no stored
    /// credentials, and TLS 1.2 at least.
    static func hardened(idleTimeout: TimeInterval, resourceTimeout: TimeInterval) -> URLSessionConfiguration {
        let config = URLSessionConfiguration.ephemeral
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.urlCredentialStorage = nil
        config.tlsMinimumSupportedProtocolVersion = .TLSv12
        config.timeoutIntervalForRequest = idleTimeout
        config.timeoutIntervalForResource = resourceTimeout
        config.waitsForConnectivity = false
        config.httpAdditionalHeaders = ["User-Agent": "HomelabClient"]
        return config
    }
}

/// Refuses every HTTP redirect. Foundation copies custom headers, including
/// Authorization, onto the redirected request, so following a 3xx could
/// send the token to another host. A refused redirect ends the task with
/// the 3xx response, and `APIClient.check` turns that into
/// `APIError.redirectRefused`.
final class RedirectRefusal: NSObject, URLSessionTaskDelegate, Sendable {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest
    ) async -> URLRequest? {
        Log.network.error("Refused an HTTP \(response.statusCode, privacy: .public) redirect")
        return nil
    }
}
