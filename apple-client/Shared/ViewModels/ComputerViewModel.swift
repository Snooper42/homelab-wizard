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

    // The Settings form (main #491).
    private(set) var form: HomelabSettingsForm?
    private(set) var formError: String?
    /// The computer's Homelab Wizard is older than Settings on a phone: it
    /// answers that it doesn't serve them.
    private(set) var formNotServed = false
    private(set) var isLoadingForm = false
    private(set) var isSavingForm = false
    private(set) var formSaveError: String?
    /// Goes up with each save, for the haptic.
    private(set) var formSavedCount = 0

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

    // Setup's checklist (the owner's yes, Nov 19).
    private(set) var setupSteps: [SetupStepInfo]?
    private(set) var setupError: String?
    /// The step being done for the person now.
    private(set) var doingSetupStep: String?

    /// The checklist shows on the owner's phone, from a computer that answers it.
    var canSeeSetup: Bool {
        guard let device = device(), !device.isMember else { return false }
        return device.computer?.answers("Setup") ?? false
    }

    var canDoSetup: Bool { canChange && (device()?.computer?.answers("RunSetupStep") ?? false) }

    func loadSetup() async {
        guard canSeeSetup, doingSetupStep == nil else { return }
        do {
            setupSteps = try await api.setupSteps()
            setupError = nil
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Setup failed: \(apiError.logName, privacy: .public)")
            setupError = apiError.errorDescription
        }
    }

    /// Does each step the phone may, in turn, after one Face ID, re-reading
    /// the checklist after each, until none is left or one fails.
    func doSetupForYou() async {
        guard canDoSetup, doingSetupStep == nil, let steps = setupSteps else { return }
        let ready = SetupChecklist.forYou(steps)
        guard !ready.isEmpty else { return }
        guard await authorize(ready.count == 1 ? "\(ready[0].title)." : "Do \(ready.count) setup steps.") else { return }
        setupError = nil
        defer { doingSetupStep = nil }
        var tried = Set<String>()
        while let next = SetupChecklist.forYou(setupSteps ?? []).first(where: { !tried.contains($0.id) }) {
            tried.insert(next.id)
            doingSetupStep = next.title
            do {
                setupSteps = try await api.runSetupStep(next.id)
            } catch {
                let apiError = APIError.from(error)
                Log.ui.error("RunSetupStep failed: \(apiError.logName, privacy: .public)")
                setupError = "\(next.title): \(apiError.errorDescription ?? "it didn't work.")"
                return
            }
        }
    }

    // Settings › Phones (the owner's yes, Nov 19).
    private(set) var phones: [PairedPhone]?
    private(set) var phonesError: String?
    private(set) var isChangingPhone = false

    /// The other phones are listed on the owner's own phone that can make
    /// changes, from a computer that answers it; never on a member's.
    var canListPhones: Bool {
        guard let device = device(), device.canChange, !device.isMember else { return false }
        return device.computer?.answers("Phones") ?? false
    }

    func loadPhones() async {
        guard canListPhones else { return }
        do {
            phones = try await api.phones()
            phonesError = nil
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Phones failed: \(apiError.logName, privacy: .public)")
            phonesError = apiError.errorDescription
        }
    }

    /// Gives `phone` less, after Face ID. Returns whether it was done.
    func lower(_ phone: PairedPhone, _ what: PhoneLowering) async -> Bool {
        guard canListPhones, !isChangingPhone, PhoneLowering.offered(for: phone).contains(what) else { return false }
        isChangingPhone = true
        defer { isChangingPhone = false }
        guard await authorize("\(what.title): \(phone.name).") else { return false }
        do {
            phones = try await api.lowerPhone(phone.id, what)
            phonesError = nil
            return true
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("LowerPhone failed: \(apiError.logName, privacy: .public)")
            phonesError = apiError.errorDescription
            return false
        }
    }

    /// Reads the Settings form again.
    func loadForm() async {
        guard !isLoadingForm else { return }
        isLoadingForm = true
        defer { isLoadingForm = false }
        do {
            form = try await api.settingsForm()
            formError = nil
            formNotServed = false
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Settings failed: \(apiError.logName, privacy: .public)")
            if case .server(status: 404, _) = apiError {
                formNotServed = true
                formError = nil
            } else {
                formError = apiError.errorDescription
            }
        }
    }

    /// Saves the everyday settings changed, after the owner authenticates;
    /// never retried. The computer's answer is the form as it is now.
    /// Returns whether it saved.
    func saveForm(_ changes: [String: String]) async -> Bool {
        guard canChange, !isSavingForm, !changes.isEmpty, let form else { return false }
        // Only what this phone may change, whatever was typed.
        let mine = Set(form.settings.filter(form.phoneMayChange).map(\.key))
        guard changes.keys.allSatisfy(mine.contains) else {
            formSaveError = "Passwords, tokens and the settings this device connects through are changed on the computer."
            return false
        }
        isSavingForm = true
        defer { isSavingForm = false }
        guard await authorize(changes.count == 1 ? "Change a homelab setting." : "Change \(changes.count) homelab settings.") else { return false }
        do {
            self.form = try await api.saveSettings(changes)
            formSaveError = nil
            formSavedCount += 1
            return true
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("SaveSettings failed: \(apiError.logName, privacy: .public)")
            formSaveError = apiError.errorDescription
            return false
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
