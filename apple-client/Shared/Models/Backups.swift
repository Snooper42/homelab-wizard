import Foundation

/// The backups' state, from the files the nightly job leaves and the
/// restore-test log (`backup.Overview`, the `Backups` call).
struct BackupOverview: Decodable, Sendable, Equatable {
    let destination: String
    /// A folder other than the local default. Otherwise the backups sit on
    /// the same disk as the data.
    let destinationOK: Bool
    let lastRun: Date?
    let envCopied: Date?
    let copies: [BackupCopy]
    let stale: Int
    /// Copies less than half the night before's (main #435).
    let shrank: Int
    /// Not fresh, while their apps wait for a drive.
    let paused: Int
    let restoreTest: RestoreLog
    /// No restore test in the last 30 days.
    let restoreDue: Bool
    let staleAfterHours: Int
    let vaultExport: Date?
    let vaultDue: Bool
    /// Unencrypted vault exports that should be deleted.
    let plainExports: [String]
    /// The second engine's line, when Kopia is installed.
    let kopia: BackupEngine?

    enum CodingKeys: String, CodingKey {
        case destination, destinationOK, lastRun, envCopied, copies, stale, shrank, paused, restoreTest
        case restoreDue, staleAfterHours, vaultExport, vaultDue, plainExports, kopia
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        destination = try c.decodeIfPresent(String.self, forKey: .destination) ?? ""
        destinationOK = try c.decodeIfPresent(Bool.self, forKey: .destinationOK) ?? false
        lastRun = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastRun))
        envCopied = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .envCopied))
        copies = try c.decodeIfPresent([BackupCopy].self, forKey: .copies) ?? []
        stale = try c.decodeIfPresent(Int.self, forKey: .stale) ?? 0
        shrank = max(0, try c.decodeIfPresent(Int.self, forKey: .shrank) ?? 0)
        paused = try c.decodeIfPresent(Int.self, forKey: .paused) ?? 0
        restoreTest = try c.decodeIfPresent(RestoreLog.self, forKey: .restoreTest) ?? RestoreLog()
        restoreDue = try c.decodeIfPresent(Bool.self, forKey: .restoreDue) ?? false
        staleAfterHours = try c.decodeIfPresent(Int.self, forKey: .staleAfterHours) ?? 0
        vaultExport = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .vaultExport))
        vaultDue = try c.decodeIfPresent(Bool.self, forKey: .vaultDue) ?? false
        plainExports = try c.decodeIfPresent([String].self, forKey: .plainExports) ?? []
        kopia = try c.decodeIfPresent(BackupEngine.self, forKey: .kopia)
    }
}

extension BackupOverview {
    /// The copies in groups, as the computer's Backups screen shows them
    /// (`copyGroups` in web/src/backups/Backups.tsx): stale, up to date,
    /// paused, not copied yet. Empty groups are left out.
    struct CopyGroup: Identifiable, Equatable, Sendable {
        let state: String
        let title: String
        let copies: [BackupCopy]
        /// For paused and not-yet-copied ones: who waits for what, or when.
        let note: String?
        var id: String { state }
    }

    var copyGroups: [CopyGroup] {
        func of(_ state: String) -> [BackupCopy] { copies.filter { $0.state == state } }
        let paused = of("paused"), none = of("none")
        let drives = Array(Set(paused.compactMap { $0.waitingFor }.filter { !$0.isEmpty }.map(AppStatus.driveName))).sorted()
        let pausedNote = paused.isEmpty ? nil
            : "\(paused.map(\.name).joined(separator: ", ")) \(paused.count == 1 ? "waits" : "wait") for \(drives.isEmpty ? "a drive" : drives.joined(separator: " and ")); \(paused.count == 1 ? "its last copy is" : "their last copies are") kept."
        let groups = [
            CopyGroup(state: "stale", title: "Stale", copies: of("stale"), note: nil),
            CopyGroup(state: "fresh", title: "Up to Date", copies: of("fresh"), note: nil),
            CopyGroup(state: "paused", title: "Paused", copies: paused, note: pausedNote),
            CopyGroup(state: "none", title: "Not Copied Yet", copies: none, note: none.isEmpty ? nil : "\(none.map(\.name).joined(separator: ", ")), tonight."),
        ]
        return groups.filter { !$0.copies.isEmpty }
    }

    /// "5 of 6": fresh copies of all but the paused ones, as the computer's tile.
    var upToDate: (fresh: Int, of: Int) {
        (copies.filter { $0.state == "fresh" }.count, copies.filter { $0.state != "paused" }.count)
    }

    /// The password vault export, as the computer's line says it
    /// (`Vault` in web/src/backups/Backups.tsx): a plain export lying
    /// around comes first, then never made, then due, then fine.
    enum VaultState: Equatable, Sendable {
        case plainExportLyingAround
        case neverMade
        case due(Date)
        case fine(Date)
    }

    var vaultState: VaultState {
        if !plainExports.isEmpty { return .plainExportLyingAround }
        guard let exported = vaultExport else { return .neverMade }
        return vaultDue ? .due(exported) : .fine(exported)
    }

    /// This app's copy, by its id.
    func copy(for appID: String) -> BackupCopy? { copies.first { $0.id == appID } }

