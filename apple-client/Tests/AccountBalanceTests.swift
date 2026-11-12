import Foundation
import Testing
@testable import HomelabClient

// An account's page on the iPhone and iPad works its balance after each day
// as the computer does (web/src/finances/model.ts's balanceAfter): back from
// the balance typed in through what went in and out before it, on through
// what came after; a card owes the more for a charge; a home has no line.

private func decode<T: Decodable>(_ json: String) throws -> T {
    try JSONDecoder().decode(T.self, from: Data(json.utf8))
}

struct AccountBalanceTests {
    private let ledger = #"""
    {"transactions":[
      {"id":"t1","date":"2026-10-24","account":"chk","amount":-63.75,"payee":"Corner Grocer"},
      {"id":"t2","date":"2026-10-26","account":"chk","amount":2400,"payee":"Paycheck"},
      {"id":"t3","date":"2026-10-27","account":"chk","amount":-250,"payee":"Roth","to":"roth"},
      {"id":"t4","date":"2026-10-31","account":"chk","amount":-48.2,"payee":"Fuel"},
      {"id":"t5","date":"2026-10-28","account":"card","amount":-40,"payee":"Cafe"}
    ]}
    """#

    @Test func checkingWorksBackAndOnFromItsDay() throws {
        let a: FinanceAccount = try decode(#"{"id":"chk","name":"Checking","kind":"checking","balance":2512.40,"updated":"2026-10-30"}"#)
        let l: FinanceLedger = try decode(ledger)
        let day = { (s: String) in LocalDay.parse(s)! }
        #expect(AccountBalance.runs(a))
        #expect(AccountBalance.after(a, l.transactions, day: day("2026-10-30")) == 2512.40)
        // Before its day: what came in since taken off, what went out put back.
        #expect(abs(AccountBalance.after(a, l.transactions, day: day("2026-10-26"))! - 2762.40) < 0.001)
        #expect(abs(AccountBalance.after(a, l.transactions, day: day("2026-10-25"))! - 362.40) < 0.001)
        #expect(abs(AccountBalance.after(a, l.transactions, day: day("2026-10-23"))! - 426.15) < 0.001)
        // After it: on through what came after.
        #expect(abs(AccountBalance.after(a, l.transactions, day: day("2026-10-31"))! - 2464.20) < 0.001)
        let mine = AccountBalance.mine(a, l.transactions)
        #expect(mine.map(\.id) == ["t4", "t3", "t2", "t1"])
        let series = AccountBalance.series(a, l.transactions, today: day("2026-10-31"), days: 7)
        #expect(series.count == 8)
        #expect(abs(series.last!.value - 2464.20) < 0.001)
    }

    @Test func aCardOwesTheMoreForACharge() throws {
        let card: FinanceAccount = try decode(#"{"id":"card","name":"Card","kind":"card","balance":100,"updated":"2026-10-30"}"#)
        let l: FinanceLedger = try decode(ledger)
        #expect(AccountBalance.after(card, l.transactions, day: LocalDay.parse("2026-10-27")!) == 60)
    }

    @Test func aHomeOrOneNeverTypedInHasNoLine() throws {
        let home: FinanceAccount = try decode(#"{"id":"home","name":"Home","kind":"home","balance":410000,"updated":"2026-10-01"}"#)
        let untyped: FinanceAccount = try decode(#"{"id":"chk","name":"Checking","kind":"checking","balance":10}"#)
        #expect(!AccountBalance.runs(home))
        #expect(!AccountBalance.runs(untyped))
        #expect(AccountBalance.series(home, [], today: Date(), days: 30).isEmpty)
        #expect(AccountBalance.after(untyped, [], day: Date()) == nil)
    }
}
