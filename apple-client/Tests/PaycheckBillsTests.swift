import Foundation
import Testing
@testable import HomelabClient

/// This paycheck's bills: what's still to come and what's been paid. Made-up bills.
@Suite struct PaycheckBillsTests {
    private func view() throws -> FinancesPlanView {
        try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-22","checking":"chk","start":{"chk":900},
         "plan":{"people":[{"id":"alex","name":"Alex"}],"accounts":[{"id":"chk","name":"Example Checking","kind":"checking"}],"payments":[],"cushion":500},
         "periods":[{"now":true,"start":"2026-11-22","last":"2026-11-26","carried":900,"in":0,"out":395.49,"saved":0,"left":504.51,
           "rows":[{"date":"2026-11-23","payment":"hoa","amount":310},{"date":"2026-11-24","payment":"netflix","amount":15.49},
                   {"date":"2026-11-24","payment":"card","amount":200,"outside":true},{"date":"2026-11-25","payment":"roth","amount":100,"into":true},
                   {"date":"2026-11-26","payment":"xfinity","amount":70}]}],
         "before":[{"date":"2026-11-13","people":["alex"],"amount":2150}],"days":[]}
        """#.utf8))
    }

    private func ledger() throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"a","date":"2026-11-18","account":"chk","amount":-136.42,"payee":"PG&E","payment":"pge"},
          {"id":"b","date":"2026-11-15","account":"chk","amount":-412,"payee":"Toyota","payment":"car"},
          {"id":"c","date":"2026-11-16","account":"chk","amount":-24.80,"payee":"Chipotle"},
          {"id":"d","date":"2026-11-10","account":"chk","amount":-168,"payee":"GEICO","payment":"geico"},
          {"id":"e","date":"2026-11-22","account":"chk","amount":-11.99,"payee":"Spotify","payment":"spotify"}]}
        """#.utf8)).transactions
    }

    @Test func whatsToComeAndWhatsPaid() throws {
        let bills = try #require(PaycheckBills.make(try view(), transactions: try ledger()))
        // Out of checking only: not one paid from a card, not money moved into savings.
        #expect(bills.upcoming.map(\.payment) == ["hoa", "netflix", "xfinity"])
        #expect(abs(bills.leftToPay - 395.49) < 0.001)
        // Linked to a planned payment, since the last payday (Nov 13) and before today, newest first.
        #expect(bills.paid.map(\.payment) == ["pge", "car"])
        #expect(bills.paid.map(\.amount) == [136.42, 412])
    }

    @Test func aPaymentThePlanCantNameIsLeftOut() throws {
        let bills = try #require(PaycheckBills.make(try view(), transactions: try ledger(), named: { $0 != "hoa" && $0 != "car" }))
        #expect(bills.upcoming.map(\.payment) == ["netflix", "xfinity"])
        #expect(bills.paid.map(\.payment) == ["pge"])
    }

    @Test func howLongUntil() throws {
        let today = try #require(LocalDay.parse("2026-11-22"))
        #expect(PaycheckBills.until(LocalDay.parse("2026-11-22"), today: today) == "Today")
        #expect(PaycheckBills.until(LocalDay.parse("2026-11-23"), today: today) == "Tomorrow")
        #expect(PaycheckBills.until(LocalDay.parse("2026-11-26"), today: today) == "in 4 days")
    }
}
