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

    /// Where the backups go, in words, as `placeName` in
    /// web/src/backups/Backups.tsx: "Proton Drive", "the Backup drive", or
    /// else its last folder.
    static func placeName(_ destination: String) -> String {
        let clouds: [(String, String)] = [("protondrive", "Proton Drive"), ("onedrive", "OneDrive"), ("googledrive", "Google Drive"),
                                         ("google drive", "Google Drive"), ("dropbox", "Dropbox"), ("icloud", "iCloud Drive"),
                                         ("mobile documents", "iCloud Drive"), ("pcloud", "pCloud")]
        let lower = destination.lowercased()
        if let cloud = clouds.first(where: { lower.contains($0.0) }) { return cloud.1 }
        let parts = destination.split(whereSeparator: { $0 == "/" || $0 == "\\" }).map(String.init)
        if destination.hasPrefix("/") {
            // A `where` binds only the pattern it follows, so each case has its own.
            switch parts.first ?? "" {
            case "Volumes" where parts.count >= 2: return "the \(parts[1]) drive"
            case "mnt" where parts.count >= 2: return "the \(parts[1]) drive"
            case "media" where parts.count >= 3: return "the \(parts[2]) drive"
            case "run" where parts.count >= 4 && parts[1] == "media": return "the \(parts[3]) drive"
            default: break
            }
        } else if destination.count >= 2, destination.dropFirst().first == ":", let letter = destination.first, letter.isLetter {
            return "the \(letter) drive"
        }
        return parts.last ?? destination
    }

    // MARK: Backups as the owner picked it (Nov 12)

    /// The copies that need a look first: out of date, or less than half
    /// the night before's.
    var needingALook: [BackupCopy] { copies.filter { $0.shrank || $0.state == "stale" } }

    /// Up to date and whole: folded to a row of logos until opened.
    var freshCopies: [BackupCopy] { copies.filter { $0.state == "fresh" && !$0.shrank } }

    /// Paused and not copied yet, each with its note (copyGroups').
    var waitingGroups: [CopyGroup] { copyGroups.filter { $0.state == "paused" || $0.state == "none" } }

    /// One of the three tiles under the top card: the restore test, the
    /// password export, and the second copy (Kopia), or the settings file
    /// where there's no Kopia. Each says how it is in a word or two.
    struct Tile: Equatable, Sendable, Identifiable {
        enum Kind: String, Sendable { case restore, vault, second, settingsFile }
        enum Tone: Sendable { case good, warn, bad }
        let kind: Kind
        let title: String
        let value: String
        let detail: String?
        let tone: Tone
        var id: String { kind.rawValue }
    }

    func tiles(now: Date = Date()) -> [Tile] {
        let words = RelativeDateTimeFormatter()
        words.dateTimeStyle = .named
        words.unitsStyle = .full
        func ago(_ date: Date) -> String { words.localizedString(for: date, relativeTo: now) }

        let restore: Tile = if let failed = restoreTest.failedSince {
            Tile(kind: .restore, title: "Restore test", value: "Failed", detail: ago(failed.when), tone: .bad)
        } else if restoreDue {
            Tile(kind: .restore, title: "Restore test", value: "Due", detail: restoreTest.lastTest.map { "Last \(ago($0))" } ?? "None yet", tone: .warn)
        } else if let tested = restoreTest.lastTest {
            Tile(kind: .restore, title: "Restore test", value: "Passed", detail: ago(tested), tone: .good)
        } else {
            Tile(kind: .restore, title: "Restore test", value: "None yet", detail: nil, tone: .warn)
        }

        let vault: Tile = switch vaultState {
        case .plainExportLyingAround:
            Tile(kind: .vault, title: "Passwords", value: "Delete exports", detail: plainExports.count == 1 ? "1 unencrypted" : "\(plainExports.count) unencrypted", tone: .bad)
        case .neverMade:
            Tile(kind: .vault, title: "Passwords", value: "Never exported", detail: "Once a month", tone: .warn)
        case .due(let exported):
            Tile(kind: .vault, title: "Passwords", value: "Export due", detail: "Last \(ago(exported))", tone: .warn)
        case .fine(let exported):
            Tile(kind: .vault, title: "Passwords", value: "Exported", detail: ago(exported), tone: .good)
        }

        let third: Tile = if let kopia {
            if let failed = kopia.failed, !failed.isEmpty {
                Tile(kind: .second, title: "Second copy", value: "Test failed", detail: "Kopia", tone: .bad)
            } else if kopia.due {
                Tile(kind: .second, title: "Second copy", value: "Test due", detail: "Kopia", tone: .warn)
            } else {
                Tile(kind: .second, title: "Second copy", value: "Kopia", detail: kopia.lastTest.map { "Tested \(ago($0))" }, tone: .good)
            }
        } else if let copied = envCopied {
            Tile(kind: .settingsFile, title: "Settings file", value: "Copied", detail: ago(copied), tone: .good)
        } else {
            Tile(kind: .settingsFile, title: "Settings file", value: "Not copied", detail: nil, tone: .warn)
        }
        return [restore, vault, third]
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
    /// The catalog app it's a copy of, when the computer knows (main #474).
    let app: String?

    enum CodingKeys: String, CodingKey { case id, name, volume, newest, size, count, before, shrank, state, waitingFor, app }

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
        app = try c.decodeIfPresent(String.self, forKey: .app)
    }

    /// Why a stale copy is stale, from its app's state, and what helps, in
    /// the computer's words (`staleWhy`, main #474). Nil when that isn't
    /// known: not stale, no app, or Status not read yet (`apps` nil).
    func staleWhy(apps: [AppStatus]?) -> String? {
        guard state == "stale", let apps, let id = app, !id.isEmpty else { return nil }
        guard let app = apps.first(where: { $0.id == id }) else {
            return "It isn't installed any more: its last copies are kept."
        }
        if app.state == "stopped" {
            return "It's stopped, so the nightly copy skips it. Start it, and tonight's copy catches up."
        }
        if app.state != "running" { return "It isn't running, so the nightly copy skips it." }
        return "Last night's copy didn't come. Back up now tries again; if it fails, the backup's log says why."
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
    /// The restore drills on record, oldest first (`backup.RestoreRun`).
    var history: [RestoreRun] = []

    enum CodingKeys: String, CodingKey { case lastTest, lastSummary, history }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lastTest = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastTest))
        lastSummary = try c.decodeIfPresent(String.self, forKey: .lastSummary)
        // A drill that doesn't read costs only the record, not the backups screen.
        history = ((try? c.decodeIfPresent([RestoreRun].self, forKey: .history)) ?? nil) ?? []
    }

    /// The newest drill, when it failed: what the restore tile leads with.
    var failedSince: RestoreRun? {
        guard let newest = history.last, !newest.passed else { return nil }
        return newest
    }

    /// How long the newest passing drill that was timed took, in seconds.
    var lastPassTook: Int? {
        history.reversed().first { $0.passed && $0.seconds > 0 }?.seconds
    }

    /// The last six drills, newest first, as the tile lists them on hover.
    var recentDrills: [RestoreRun] { Array(history.suffix(6).reversed()) }
}