    /// The nightly backup hasn't run within its window (`staleAfterHours`,
    /// 30 when the computer doesn't say), as the app page's Last backup
    /// tile warns. False before any run: that reads as "Not yet".
    func isLate(now: Date = Date()) -> Bool {
        guard let lastRun else { return false }
        let hours = staleAfterHours > 0 ? staleAfterHours : 30
        return now.timeIntervalSince(lastRun) > Double(hours) * 3600
    }
}

/// One app's copy in the nightly backup (`backup.Copy`).
struct BackupCopy: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    /// A Docker volume, not a folder.
    let volume: Bool
    let newest: Date?
    /// In bytes.
    let size: Int64
    let count: Int
    /// The copy before the newest (the night before's), in bytes; 0 with only one.
    let before: Int64
    /// The newest is less than half of `before`: the app may have lost its data.
    let shrank: Bool
    /// fresh, stale, none, or paused.
    let state: String
    let waitingFor: String?

    enum CodingKeys: String, CodingKey { case id, name, volume, newest, size, count, before, shrank, state, waitingFor }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? id
        volume = try c.decodeIfPresent(Bool.self, forKey: .volume) ?? false
        newest = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .newest))
        size = try c.decodeIfPresent(Int64.self, forKey: .size) ?? 0
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
        before = max(0, try c.decodeIfPresent(Int64.self, forKey: .before) ?? 0)
        shrank = try c.decodeIfPresent(Bool.self, forKey: .shrank) ?? false
        state = try c.decodeIfPresent(String.self, forKey: .state) ?? "none"
        waitingFor = try c.decodeIfPresent(String.self, forKey: .waitingFor)
    }
}

extension BackupCopy {
    /// Its size moved by a tenth or more since the night before's, so both
    /// are worth showing (`changed` in web/src/backups/Backups.tsx).
    var sizeChanged: Bool {
        before > 0 && abs(size - before) >= before / 10
    }
}

/// The restore tests on record (`backup.RestoreLog`), the parts the phone shows.
struct RestoreLog: Decodable, Sendable, Equatable {
    var lastTest: Date?
    var lastSummary: String?

    enum CodingKeys: String, CodingKey { case lastTest, lastSummary }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lastTest = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastTest))
        lastSummary = try c.decodeIfPresent(String.self, forKey: .lastSummary)
    }
}

/// A second backup engine's line (`backup.Engine`): Kopia.
struct BackupEngine: Decodable, Sendable, Equatable {
    let repository: String
    let lastTest: Date?
    /// The newest test's summary, when that one failed.
    let failed: String?
    let due: Bool

    enum CodingKeys: String, CodingKey { case repository, lastTest, failed, due }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        repository = try c.decodeIfPresent(String.self, forKey: .repository) ?? ""
        lastTest = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastTest))
        failed = try c.decodeIfPresent(String.self, forKey: .failed)
        due = try c.decodeIfPresent(Bool.self, forKey: .due) ?? false
    }
}

/// One Duplicati job (`duplicati.Job`, the `DuplicatiJobs` call).
struct DuplicatiJob: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let lastFinished: Date?
    let lastError: Date?
    let errorMessage: String?
    /// What it holds at the destination, for example "12.3 GB".
    let size: String?
    /// ok, failed, stale, or never.
    let state: String
    /// Nil when it isn't scheduled.
    let nextRun: Date?
    /// What its last run was (main #418): how long it took, in seconds (0
    /// when Duplicati didn't say), what it holds of yours ("48.2 GB") and
    /// in how many files, how many versions it keeps, and the folders it copies.
    let took: Int
    let holds: String?
    let files: Int
    let versions: Int
    let sources: [String]

    enum CodingKeys: String, CodingKey {
        case id, name, lastFinished, lastError, errorMessage, size, state, nextRun
        case took, holds, files, versions, sources
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? id
        lastFinished = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastFinished))
        lastError = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastError))
        errorMessage = try c.decodeIfPresent(String.self, forKey: .errorMessage)
        size = try c.decodeIfPresent(String.self, forKey: .size)
        state = try c.decodeIfPresent(String.self, forKey: .state) ?? "never"
        nextRun = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .nextRun))
        took = max(0, try c.decodeIfPresent(Int.self, forKey: .took) ?? 0)
        holds = try c.decodeIfPresent(String.self, forKey: .holds)
        files = max(0, try c.decodeIfPresent(Int.self, forKey: .files) ?? 0)
        versions = max(0, try c.decodeIfPresent(Int.self, forKey: .versions) ?? 0)
        sources = try c.decodeIfPresent([String].self, forKey: .sources) ?? []
    }

    /// "Took 4 min · 48.2 GB in 4,210 files · keeps 12 versions", or nil with nothing to say.
    var lastRunSummary: String? {
        var parts: [String] = []
        if took > 0 {
            parts.append("Took " + Duration.seconds(took).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .abbreviated, maximumUnitCount: 2)))
        }
        if let holds, !holds.isEmpty {
            parts.append(files > 0 ? "\(holds) in \(files.formatted()) files" : holds)
        } else if files > 0 {
            parts.append("\(files.formatted()) files")
        }
        if versions > 0 { parts.append(versions == 1 ? "keeps 1 version" : "keeps \(versions) versions") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
