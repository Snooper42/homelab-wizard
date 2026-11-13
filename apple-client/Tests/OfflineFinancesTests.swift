import CryptoKit
import Foundation
import Testing
@testable import HomelabClient

/// Finances offline (the owner, Nov 13: "open the Homelab app using my Face
/// ID ... whatever static stale or last updated finance files and numbers
/// are there ... and then the minute that I get back home ... sync"): the
/// last Finances read are kept on this device, locked with a key only this
/// device holds, shown "As of" when the Homelab doesn't answer, to look at
/// only, and read fresh again by themselves once it does. Made-up numbers.
@Suite("Finances offline")
struct OfflineFinancesTests {
    private let planAnswer = Data(#"""
    {"result":{"today":"2026-11-13","plan":{"rev":"r1","people":[],"payments":[],"cushion":0,
      "accounts":[{"id":"chk","name":"Example Checking","kind":"checking","balance":1234.56}]},"periods":[]}}
    """#.utf8)
    private let ledgerAnswer = Data(#"""
    {"result":{"rev":"l1","transactions":[{"id":"t1","date":"2026-11-12","account":"chk","amount":-12.5,"payee":"Corner Cafe"}]}}
    """#.utf8)
    private let sharedAnswer = Data(#"{"result":{"currency":"USD","shares":["bills"],"bills":[{"name":"Rent","amount":900,"date":"2026-12-01"}]}}"#.utf8)

    private func place() throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("offline-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("finances-offline.sealed")
    }

    private func keeper(_ file: URL, _ key: SymmetricKey) -> OfflineFinances {
        OfflineFinances(file: file, key: { key })
    }

    @Test func whatWasReadComesBack() throws {
        let file = try place()
        let key = SymmetricKey(size: .bits256)
        let at = Date(timeIntervalSince1970: 1_794_585_600)
        try keeper(file, key).keep(OfflineFinances.Answers(at: at, level: .edit, plan: planAnswer, ledger: ledgerAnswer, shared: sharedAnswer))
        let kept = try #require(keeper(file, key).load())
        #expect(kept.at == at)
        #expect(kept.level == .edit)
        #expect(kept.plan.view.plan.accounts.first?.name == "Example Checking")
        #expect(kept.plan.rawPlan["rev"] == .string("r1"))
        #expect(kept.ledger?.ledger.transactions.first?.payee == "Corner Cafe")
        #expect(kept.shared?.shares == ["bills"] && kept.shared?.bills.first?.name == "Rent")
    }

    @Test func noLedgerOrShareYet() throws {
        let file = try place()
        let key = SymmetricKey(size: .bits256)
        try keeper(file, key).keep(OfflineFinances.Answers(at: Date(), level: .view, plan: planAnswer, ledger: nil, shared: nil))
        let kept = try #require(keeper(file, key).load())
        #expect(kept.ledger == nil && kept.shared == nil)
    }

    /// On disk it's sealed: nothing of the money can be read from the file.
    @Test func lockedOnDisk() throws {
        let file = try place()
        try keeper(file, SymmetricKey(size: .bits256)).keep(OfflineFinances.Answers(at: Date(), level: .view, plan: planAnswer, ledger: ledgerAnswer, shared: sharedAnswer))
        let bytes = try Data(contentsOf: file)
        for plain in ["Example Checking", "Corner Cafe", "1234.56", "Rent", "\"result\""] {
            #expect(bytes.range(of: Data(plain.utf8)) == nil, "\(plain) is readable on disk")
        }
    }

    /// Another device's key (or this one's, after the app was put back
    /// fresh) opens nothing, and what can't be opened is removed.
    @Test func anotherKeyOpensNothing() throws {
        let file = try place()
        try keeper(file, SymmetricKey(size: .bits256)).keep(OfflineFinances.Answers(at: Date(), level: .view, plan: planAnswer, ledger: nil, shared: nil))
        #expect(keeper(file, SymmetricKey(size: .bits256)).load() == nil)
        #expect(!FileManager.default.fileExists(atPath: file.path))
        #expect(OfflineFinances(file: file, key: { nil }).load() == nil)
    }

    /// Kept only on a device that may see the plan; a wall screen's money
    /// card, or none, keeps nothing, and drops what was kept.
    @Test func onlyWithTheFinancesLevel() throws {
        let file = try place()
        let key = SymmetricKey(size: .bits256)
        try keeper(file, key).keep(OfflineFinances.Answers(at: Date(), level: .view, plan: planAnswer, ledger: nil, shared: nil))
        for level in [FinancesLevel.card, .none] {
            try keeper(file, key).keep(OfflineFinances.Answers(at: Date(), level: level, plan: planAnswer, ledger: nil, shared: nil))
            #expect(!FileManager.default.fileExists(atPath: file.path), "kept at \(level)")
        }
    }

    @Test func notAFinancesAnswerIsNotKept() throws {
        let file = try place()
        let key = SymmetricKey(size: .bits256)
        #expect(throws: (any Error).self) {
            try keeper(file, key).keep(OfflineFinances.Answers(at: Date(), level: .view, plan: Data("{\"error\":\"no\"}".utf8), ledger: nil, shared: nil))
        }
        #expect(keeper(file, key).load() == nil)
    }

    @Test func forgotten() throws {
        let file = try place()
        let key = SymmetricKey(size: .bits256)
        try keeper(file, key).keep(OfflineFinances.Answers(at: Date(), level: .view, plan: planAnswer, ledger: nil, shared: nil))
        keeper(file, key).forget()
        #expect(!FileManager.default.fileExists(atPath: file.path))
        #expect(keeper(file, key).load() == nil)
    }

    /// Shown only when the Homelab can't be reached: never in place of a
    /// refusal (Finances taken from this phone, or the phone removed).
    @Test func onlyWhenTheHomelabDoesntAnswer() {
        #expect(OfflineFinances.showsKept(after: .transport(.notConnectedToInternet)))
        #expect(OfflineFinances.showsKept(after: .transport(.timedOut)))
        #expect(OfflineFinances.showsKept(after: .transport(.cannotConnectToHost)))
        #expect(!OfflineFinances.showsKept(after: .forbidden("no Finances")))
        #expect(!OfflineFinances.showsKept(after: .unauthorized))
        #expect(!OfflineFinances.showsKept(after: .server(status: 500, message: nil)))
        #expect(!OfflineFinances.showsKept(after: .decoding))
    }

    @Test func asOfWords() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/New_York"))
        let locale = Locale(identifier: "en_US_POSIX")
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 18, minute: 5)))
        let morning = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 9, minute: 40)))
        let lastNight = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: 22, minute: 15)))
        let lastWeek = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 6, hour: 7, minute: 0)))
        // The system's time puts a narrow no-break space before AM and PM: the same words.
        let words = { (at: Date) in OfflineFinances.asOf(at, now: now, calendar: calendar, locale: locale).replacingOccurrences(of: "\u{202F}", with: " ") }
        #expect(words(morning) == "As of today, 9:40 AM")
        #expect(words(lastNight) == "As of yesterday, 10:15 PM")
        #expect(words(lastWeek) == "As of Nov 6, 7:00 AM")
    }
}