/// One restore drill (`backup.RestoreRun`).
struct RestoreRun: Decodable, Sendable, Equatable {
    let when: Date
    let seconds: Int
    let passed: Bool
    let summary: String
    /// "" for Duplicati, "kopia" for the second engine.
    let engine: String

    enum CodingKeys: String, CodingKey { case when, seconds, passed, summary, engine }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        when = try c.decode(Date.self, forKey: .when)
        seconds = max(0, try c.decodeIfPresent(Int.self, forKey: .seconds) ?? 0)
        passed = try c.decodeIfPresent(Bool.self, forKey: .passed) ?? false
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        engine = try c.decodeIfPresent(String.self, forKey: .engine) ?? ""
    }

    /// "4 min", "45 sec".
    static func took(_ seconds: Int) -> String {
        Duration.seconds(seconds).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .abbreviated, maximumUnitCount: 2))
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

/// Duplicati's jobs at a glance, in the computer's words
/// (`Jobs` and `jobsProblem` in web/src/backups/Backups.tsx).
enum DuplicatiWords {
    /// Why the jobs couldn't be read, in words, not Go's "dial tcp …".
    static func problem(_ text: String) -> String {
        if text.contains("DUPLICATI_PASSWORD is empty") { return "Shown here once DUPLICATI_PASSWORD is in Settings on the computer." }
        let lower = text.lowercased()
        if ["connection refused", "dial tcp", "no such host", "timeout", "eof"].contains(where: { lower.contains($0) }) {
            return "Duplicati isn't answering: start it on Status, and the jobs show here."
        }
        return text
    }

