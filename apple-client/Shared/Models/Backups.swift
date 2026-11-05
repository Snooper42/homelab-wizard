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
        case destination, destinationOK, lastRun, envCopied, copies, stale, paused, restoreTest
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
    /// fresh, stale, none, or paused.
    let state: String
    let waitingFor: String?

    enum CodingKeys: String, CodingKey { case id, name, volume, newest, size, count, state, waitingFor }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? id
        volume = try c.decodeIfPresent(Bool.self, forKey: .volume) ?? false
        newest = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .newest))
        size = try c.decodeIfPresent(Int64.self, forKey: .size) ?? 0
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
        state = try c.decodeIfPresent(String.self, forKey: .state) ?? "none"
        waitingFor = try c.decodeIfPresent(String.self, forKey: .waitingFor)
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

    enum CodingKeys: String, CodingKey { case id, name, lastFinished, lastError, errorMessage, size, state, nextRun }

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
    }
}
