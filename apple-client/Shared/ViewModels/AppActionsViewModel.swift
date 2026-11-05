import Foundation
import Observation

/// Start, Stop and Restart, run the way the computer runs them (#402):
///
/// - A tap answers at once. The row says what it's doing ("Restarting…")
///   until Status is read again. A failure puts the row back and says why,
///   with Details for the command's output.
/// - Stop is confirmed first. Afterwards it offers Undo for 10 seconds.
/// - One change at a time, as on the computer: every button is disabled
///   while one runs.
/// - The owner authenticates for changes (`AppCoordinator.authorizeChange`).
///   A look-only device gets no buttons, only how to allow changes.
///
/// It belongs to the dashboard, so locking (which removes the dashboard)
/// drops every pending state and command output with it.
@MainActor
@Observable
final class AppActionsViewModel {
    struct Pending: Equatable {
        let action: AppAction
        /// Set when it failed. The row then says this, and the app is as before.
        var failure: String?
        /// The command's output, for Details.
        var log: [String] = []
    }

    struct UndoOffer: Equatable, Identifiable {
        let id = UUID()
        let app: AppStatus
        /// Set for Stop for a while.
        let until: StopChoice?
    }

    /// The command output shown in the Details sheet.
    struct Details: Identifiable {
        let id: AppStatus.ID
        let title: String
        let lines: [String]
    }

    private(set) var pending: [AppStatus.ID: Pending] = [:]
    private(set) var isBusy = false
    private(set) var undo: UndoOffer?
    /// A Stop or Roll back waiting for confirmation.
    struct Confirmation: Identifiable {
        let id = UUID()
        let action: AppAction
        let app: AppStatus
    }

    var confirmation: Confirmation?
    var details: Details?
    /// A setting being saved, as the person set it, shown until Status agrees.
    private(set) var settingOverrides: [String: Bool] = [:]
    private(set) var settingErrors: [AppStatus.ID: String] = [:]
    /// These go up by one per outcome, to trigger haptics.
    private(set) var successCount = 0
    private(set) var failureCount = 0

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let liveEvents: LiveEventManager
    @ObservationIgnored private let device: @MainActor () -> DeviceInfo?
    @ObservationIgnored private let authorize: @MainActor (String) async -> Bool
    @ObservationIgnored private var undoTask: Task<Void, Never>?

    static let undoFor: Duration = .seconds(10)

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

    // MARK: What to offer

    /// Whether this device may make changes. False until the computer says
    /// so (`/api/me`), so nothing shows before then.
    var canChange: Bool { device()?.canChange == true }

    func available(for app: AppStatus) -> [AppAction] {
        canChange ? AppAction.available(for: app) : []
    }

    /// For a look-only device, how to allow it changes. Nil when it already
    /// may, or when there's nothing to change on this app anyway.
    func lookOnlyHint(for app: AppStatus) -> String? {
        guard let device = device(), !device.canChange, !AppAction.available(for: app).isEmpty else { return nil }
        return "This device can only look. To let it start and stop apps, run this on the computer: homelab phone allow \(device.id)"
    }

    // MARK: Running

    /// From a button: Stop and Roll back ask for confirmation first, and the others run.
    func request(_ action: AppAction, on app: AppStatus) {
        if action.needsConfirmation {
            confirmation = Confirmation(action: action, app: app)
        } else {
            Task { await run(action, on: app) }
        }
    }

    /// Stop for a while: no confirmation, because choosing a time is
    /// deliberate (as on the computer).
    func stop(_ app: AppStatus, until choice: StopChoice) {
        Task { await run(.stop, on: app, until: choice) }
    }

    func confirm() {
        guard let pending = confirmation else { return }
        confirmation = nil
        Task { await run(pending.action, on: pending.app) }
    }

    /// Undo after a stop starts the app again. That's still a change, so
    /// it goes through authorization like any other.
    func performUndo() {
        guard let offer = undo else { return }
        dropUndo()
        let app = liveEvents.status?.apps.first { $0.id == offer.app.id } ?? offer.app
        Task { await run(.start, on: app, checkAvailability: false) }
    }

    func dropUndo() {
        undoTask?.cancel()
        undoTask = nil
        undo = nil
    }