    /// "All 4 ran 6 hours ago", or "1 needs a look".
    static func summary(_ jobs: [DuplicatiJob], now: Date = Date()) -> String {
        let bad = jobs.filter(\.needsALook).count
        if bad > 0 { return bad == 1 ? "1 needs a look" : "\(bad) need a look" }
        let all = jobs.count == 1 ? "It ran" : "All \(jobs.count) ran"
        guard let newest = jobs.compactMap(\.lastFinished).max() else { return all }
        return all + " " + newest.formatted(.relative(presentation: .named, unitsStyle: .wide))
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
    /// Its last weekly integrity check (main #463, `homelab backup-check`):
    /// when, and what Duplicati found wrong; nil when its files matched.
    let checked: Date?
    let checkProblem: String?

    enum CodingKeys: String, CodingKey {
        case id, name, lastFinished, lastError, errorMessage, size, state, nextRun
        case took, holds, files, versions, sources, checked, checkProblem
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
        checked = GoZeroTime.drop((try? c.decodeIfPresent(Date.self, forKey: .checked)) ?? nil)
        let problem = (try? c.decodeIfPresent(String.self, forKey: .checkProblem)) ?? nil
        checkProblem = (problem?.isEmpty ?? true) ? nil : problem
    }

    /// Duplicati's sizes ("3.311 GiB") as the app's other sizes ("3.3 GB"),
    /// as `sizeText` in web/src/backups/Backups.tsx. Anything else is kept.
    static func sizeText(_ text: String) -> String {
        let parts = text.trimmingCharacters(in: .whitespaces).split(separator: " ", omittingEmptySubsequences: true)
        let powers: [String: Double] = ["b": 0, "bytes": 0, "kb": 1, "kib": 1, "mb": 2, "mib": 2, "gb": 3, "gib": 3, "tb": 4, "tib": 4]
        guard parts.count == 2, let power = powers[parts[1].lowercased()],
              let number = Double(parts[0].replacingOccurrences(of: ",", with: ".")), number.isFinite, number >= 0
        else { return text }
        let bytes = number * pow(1024, power)
        guard bytes < Double(Int64.max) else { return text }
        return Int64(bytes).formatted(.byteCount(style: .memory))
    }

    /// The folders it copies, by name: /source/appdata/immich/ is "immich".
    var sourceNames: [String] {
        sources.map { s in s.split(separator: "/").last.map(String.init) ?? s }
    }

    /// "Took 4 min · 48.2 GB in 4,210 files · keeps 12 versions", or nil with nothing to say.
    var lastRunSummary: String? {
        var parts: [String] = []
        if took > 0 {
            parts.append("Took " + Duration.seconds(took).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .abbreviated, maximumUnitCount: 2)))
        }
        if let holds, !holds.isEmpty {
            let held = Self.sizeText(holds)
            parts.append(files > 0 ? "\(held) in \(files.formatted()) files" : held)
        } else if files > 0 {
            parts.append("\(files.formatted()) files")
        }
        if versions > 0 { parts.append(versions == 1 ? "keeps 1 version" : "keeps \(versions) versions") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

extension DuplicatiJob {
    /// Its last run went fine, but Sunday's check found a damaged file: a
    /// version may not restore (main #463).
    var damaged: Bool { state == "ok" && checkProblem != nil }

    /// As the computer counts "need a look": not backed up, or a check
    /// that found a damaged file.
    var needsALook: Bool { state != "ok" || checkProblem != nil }
}
