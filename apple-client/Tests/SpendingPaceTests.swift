import Foundation
import Testing
@testable import HomelabClient

/// Spending this month against last month, as a line. Made-up rows.
@Suite struct SpendingPaceTests {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) throws -> Date {
        try #require(calendar.date(from: DateComponents(year: y, month: m, day: d)))
    }

    private func rows(_ json: String) throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"{"transactions":[\#(json)]}"#.utf8)).transactions
    }

    @Test func soFarAgainstLastMonthByTheSameDay() throws {
        let pace = try #require(SpendingPace.make(try rows("""
        {"id":"a","date":"2026-11-02","account":"chk","amount":-100,"payee":"Groceries"},
        {"id":"b","date":"2026-11-03","account":"chk","amount":2150,"payee":"Paycheck"},
        {"id":"c","date":"2026-11-03","account":"chk","amount":-500,"payee":"To savings","to":"sav"},
        {"id":"d","date":"2026-11-04","account":"visa","amount":-40,"payee":"Gas"},
        {"id":"e","date":"2026-10-01","account":"chk","amount":-60,"payee":"Groceries"},
        {"id":"f","date":"2026-10-04","account":"chk","amount":-30,"payee":"Coffee"},
        {"id":"g","date":"2026-10-20","account":"chk","amount":-900,"payee":"Later in October"}
        """), today: try day(2026, 11, 4), calendar: calendar))
        // Money in and a move into savings aren't spending.
        #expect(pace.thisMonth.map(\.total) == [0, 100, 100, 140])
        #expect(pace.spent == 140)
        #expect(pace.lastMonth.count == 31 && pace.lastMonth.last?.total == 990)
        // October by the 4th: 90, not the 20th's.
        #expect(pace.lastByToday == 90 && pace.difference == 50)
        #expect(pace.daysInMonth == 31)
    }

    @Test func aShorterLastMonthComparesWithItsLastDay() throws {
        let pace = try #require(SpendingPace.make(try rows("""
        {"id":"a","date":"2026-03-31","account":"chk","amount":-10,"payee":"Coffee"},
        {"id":"b","date":"2026-02-28","account":"chk","amount":-25,"payee":"Coffee"}
        """), today: try day(2026, 3, 31), calendar: calendar))
        #expect(pace.lastByToday == 25 && pace.spent == 10)
    }

    @Test func noLastMonthNoComparison() throws {
        let pace = try #require(SpendingPace.make(try rows(#"{"id":"a","date":"2026-11-02","account":"chk","amount":-100,"payee":"Groceries"}"#),
                                                  today: try day(2026, 11, 4), calendar: calendar))
        #expect(pace.lastMonth.isEmpty && pace.lastByToday == nil && pace.difference == nil)
        #expect(SpendingPace.make([], today: try day(2026, 11, 4), calendar: calendar) == nil)
    }
}
