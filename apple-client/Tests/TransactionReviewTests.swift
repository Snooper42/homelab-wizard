import Foundation
import Testing
@testable import HomelabClient

/// Transactions' sorting, as the computer's top of Transactions
/// (importData.ts's `suggestLinks`, `pairs` and `joined`), on made-up rows:
/// what looks like a planned payment, what looks like a transfer, and each
/// change and its Undo on the ledger.
@Suite("Sorting on Transactions")
struct TransactionReviewTests {
    private func row(_ id: String, _ account: String, _ date: String, _ amount: Double, _ payee: String, more: [String: JSONValue] = [:]) -> JSONValue {
        var o: [String: JSONValue] = ["id": .string(id), "account": .string(account), "date": .string(date), "amount": .number(amount), "payee": .string(payee)]
        for (k, v) in more { o[k] = v }
        return .object(o)
    }

    private var ledger: JSONValue {
        .object(["transactions": .array([
            row("a", "chk", "2026-11-09", -15.99, "StreamBox"),
            row("b", "chk", "2026-11-12", -250, "Online transfer", more: ["bank": .string("B1"), "category": .string("Other")]),
            row("c", "sav", "2026-11-13", 250, "Deposit", more: ["bank": .string("B2"), "note": .string("From checking")]),
            row("d", "chk", "2026-11-14", -91.40, "Evergreen Power"),
            row("e", "chk", "2026-11-14", -42.18, "Green Grocer"),
            // The same amount in, but ten days later: not a pair.
            row("f", "sav", "2026-11-24", 42.18, "Refund"),
            // Already a transfer, linked, or said apart: never offered.
            row("g", "chk", "2026-11-15", -100, "To savings", more: ["to": .string("sav")]),
            row("h", "chk", "2026-11-16", -30, "Gym", more: ["apart": .bool(true)]),
            row("i", "sav", "2026-11-16", 30, "Gym back", more: ["apart": .bool(true)]),
        ])])
    }

    @Test func pairsLookLikeTransfers() {
        let pairs = TransactionReview.pairs(BankImport.kept(in: ledger))
        #expect(pairs == [TransactionReview.Pair(out: "b", into: "c")])
    }

    @Test func rowsThatLookLikeAPlannedPayment() {
        let plan: JSONValue = .object(["payments": .array([
            .object(["id": .string("p1"), "name": .string("Evergreen Power"), "kind": .string("utilities"), "amount": .number(96)]),
            .object(["id": .string("p2"), "name": .string("StreamBox"), "kind": .string("subscriptions"), "amount": .number(15.99)]),
            // A card's payoff is never offered.
            .object(["id": .string("p3"), "name": .string("Card"), "card": .string("amex"), "amount": .number(42.18)]),
        ])])
        let view: JSONValue = .object(["dues": .object(["p1": .array([.string("2026-11-15")]), "p2": .array([.string("2026-11-09")]),
                                                        "p3": .array([.string("2026-11-14")])])])
        let links = TransactionReview.links(BankImport.kept(in: ledger), plan: plan, view: view, checking: "chk", logos: .shared)
        // Newest first; Evergreen Power's bill is a utility, so it may be off by up to two fifths.
        #expect(links.map(\.id) == ["d", "a"])
        #expect(links[0].payment == "p1" && links[0].due == "2026-11-15")
        #expect(links[1].payment == "p2")
        // Once linked, or said Not It, it isn't offered again.
        let linked = LedgerChange.link(id: "d", payment: "p1").apply(to: ledger, accounts: ["chk", "sav"])!
        let notIt = LedgerChange.link(id: "a", payment: nil).apply(to: linked, accounts: ["chk", "sav"])!
        #expect(TransactionReview.links(BankImport.kept(in: notIt), plan: plan, view: view, checking: "chk", logos: .shared).isEmpty)
        // Undo: neither linked nor said Not It.
        let back = LedgerChange.unlink(id: "a").apply(to: notIt, accounts: ["chk", "sav"])!
        #expect(BankImport.kept(in: back).first { $0.id == "a" }.map { $0.payment == nil && !$0.notPlanned } == true)
    }

    @Test func joinedAsOneTransferAndBack() throws {
        let joined = try #require(LedgerChange.join(out: "b", into: "c").apply(to: ledger, accounts: ["chk", "sav"]))
        let rows = BankImport.kept(in: joined)
        #expect(!rows.contains { $0.id == "c" })
        let t = try #require(rows.first { $0.id == "b" })
        // The leaving half's day and payee, into the other's account, its bank id kept, no category.
        #expect(t.to == "sav" && t.toBank == "B2" && t.bank == "B1" && t.date == "2026-11-12" && t.payee == "Online transfer" && t.category.isEmpty)
        #expect(t.note == "From checking")
        #expect(TransactionReview.pairs(rows).isEmpty)
        // Undo: both rows as they were.
        guard case .array(let all)? = ledger["transactions"] else { Issue.record("no rows"); return }
        let back = try #require(LedgerChange.unjoin(out: all[1], into: all[2]).apply(to: joined, accounts: ["chk", "sav"]))
        #expect(back == ledger)
        // Not a pair: refused.
        #expect(LedgerChange.join(out: "e", into: "f").apply(to: ledger, accounts: ["chk", "sav"]) != nil)
        #expect(LedgerChange.join(out: "d", into: "e").apply(to: ledger, accounts: ["chk", "sav"]) == nil)
        #expect(LedgerChange.join(out: "g", into: "c").apply(to: ledger, accounts: ["chk", "sav"]) == nil)
    }

    @Test func notOneTransferAndBack() throws {
        let apart = try #require(LedgerChange.apart(ids: ["b", "c"], true).apply(to: ledger, accounts: []))
        #expect(TransactionReview.pairs(BankImport.kept(in: apart)).isEmpty)
        let back = try #require(LedgerChange.apart(ids: ["b", "c"], false).apply(to: apart, accounts: []))
        #expect(back == ledger)
    }

    @Test func keptWhileAway() throws {
        let changes: [LedgerChange] = [.link(id: "d", payment: "p1"), .join(out: "b", into: "c"), .apart(ids: ["h"], true), .unlink(id: "d")]
        let data = try JSONEncoder().encode(changes)
        #expect(try JSONDecoder().decode([LedgerChange].self, from: data) == changes)
        #expect(changes.map(\.transaction) == ["d", "b", "h", "d"])
    }
}
