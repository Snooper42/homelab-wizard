import Foundation
import Observation

/// The computer itself: what it runs, the nightly updates, and the
/// diagnostics report.
@MainActor
@Observable
final class ComputerViewModel {
    private(set) var host: HostInfo?
    private(set) var hostError: String?
    private(set) var isSavingUpdates = false
    private(set) var updatesError: String?
    private(set) var isMakingReport = false
    private(set) var reportError: String?
    /// Kept only while its sheet is open.
    var report: DiagnosticsReport?

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let liveEvents: LiveEventManager
    @ObservationIgnored private let device: @MainActor () -> DeviceInfo?
    @ObservationIgnored private let authorize: @MainActor (String) async -> Bool
    /// The answer to a pause or resume, shown until Status catches up.
    private var updatesOverride: UpdatesState?

    init(
        api: APIClient,
        liveEvents: LiveEventManager,
        device: @escaping @MainActor () -> DeviceInfo?,
        authorize: @escaping @MainActor (String) async -> Bool
    ) {
        self.api = api
        self.liveEvents = liveEvents
        self.device = device
        self.authorize = authorize
    }

    var canChange: Bool { device()?.canChange == true }
    var updates: UpdatesState? { updatesOverride ?? liveEvents.status?.updates }

    func load() async {
        do {
            host = try await api.host()
            hostError = nil
        } catch {
            hostError = APIError.from(error).errorDescription
        }
    }

    func setNightlyUpdates(on: Bool) async {
        guard canChange, !isSavingUpdates else { return }
        isSavingUpdates = true
        defer { isSavingUpdates = false }
        guard await authorize(on ? "Resume nightly app updates." : "Pause nightly app updates.") else { return }
        do {
            updatesOverride = try await api.setUpdatesPaused(!on)
            updatesError = nil
            await liveEvents.refreshNow()
            if liveEvents.status?.updates == updatesOverride { updatesOverride = nil }
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("SetUpdatesPaused failed: \(apiError.logName, privacy: .public)")
            updatesError = apiError.errorDescription
        }
    }

    /// Asks the computer for a report. It's shown before anything is
    /// shared, so the person sees exactly what would leave the device.
    func makeReport() async {
        guard !isMakingReport else { return }
        isMakingReport = true
        defer { isMakingReport = false }
        do {
            report = try await api.report()
            reportError = nil
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Report failed: \(apiError.logName, privacy: .public)")
            reportError = apiError.errorDescription
        }
    }
}
