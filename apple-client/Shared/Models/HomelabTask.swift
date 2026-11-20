import Foundation

/// A whole-homelab job a phone may run (the `Homelab` method). Each one is
/// a change, so the device needs `canChange`. The computer runs one change
/// from a phone at a time.
enum HomelabTask: String, Sendable, CaseIterable, Identifiable {
    /// `homelab backup --apply`: the nightly backup, now.
    case backup
    /// `homelab restore-test --auto`: restore the newest backup somewhere
    /// apart and check it, which proves the backups work.
    case restoreTest = "restore-test"
    /// `homelab fix`: what's wrong and what would be done about it. With
    /// apply, `homelab fix --apply` does it.
    case fix
    /// `homelab update --all`: which apps have an update and which wait. With
    /// apply, `homelab update --all --apply` updates them, one at a time, and
    /// runs to the end on the computer even if the phone goes (the owner's
    /// yes, Nov 20, on the canvas's *Idea: Update all*).
    case updateAll = "update-all"

    var id: Self { self }

    /// It shows its plan first; nothing changes until its apply button.
    var previews: Bool { self == .fix || self == .updateAll }

    /// The plan's title, and the button under it that applies it.
    var previewTitle: String { self == .updateAll ? "What Would Be Updated" : "What Fix Would Do" }
    var applyTitle: String { self == .updateAll ? "Update Them" : "Fix These" }

    var title: String {
        switch self {
        case .backup: "Back Up Now"
        case .restoreTest: "Test a Restore"
        case .fix: "Look for Problems"
        case .updateAll: "Update All Apps"
        }
    }

    var progressTitle: String {
        switch self {
        case .backup: "Backing up…"
        case .restoreTest: "Testing a restore…"
        case .fix: "Looking for problems…"
        case .updateAll: "Working…"
        }
    }

    var systemImage: String {
        switch self {
        case .backup: "externaldrive.badge.plus"
        case .restoreTest: "arrow.counterclockwise.circle"
        case .fix: "wrench.and.screwdriver"
        case .updateAll: "arrow.down.circle"
        }
    }

    /// The reason the authentication prompt gives.
    func reason(apply: Bool) -> String {
        switch self {
        case .backup: "Back up your homelab now."
        case .restoreTest: "Test restoring your homelab's backup."
        case .fix: apply ? "Fix the problems found on your homelab." : "Look for problems on your homelab."
        case .updateAll: apply ? "Update every app that has an update." : "See which apps have an update."
        }
    }
}

/// The computer's own facts (`phoneHost`, the `Host` call).
struct HostInfo: Decodable, Sendable, Equatable {
    let os: String
    let machine: String
    let runtime: String
    let scheduler: String
    let supported: Bool
    let runtimeOK: Bool
    let version: String

    enum CodingKeys: String, CodingKey { case os, machine, runtime, scheduler, supported, runtimeOK, version }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        os = try c.decodeIfPresent(String.self, forKey: .os) ?? ""
        machine = try c.decodeIfPresent(String.self, forKey: .machine) ?? ""
        runtime = try c.decodeIfPresent(String.self, forKey: .runtime) ?? ""
        scheduler = try c.decodeIfPresent(String.self, forKey: .scheduler) ?? ""
        supported = try c.decodeIfPresent(Bool.self, forKey: .supported) ?? false
        runtimeOK = try c.decodeIfPresent(Bool.self, forKey: .runtimeOK) ?? false
        version = try c.decodeIfPresent(String.self, forKey: .version) ?? ""
    }
}

/// Whether nightly image updates run, and when (`updates.State`).
struct UpdatesState: Codable, Sendable, Equatable, Hashable {
    let paused: Bool
    /// For example, "daily at 04:00".
    let schedule: String

    enum CodingKeys: String, CodingKey { case paused, schedule }

    init(paused: Bool, schedule: String) {
        self.paused = paused
        self.schedule = schedule
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        paused = try c.decodeIfPresent(Bool.self, forKey: .paused) ?? false
        schedule = try c.decodeIfPresent(String.self, forKey: .schedule) ?? ""
    }
}

/// A diagnostics report with every secret removed by the computer (the
/// `Report` call), for sending to whoever helps with the homelab.
struct DiagnosticsReport: Decodable, Sendable, Identifiable {
    let text: String
    /// HELPER_EMAIL from the computer's settings, when set.
    let helper: String?

    var id: Int { text.hashValue }
}

/// What an app's last 200 log lines say, in plain words, from the Ollama
/// model the computer uses (the `ExplainLogs` call, as Explain these logs
/// on the computer). The log is redacted there and never leaves the homelab.
struct LogExplanation: Decodable, Sendable, Equatable {
    let text: String
    /// The model that wrote it, shown with it.
    let model: String
}

/// What a job that didn't finish says first: a title naming the job (not
/// "exit status 1"), then the computer's own warning (!) and failure (✗)
/// lines, in its words. For a backup whose only problems were apps skipped
/// (stopped, or outside the homelab), the rest was backed up, and it says so.
struct TaskOutcome: Equatable {
    let title: String
    let problems: [String]
    let lead: String?

    init(task: HomelabTask, message: String, lines: [String]) {
        let said = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let bare = said.isEmpty || said.range(of: #"^exit status \d+$"#, options: .regularExpression) != nil
        title = bare ? Self.failedTitle(task) : said
        problems = lines.compactMap { line in
            let t = line.trimmingCharacters(in: .whitespaces)
            guard let first = t.first, first == "!" || first == "✗" else { return nil }
            let rest = t.dropFirst().trimmingCharacters(in: .whitespaces)
            return rest.isEmpty ? nil : rest
        }
        if problems.isEmpty {
            lead = nil
        } else if task == .backup, problems.allSatisfy({ $0.contains("not backed up") }) {
            lead = problems.count == 1 ? "Everything else was backed up. This wasn't:" : "Everything else was backed up. These weren't:"
        } else {
            lead = problems.count == 1 ? "This went wrong:" : "These went wrong:"
        }
    }

    static func failedTitle(_ task: HomelabTask) -> String {
        switch task {
        case .backup: "Backup Didn't Finish"
        case .restoreTest: "The Restore Test Didn't Finish"
        case .fix: "Look for Problems Didn't Finish"
        case .updateAll: "Update All Didn't Finish"
        }
    }
}

