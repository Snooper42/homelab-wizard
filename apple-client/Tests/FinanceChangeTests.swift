import CryptoKit
import Foundation
import Testing
@testable import HomelabClient

/// Changes made away from home, replayed on the computer's newest plan
/// (offline Finances 2 of 3): another device's changes to anything else are
/// kept, and only the same thing changed differently on both is a clash.
@Suite("Changes made away, replayed")
struct FinanceChangeTests {
    /// The plan as this phone kept it.
    private let kept = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r1","cushion":250,
     "accounts":[{"id":"chk","name":"Example Checking","kind":"checking","balance":1200},
                 {"id":"sav","name":"Example Savings","kind":"savings","balance":5000}],
     "payments":[{"id":"electric","name":"Electric","amount":90,"kind":"utilities","schedule":{"every":"month","start":"2026-11-25"}},
                 {"id":"rent","name":"Rent","amount":1500,"kind":"home","schedule":{"every":"month","start":"2026-12-01"}}],
     "budgets":[{"category":"Groceries","amount":600}],
     "goals":[{"id":"trip","name":"Trip","target":3000,"shares":[{"account":"sav","percent":50}]}]}
    """#.utf8))

    private func newest(_ edit: (inout [String: JSONValue]) -> Void) -> JSONValue {
        guard case .object(var o) = kept else { return kept }
        edit(&o)
        o["rev"] = .string("r2")
        return .object(o)
    }

    private func payments(_ plan: JSONValue) -> [JSONValue] {
        if case .array(let p)? = plan["payments"] { return p }
        return []
    }

    @Test func anotherDevicesOtherChangesAreKept() throws {
        // Away, this phone changed Electric; meanwhile the Mac changed Rent.
        let mine: [FinanceChange] = [.paymentAmount(id: "electric", to: 95, was: 90)]
        let theirs = try #require(FinancePlanEdit.settingPayment(id: "rent", to: 1550, in: kept))
        let r = FinanceReplay.replay(mine, on: theirs)
        #expect(r.clashes.isEmpty && r.dropped.isEmpty)
        let p = payments(r.plan)
        #expect(p[0]["amount"] == .number(95))
        #expect(p[1]["amount"] == .number(1550))
    }

    @Test func theSameThingChangedDifferentlyIsAsked() throws {
        let mine: [FinanceChange] = [.paymentAmount(id: "electric", to: 95, was: 90), .cushion(to: 300, was: 250)]
        let theirs = try #require(FinancePlanEdit.settingPayment(id: "electric", to: 92, in: kept))
        let r = FinanceReplay.replay(mine, on: theirs)
        #expect(r.clashes == [FinanceClash(index: 0, change: mine[0], theirs: 92)])
        // Undecided, it isn't made; the rest is.
        #expect(payments(r.plan)[0]["amount"] == .number(92))
        #expect(r.plan["cushion"] == .number(300))
        // Keep this phone's, or theirs.
        #expect(payments(FinanceReplay.replay(mine, on: theirs, keepMine: [0: true]).plan)[0]["amount"] == .number(95))
        let keptTheirs = FinanceReplay.replay(mine, on: theirs, keepMine: [0: false])
        #expect(keptTheirs.clashes.isEmpty)
        #expect(payments(keptTheirs.plan)[0]["amount"] == .number(92))
    }

    @Test func theSameChangeOnBothIsNoClash() throws {
        let mine: [FinanceChange] = [.paymentAmount(id: "electric", to: 95, was: 90)]
        let theirs = try #require(FinancePlanEdit.settingPayment(id: "electric", to: 95, in: kept))
        #expect(FinanceReplay.replay(mine, on: theirs).clashes.isEmpty)
    }

    @Test func eachKindOfChangeReplays() throws {
        let mine: [FinanceChange] = [
            .balance(account: "chk", to: 1180.5, was: 1200, today: "2026-11-20"),
            .cushion(to: 300, was: 250),
            .budget(category: "groceries", to: 650, was: 600),
            .goalTarget(id: "trip", to: 3500, was: 3000),
            .waiting(key: "payment:electric:2026-11-25", waiting: true),
            .addAccount(name: "Example Brokerage", kind: "investment", balance: 900, today: "2026-11-20"),
            .addPayment(name: "Example Streaming", amount: 15.49, every: "month", start: "2026-11-28",
                        kind: "subscriptions", from: "chk", estimate: false),
            .addGoal(name: "Laptop", target: 1500, date: nil, account: "sav", percent: 50),
        ]
        let r = FinanceReplay.replay(mine, on: newest { _ in })
        #expect(r.clashes.isEmpty && r.dropped.isEmpty)
        #expect(r.plan["cushion"] == .number(300))
        #expect(r.plan["rev"] == .string("r2"))   // the newest's rev: the save is checked against it
        if case .array(let a)? = r.plan["accounts"] { #expect(a.count == 3 && a[0]["balance"] == .number(1180.5)) }
        if case .array(let g)? = r.plan["goals"] { #expect(g.count == 2 && g[0]["target"] == .number(3500)) }
        #expect(payments(r.plan).count == 3)
    }

    @Test func aChangeToWhatsGoneIsDropped() throws {
        let mine: [FinanceChange] = [.paymentAmount(id: "electric", to: 95, was: 90), .cushion(to: 300, was: 250)]
        let gone = newest { o in o["payments"] = .array([]) }
        let r = FinanceReplay.replay(mine, on: gone)
        // Electric was deleted on the computer: nothing there to set, and no clash to ask about.
        #expect(r.dropped == [0])
        #expect(r.plan["cushion"] == .number(300))
    }

    @Test func twiceToTheSameThingIsOneChange() throws {
        // Away: Electric 90 → 95, then 95 → 100. One change, from 90.
        var waiting = FinanceChange.adding(FinanceChange.paymentAmount(id: "electric", to: 95, was: nil).noting(kept), to: [])
        let after = try #require(waiting[0].apply(to: kept))
        waiting = FinanceChange.adding(FinanceChange.paymentAmount(id: "electric", to: 100, was: nil).noting(after), to: waiting)
        #expect(waiting == [.paymentAmount(id: "electric", to: 100, was: 90)])
        // Replayed on the kept plan itself, it's no clash with itself.
        let r = FinanceReplay.replay(waiting, on: kept)
        #expect(r.clashes.isEmpty)
        #expect(payments(r.plan)[0]["amount"] == .number(100))
        // Adding never merges.
        let two = FinanceChange.adding(.addGoal(name: "A", target: 1, date: nil, account: "sav", percent: 10),
                                       to: [.addGoal(name: "A", target: 1, date: nil, account: "sav", percent: 10)])
        #expect(two.count == 2)
    }

    @Test func notingRemembersWhatWasThere() {
        #expect(FinanceChange.cushion(to: 300, was: nil).noting(kept) == .cushion(to: 300, was: 250))
        #expect(FinanceChange.budget(category: " groceries", to: 650, was: nil).noting(kept) == .budget(category: " groceries", to: 650, was: 600))
        #expect(FinanceChange.balance(account: "chk", to: 1100, was: nil, today: "2026-11-20").noting(kept)
                == .balance(account: "chk", to: 1100, was: 1200, today: "2026-11-20"))
    }

    @Test func changesKeepAndComeBack() throws {
        let mine: [FinanceChange] = [.addGoal(name: "Laptop", target: 1500, date: "2027-06-01", account: "sav", percent: 25),
                                     .waiting(key: "payment:rent:2026-12-01", waiting: false)]
        let back = try JSONDecoder().decode([FinanceChange].self, from: JSONEncoder().encode(mine))
        #expect(back == mine)
    }
}

/// The changes made away, sealed on this device.
@Suite("Changes made away, kept sealed")
struct AwayChangesTests {
    private func store(_ key: SymmetricKey?) -> AwayChanges {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("away-\(UUID().uuidString).sealed")
        return AwayChanges(file: file) { key }
    }

    @Test func keptSealedAndReadBack() throws {
        let key = SymmetricKey(size: .bits256)
        let s = store(key)
        let changes: [FinanceChange] = [.cushion(to: 300, was: 250), .paymentAmount(id: "electric", to: 95, was: 90)]
        let ledger: [LedgerChange] = [.category(id: "t2", to: "Groceries")]
        try s.keep(changes, ledger: ledger)
        #expect(s.load().plan == changes)
        #expect(s.load().ledger == ledger)
        // Sealed: the amounts aren't in the file as text.
        let bytes = try Data(contentsOf: s.file)
        #expect(String(decoding: bytes, as: UTF8.self).contains("electric") == false)
        try s.keep([])
        #expect(FileManager.default.fileExists(atPath: s.file.path) == false)
    }

    @Test func anotherKeyOpensNothingAndTheFileGoes() throws {
        let s = store(SymmetricKey(size: .bits256))
        try s.keep([.cushion(to: 300, was: 250)])
        let other = AwayChanges(file: s.file) { SymmetricKey(size: .bits256) }
        #expect(other.load().plan.isEmpty)
        #expect(FileManager.default.fileExists(atPath: s.file.path) == false)
    }

    @Test func noKeyKeepsNothing() {
        #expect(throws: AwayChanges.KeepError.self) { try store(nil).keep([.cushion(to: 300, was: 250)]) }
    }
}

/// Track from on the phone (the owner, Nov 16: Jan 1, 2026): set in the
/// plan as the computer keeps it, or taken out to count everything; kept
/// away as one change (a second takes the first's place) and replayed on
/// the newest plan; the months before it marked on Transactions.
@Suite("Track from")
struct TrackFromTests {
    private let plan: JSONValue = .object(["cushion": .number(500), "accounts": .array([])])

    @Test func setInThePlan() throws {
        let set = try #require(FinancePlanEdit.settingTrackFrom("2026-01-01", in: plan))
        #expect(set["trackFrom"] == .string("2026-01-01"))
        #expect(set["cushion"] == .number(500))
        let cleared = try #require(FinancePlanEdit.settingTrackFrom(nil, in: set))
        #expect(cleared["trackFrom"] == nil)
        #expect(FinancePlanEdit.settingTrackFrom("", in: set)?["trackFrom"] == nil)
        #expect(FinancePlanEdit.settingTrackFrom("soon", in: plan) == nil)
        #expect(FinancePlanEdit.settingTrackFrom("2026-1-1", in: plan) == nil)
    }

    @Test func keptAwayAndReplayed() throws {
        let changes = FinanceChange.adding(.trackFrom("2026-02-01"), to: FinanceChange.adding(.trackFrom("2026-01-01"), to: [.cushion(to: 300, was: 500)]))
        #expect(changes == [.cushion(to: 300, was: 500), .trackFrom("2026-02-01")])
        #expect(FinanceChange.trackFrom(nil).target == "trackFrom" && FinanceChange.trackFrom(nil).setting == nil)
        let replayed = try #require(FinanceChange.trackFrom("2026-01-01").apply(to: plan))
        #expect(replayed["trackFrom"] == .string("2026-01-01"))
        // Kept sealed as JSON: it comes back as it was.
        let data = try JSONEncoder().encode([FinanceChange.trackFrom("2026-01-01"), .trackFrom(nil)])
        #expect(try JSONDecoder().decode([FinanceChange].self, from: data) == [.trackFrom("2026-01-01"), .trackFrom(nil)])
    }

    @Test func monthsBeforeItAreMarked() throws {
        let december = try #require(LocalDay.parse("2025-12-01")), january = try #require(LocalDay.parse("2026-01-01"))
        #expect(FinanceLedger.sectionTitle(december, trackFrom: "2026-01-01") == "December 2025 · Not counted")
        #expect(FinanceLedger.sectionTitle(january, trackFrom: "2026-01-01") == "January 2026")
        #expect(FinanceLedger.sectionTitle(december, trackFrom: nil) == "December 2025")
        #expect(FinanceLedger.sectionTitle(.distantPast, trackFrom: "2026-01-01") == "No date")
    }
}
