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

    @Test func changesKeepAndComeBack() throws {
        let mine: [FinanceChange] = [.addGoal(name: "Laptop", target: 1500, date: "2027-06-01", account: "sav", percent: 25),
                                     .waiting(key: "payment:rent:2026-12-01", waiting: false)]
        let back = try JSONDecoder().decode([FinanceChange].self, from: JSONEncoder().encode(mine))
        #expect(back == mine)
    }
}