    func showDetails(for app: AppStatus) {
        guard let p = pending[app.id], !p.log.isEmpty else { return }
        details = Details(id: app.id, title: "\(p.action.title) \(app.name)", lines: p.log)
    }

    func dismissFailure(for app: AppStatus) {
        if pending[app.id]?.failure != nil { pending[app.id] = nil }
    }

    func run(_ action: AppAction, on app: AppStatus, until: StopChoice? = nil, checkAvailability: Bool = true) async {
        guard !isBusy, canChange else { return }
        // The status may have changed since the button was drawn.
        if checkAvailability {
            let current = liveEvents.status?.apps.first { $0.id == app.id } ?? app
            guard AppAction.available(for: current).contains(action) else { return }
        }
        // Busy before the prompt, so a second tap can't open a second prompt.
        isBusy = true
        let reason = until.map { "Stop \(app.name) \($0.label.lowercased())." } ?? "\(action.title) \(app.name) on your homelab."
        guard await authorize(reason) else {
            isBusy = false
            return
        }

        pending[app.id] = Pending(action: action)
        do {
            let log = try await api.perform(action, appID: app.id, until: until)
            pending[app.id]?.log = log
            successCount += 1
            isBusy = false
            if action == .stop { offerUndo(for: app, until: until) }
            // Roll back's output says which version it went to: worth reading,
            // as on the computer, so it opens by itself.
            if action == .rollback, !log.isEmpty {
                details = Details(id: app.id, title: "\(action.pastTense) \(app.name)", lines: log)
            }
            // Wait for Status to show the result, then drop "Stopping…".
            await liveEvents.refreshNow()
            if pending[app.id]?.failure == nil { pending[app.id] = nil }
        } catch {
            let apiError = APIError.from(error)
            let message: String
            var log: [String] = []
            switch apiError {
            case .actionFailed(let text, let lines):
                message = text
                log = lines
            case .transport(.timedOut):
                // It may well still be running. A change isn't retried.
                message = "The computer is still working on it. The status will show the result when it's done."
            default:
                message = apiError.errorDescription ?? "It didn't work."
            }
            Log.ui.error("\(action.rawValue, privacy: .public) failed: \(apiError.logName, privacy: .public)")
            pending[app.id] = Pending(action: action, failure: message, log: log)
            failureCount += 1
            isBusy = false
            // A 401 here unpairs through the refresh, as anywhere else.
            await liveEvents.refreshNow()
        }
    }

    // MARK: Settings

    private static func key(_ setting: AppSetting, _ id: AppStatus.ID) -> String { "\(id)|\(setting.rawValue)" }

    /// The value to show: the one being saved, or Status's.
    func value(of setting: AppSetting, for app: AppStatus) -> Bool {
        settingOverrides[Self.key(setting, app.id)] ?? setting.isOn(for: app)
    }

    func isSaving(_ setting: AppSetting, for app: AppStatus) -> Bool {
        settingOverrides[Self.key(setting, app.id)] != nil
    }

    func set(_ setting: AppSetting, on: Bool, for app: AppStatus) async {
        guard !isBusy, canChange, AppSetting.available(for: app).contains(setting) else { return }
        isBusy = true
        guard await authorize(setting.reason(on: on, app: app)) else {
            isBusy = false
            return
        }
        let key = Self.key(setting, app.id)
        settingOverrides[key] = on
        settingErrors[app.id] = nil
        do {
            _ = try await api.setAppSetting(setting, on: on, appID: app.id)
            successCount += 1
            isBusy = false
            await liveEvents.refreshNow()
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("SetAppSetting failed: \(apiError.logName, privacy: .public)")
            settingErrors[app.id] = apiError.errorDescription
            failureCount += 1
            isBusy = false
        }
        // Status now says what it is (or the switch goes back, on failure).
        settingOverrides[key] = nil
    }

    private func offerUndo(for app: AppStatus, until: StopChoice?) {
        undoTask?.cancel()
        let offer = UndoOffer(app: app, until: until)
        undo = offer
        undoTask = Task { [weak self] in
            try? await Task.sleep(for: Self.undoFor)
            guard !Task.isCancelled, let self, self.undo?.id == offer.id else { return }
            self.undo = nil
        }
    }
}
