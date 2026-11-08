import Foundation
import Observation

/// Back up now, Test a restore, and Look for problems / Fix them (the
/// `Homelab` method). Each is a change: the device needs `canChange`, the
/// owner authenticates (`AppCoordinator.authorizeChange`), one runs at a
/// time, and none is retried.
///
/// Fix is two steps, as on the computer. The first run only looks, and
/// its plan is shown. Nothing changes until the person taps Fix These,
/// which runs `fix --apply`.
@MainActor
@Observable
final class HomelabTasksViewModel {
    struct Output: Identifiable {
        let id = UUID()
        let task: HomelabTask
        let title: String
        let lines: [String]
        let failed: Bool
        /// A fix plan that hasn't been applied yet.
        let isFixPreview: Bool
    }

    private(set) var running: HomelabTask?
    private(set) var errors: [HomelabTask: String] = [:]
    var output: Output?
    private(set) var successCount = 0
    private(set) var failureCount = 0

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let device: @MainActor () -> DeviceInfo?
    @ObservationIgnored private let authorize: @MainActor (String) async -> Bool
    @ObservationIgnored private let didFinish: @MainActor (HomelabTask) async -> Void

    init(
        api: APIClient,
        device: @escaping @MainActor () -> DeviceInfo?,
        authorize: @escaping @MainActor (String) async -> Bool,
        didFinish: @escaping @MainActor (HomelabTask) async -> Void
    ) {
        self.api = api
        self.device = device
        self.authorize = authorize
        self.didFinish = didFinish
    }

    var canRun: Bool { device()?.canChange == true }

    func start(_ task: HomelabTask, apply: Bool = false) {
        Task { await run(task, apply: apply) }
    }

    func run(_ task: HomelabTask, apply: Bool = false) async {
        guard running == nil, canRun else { return }
        running = task
        defer { running = nil }
        guard await authorize(task.reason(apply: apply)) else { return }
        errors[task] = nil
        // Applying the fixes replaces the plan sheet with what they did.
        if apply { output = nil }

        do {
            let lines = try await api.run(task, apply: apply)
            let preview = task == .fix && !apply
            output = Output(
                task: task,
                title: preview ? "What Fix Would Do" : Self.doneTitle(task, apply: apply),
                lines: lines.isEmpty ? ["Done. The computer printed nothing."] : lines,
                failed: false,
                isFixPreview: preview
            )
            successCount += 1
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Homelab \(task.rawValue, privacy: .public) failed: \(apiError.logName, privacy: .public)")
            failureCount += 1
            switch apiError {
            case .actionFailed(let message, let lines):
                output = Output(task: task, title: message, lines: lines, failed: true, isFixPreview: false)
            case .transport(.timedOut):
                errors[task] = "The computer is still working on it. Check again in a while."
            default:
                errors[task] = apiError.errorDescription
            }
        }
        await didFinish(task)
    }

    private static func doneTitle(_ task: HomelabTask, apply: Bool) -> String {
        switch task {
        case .backup: "Backed Up"
        case .restoreTest: "Restore Test"
        case .fix: "Fixed"
        }
    }
}
