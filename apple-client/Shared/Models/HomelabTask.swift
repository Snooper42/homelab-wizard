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

    var id: Self { self }

    var title: String {
        switch self {
        case .backup: "Back Up Now"
        case .restoreTest: "Test a Restore"
        case .fix: "Look for Problems"
        }
    }

    var progressTitle: String {
        switch self {
        case .backup: "Backing up…"
        case .restoreTest: "Testing a restore…"
        case .fix: "Looking for problems…"
        }
    }

    var systemImage: String {
        switch self {
        case .backup: "externaldrive.badge.plus"
        case .restoreTest: "arrow.counterclockwise.circle"
        case .fix: "wrench.and.screwdriver"
        }
    }

    /// The reason the authentication prompt gives.
    func reason(apply: Bool) -> String {
        switch self {
        case .backup: "Back up your homelab now."
        case .restoreTest: "Test restoring your homelab's backup."
        case .fix: apply ? "Fix the problems found on your homelab." : "Look for problems on your homelab."
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
