import Foundation
import Testing
@testable import HomelabClient

/// Transactions changed away from home (offline Finances 3 of 3), replayed
/// on the computer's newest ledger.
@Suite("Transactions changed away, replayed")
struct LedgerChangeTests {
    private let kept = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r9","transactions":[
      {"id":"t1","date":"2026-11-01","account":"chk","amount":-5,"payee":"Example Café","category":"Food"},
      {"id":"t2","date":"2026-11-02","account":"chk","amount":-40,"payee":"Example Grocer","category":""}
    ]}
    """#.utf8))
    private let accounts: Set<String> = ["chk"]

    private func draft(_ amount: Double, payee: String) -> NewTransaction {
        NewTransaction(date: GoTime.parse("2026-11-05T12:00:00Z")!, account: "chk", isMoneyIn: false, amount: amount,
                       payee: payee, category: "Groceries", note: "")
    }

    private func all(_ ledger: JSONValue) -> [JSONValue] {
        if case .array(let a)? = ledger["transactions"] { return a }
        return []
    }

    @Test func eachKindReplaysOnTheNewest() throws {
        let mine: [LedgerChange] = [.add(draft(12.5, payee: "Example Bakery")), .category(id: "t2", to: "Groceries"), .delete(id: "t1")]
        // Meanwhile the computer read a bank file: one more transaction, and a newer rev.
        guard case .object(var o) = kept, case .array(var t)? = o["transactions"] else { Issue.record("shape"); return }
        t.append(.object(["id": .string("t3"), "date": .string("2026-11-03"), "account": .string("chk"),
                          "amount": .number(-9), "payee": .string("Example Fuel")]))
        o["transactions"] = .array(t)
        o["rev"] = .string("r10")
        let r = LedgerChange.replay(mine, on: .object(o), accounts: accounts)
        #expect(r.dropped.isEmpty)
        let ids = all(r.ledger).map { $0["id"] }
        #expect(ids == [.string("t2"), .string("t3"), nil])          // t1 deleted, t3 the computer's, the new one's id to come
        #expect(all(r.ledger)[0]["category"] == .string("Groceries"))
        #expect(r.ledger["rev"] == .string("r10"))
    }

    @Test func aChangeToATransactionTheComputerDroppedIsLeftOut() {
        let r = LedgerChange.replay([.category(id: "t9", to: "Food"), .add(draft(3, payee: "Example Kiosk"))], on: kept, accounts: accounts)
        #expect(r.dropped == [0])
        #expect(all(r.ledger).count == 3)
    }

    @Test func laterChangesToOneTransactionTakeThePlaceOfEarlier() {
        var waiting = LedgerChange.adding(.category(id: "t2", to: "Food"), to: [])
        waiting = LedgerChange.adding(.category(id: "t2", to: "Groceries"), to: waiting)
        #expect(waiting == [.category(id: "t2", to: "Groceries")])
        waiting = LedgerChange.adding(.update(id: "t2", draft(41, payee: "Example Grocer")), to: waiting)
        #expect(waiting.count == 2)
        waiting = LedgerChange.adding(.delete(id: "t2"), to: waiting)
        #expect(waiting == [.delete(id: "t2")])
        // Adding is never merged.
        #expect(LedgerChange.adding(.add(draft(1, payee: "A")), to: [.add(draft(1, payee: "A"))]).count == 2)
    }

    @Test func keptAndBack() throws {
        let mine: [LedgerChange] = [.add(draft(12.5, payee: "Example Bakery")), .update(id: "t2", draft(41, payee: "Example Grocer")),
                                    .category(id: "t1", to: "Food"), .delete(id: "t2")]
        #expect(try JSONDecoder().decode([LedgerChange].self, from: JSONEncoder().encode(mine)) == mine)
    }
}
