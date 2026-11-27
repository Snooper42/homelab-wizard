import Foundation
import Testing
@testable import HomelabClient

/// Transactions selected together: one
/// category, Move to another account, or Delete, for each that can take it.
@Suite("Transactions selected together")
struct SelectTogetherTests {
    private let ledger = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r3","transactions":[
      {"id":"a","date":"2026-11-01","account":"chk","amount":-5,"payee":"Example Café"},
      {"id":"b","date":"2026-11-02","account":"chk","amount":-40,"payee":"Example Grocer","note":"weekly"},
      {"id":"t","date":"2026-11-03","account":"chk","to":"sav","amount":-100,"payee":"To savings"},
      {"id":"s","date":"2026-11-04","account":"chk","amount":-60,"payee":"Example Store",
       "splits":[{"category":"Food","amount":-30},{"category":"Home","amount":-30}]}
    ]}
    """#.utf8))
    private let accounts: Set<String> = ["chk", "sav", "visa"]

    private func entry(_ id: String, _ l: JSONValue) -> JSONValue? {
        guard case .array(let all)? = l["transactions"] else { return nil }
        return all.first { $0["id"] == .string(id) }
    }

    @Test func oneCategoryForEachThatCanTakeOne() throws {
        let r = try #require(LedgerEdit.each(["a", "b", "t", "s"], in: ledger) { LedgerEdit.settingCategory(id: $0, to: "Groceries", in: $1) })
        #expect(r.done == ["a", "b"])                     // a transfer and a split are changed on the computer
        #expect(entry("a", r.ledger)?["category"] == .string("Groceries"))
        #expect(entry("b", r.ledger)?["note"] == .string("weekly"))
        #expect(entry("s", r.ledger)?["category"] == nil)
        #expect(r.ledger["rev"] == .string("r3"))
    }

    @Test func moveToAnotherAccount() throws {
        let r = try #require(LedgerEdit.each(["a", "t"], in: ledger) { LedgerEdit.moving(id: $0, to: "visa", accounts: accounts, in: $1) })
        #expect(r.done == ["a"])
        #expect(entry("a", r.ledger)?["account"] == .string("visa"))
        #expect(entry("t", r.ledger)?["account"] == .string("chk"))
        #expect(LedgerEdit.moving(id: "a", to: "nope", accounts: accounts, in: ledger) == nil)
    }

    @Test func deleteTogether() throws {
        let r = try #require(LedgerEdit.each(["a", "b", "zz"], in: ledger) { LedgerEdit.removing(id: $0, from: $1) })
        #expect(r.done == ["a", "b"])
        if case .array(let left)? = r.ledger["transactions"] { #expect(left.count == 2) }
        #expect(LedgerEdit.each(["zz"], in: ledger) { LedgerEdit.removing(id: $0, from: $1) } == nil)
    }

    @Test func aMoveMadeAwayReplays() {
        var waiting = LedgerChange.adding(.move(id: "a", to: "sav"), to: [])
        waiting = LedgerChange.adding(.move(id: "a", to: "visa"), to: waiting)
        #expect(waiting == [.move(id: "a", to: "visa")])
        let r = LedgerChange.replay(waiting, on: ledger, accounts: accounts)
        #expect(r.dropped.isEmpty)
        #expect(entry("a", r.ledger)?["account"] == .string("visa"))
    }
}
