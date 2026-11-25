import Foundation
import Testing
@testable import HomelabClient

/// Transactions a day at a time, as the redesign's phone picture: each day's
/// total, and how many with what came in and went out. Made-up rows.
@Suite struct TransactionDaysTests {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        c.locale = Locale(identifier: "en_US")
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) throws -> Date {
        try #require(calendar.date(from: DateComponents(year: y, month: m, day: d)))
    }

    private func rows() throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"a","date":"2026-11-22","account":"visa","amount":-142.36,"payee":"Costco","category":"Groceries"},
          {"id":"b","date":"2026-11-20","account":"chk","amount":2150,"payee":"Paycheck","category":"Income"},
          {"id":"c","date":"2026-11-20","account":"amex","amount":-63.75,"payee":"Trader Joe's","category":"Groceries"},
          {"id":"d","date":"2026-11-20","account":"chk","amount":-500,"payee":"To savings","to":"sav"}
        ]}
        """#.utf8)).transactions
    }

    @Test func aDayAtATime() throws {
        let days = TransactionDays.group(try rows(), calendar: calendar)
        #expect(days.map { $0.items.map(\.id) } == [["a"], ["b", "c", "d"]])
    }

    @Test func everyAccountLeavesAMoveBetweenThemOut() throws {
        let all = try rows()
        let line = TransactionDays.line(all, account: nil)
        #expect(line.count == 4 && line.moneyIn == 2150 && abs(line.moneyOut - 206.11) < 0.001)
        let nov20 = Array(all.dropFirst())
        #expect(TransactionDays.total(nov20, account: nil) == 2086.25)
    }

    @Test func oneAccountCountsAMoveInOrOut() throws {
        let all = try rows()
        let chk = all.filter { $0.account == "chk" }
        #expect(TransactionDays.line(chk, account: "chk") == .init(count: 2, moneyIn: 2150, moneyOut: 500))
        // Into savings, seen from savings, is money in.
        let sav = all.filter { $0.to == "sav" }
        #expect(TransactionDays.line(sav, account: "sav") == .init(count: 1, moneyIn: 500, moneyOut: 0))
    }

    @Test func theDaysName() throws {
        let today = try day(2026, 11, 24)
        #expect(TransactionDays.title(try day(2026, 11, 22), trackFrom: nil, today: today, calendar: calendar) == "Nov 22")
        #expect(TransactionDays.title(try day(2025, 12, 31), trackFrom: nil, today: today, calendar: calendar) == "Dec 31, 2025")
        #expect(TransactionDays.title(try day(2026, 1, 3), trackFrom: "2026-02-01", today: today, calendar: calendar) == "Jan 3 · Not counted")
        #expect(TransactionDays.title(.distantPast, trackFrom: nil, today: today, calendar: calendar) == "No date")
    }
}

/// This paycheck and Last paycheck in Transactions' date chip, as the computer's date picker.
@Suite struct PaySpansTests {
    private func view(before: String) throws -> FinancesPlanView {
        try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-08","checking":"chk","start":{"chk":900},
         "plan":{"people":[{"id":"alex","name":"Alex"}],"accounts":[{"id":"chk","name":"Example Checking","kind":"checking"}],"payments":[],"cushion":500},
         "periods":[{"now":true,"start":"2026-11-06","last":"2026-11-19","carried":900,"in":0,"out":0,"saved":0,"left":900,"rows":[]}],
         "before":\#(before),"days":[]}
        """#.utf8))
    }

    @Test func thisPaycheckAndTheOneBefore() throws {
        let spans = PaySpans.make(try view(before: #"[{"date":"2026-10-23","people":["alex"],"amount":2150}]"#))
        #expect(spans.map(\.title) == ["This paycheck", "Last paycheck"])
        let us = Locale(identifier: "en_US")
        func day(_ d: Date) -> String { d.formatted(Date.FormatStyle(locale: us).year().month(.twoDigits).day(.twoDigits)) }
        #expect(day(spans[0].days.lowerBound) == "11/06/2026" && day(spans[0].days.upperBound) == "11/19/2026")
        #expect(day(spans[1].days.lowerBound) == "10/23/2026" && day(spans[1].days.upperBound) == "11/05/2026")
    }

    @Test func noPaydayBeforeOnlyThisOne() throws {
        #expect(PaySpans.make(try view(before: "[]")).map(\.title) == ["This paycheck"])
    }

    @Test func aFilterKeepsThePeriodsDays() throws {
        let rows = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"in","date":"2026-11-19","account":"chk","amount":-5,"payee":"Last day"},
          {"id":"out","date":"2026-11-20","account":"chk","amount":-5,"payee":"After"},
          {"id":"early","date":"2026-11-05","account":"chk","amount":-5,"payee":"Before"}]}
        """#.utf8)).transactions
        let span = try #require(PaySpans.make(try view(before: "[]")).first)
        var filter = TransactionFilter()
        filter.days = span.days
        #expect(filter.isOn)
        #expect(rows.filter { filter.keeps($0, categories: []) }.map(\.id) == ["in"])
    }
}
