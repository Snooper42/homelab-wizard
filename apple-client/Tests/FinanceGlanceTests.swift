import Foundation
import Testing
@testable import HomelabClient

/// Net worth and Cash flow as the redesign's two half cards on Finances'
/// home: a short amount, and this month's cash flow from the transactions.
/// Made-up figures.
@Suite struct FinanceGlanceTests {
    let us = Locale(identifier: "en_US")

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) throws -> Date {
        try #require(calendar.date(from: DateComponents(year: y, month: m, day: d)))
    }

    private func transactions(_ rows: String) throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"{"transactions":[\#(rows)]}"#.utf8)).transactions
    }

    @Test func shortAmountsAsTheComputersCompact() {
        #expect(CompactMoney.text(812.4, currency: "USD", locale: us) == "$812")
        #expect(CompactMoney.text(9012, currency: "USD", locale: us) == "$9.01k")
        #expect(CompactMoney.text(198_140, currency: "USD", locale: us) == "$198.1k")
        #expect(CompactMoney.text(1_240_000, currency: "USD", locale: us) == "$1.24M")
        #expect(CompactMoney.text(-1500, currency: "USD", locale: us) == "−$1.50k")
        #expect(CompactMoney.text(-0.2, currency: "USD", locale: us) == "$0")
    }

    @Test func thisMonthsCashFlowAgainstLastMonthBySameDay() throws {
        let rows = try transactions("""
        {"id":"a","date":"2026-11-02","account":"chk","amount":2150,"payee":"Paycheck"},
        {"id":"b","date":"2026-11-03","account":"chk","amount":-500,"payee":"Rent"},
        {"id":"c","date":"2026-11-04","account":"chk","amount":-145,"payee":"Groceries"},
        {"id":"d","date":"2026-11-04","account":"chk","amount":-400,"payee":"Savings","to":"sav"},
        {"id":"e","date":"2026-10-02","account":"chk","amount":2000,"payee":"Paycheck"},
        {"id":"f","date":"2026-10-03","account":"chk","amount":-600,"payee":"Rent"},
        {"id":"g","date":"2026-10-20","account":"chk","amount":-900,"payee":"Later in October"}
        """)
        let flow = try #require(CashFlowGlance.make(rows, today: try day(2026, 11, 6), calendar: calendar))
        // A move into savings is neither in nor out.
        #expect(flow.moneyIn == 2150 && flow.moneyOut == 645)
        #expect(flow.kept == 1505)
        #expect(flow.keptShare.map { abs($0 - 0.7) < 0.001 } == true)
        // October by the 6th kept 1,400 (not the 20th's): 1,505 is 7.5% more.
        #expect(flow.keptBefore == 1400)
        #expect(flow.change.map { abs($0 - 0.075) < 0.0001 } == true)
        #expect(flow.caption(locale: us, calendar: calendar) == "70% kept · November")
    }

    @Test func spentMoreOrNothingIn() throws {
        let over = try #require(CashFlowGlance.make(try transactions("""
        {"id":"a","date":"2026-11-02","account":"chk","amount":100,"payee":"Refund"},
        {"id":"b","date":"2026-11-03","account":"chk","amount":-250,"payee":"Shop"}
        """), today: try day(2026, 11, 6), calendar: calendar))
        #expect(over.kept == -150 && over.keptShare == 0)
        #expect(over.caption(locale: us, calendar: calendar) == "Spent more than came in · November")
        // No October to set it against.
        #expect(over.change == nil)

        let none = try #require(CashFlowGlance.make(try transactions(#"{"id":"b","date":"2026-11-03","account":"chk","amount":-25,"payee":"Shop"}"#),
                                                    today: try day(2026, 11, 6), calendar: calendar))
        #expect(none.keptShare == nil)
        #expect(none.caption(locale: us, calendar: calendar) == "Nothing in yet · November")
    }

    @Test func noCardBeforeTheMonthHasATransaction() throws {
        let rows = try transactions(#"{"id":"e","date":"2026-10-02","account":"chk","amount":2000,"payee":"Paycheck"}"#)
        #expect(CashFlowGlance.make(rows, today: try day(2026, 11, 1), calendar: calendar) == nil)
    }

    @Test func noChangeOnceThisMonthKeptNothing() throws {
        let flow = try #require(CashFlowGlance.make(try transactions("""
        {"id":"a","date":"2026-11-02","account":"chk","amount":2150,"payee":"Paycheck"},
        {"id":"b","date":"2026-11-03","account":"chk","amount":-2562.40,"payee":"Rent and more"},
        {"id":"e","date":"2026-10-02","account":"chk","amount":2000,"payee":"Paycheck"},
        {"id":"f","date":"2026-10-03","account":"chk","amount":-600,"payee":"Rent"}
        """), today: try day(2026, 11, 6), calendar: calendar))
        #expect(flow.keptBefore == 1400 && flow.kept < 0)
        // Not "−129.5%": the red figure and its caption say it.
        #expect(flow.change == nil)
    }

    @Test func noChangeWhenLastMonthKeptNothing() throws {
        let flow = try #require(CashFlowGlance.make(try transactions("""
        {"id":"a","date":"2026-11-02","account":"chk","amount":500,"payee":"Paycheck"},
        {"id":"f","date":"2026-10-03","account":"chk","amount":-600,"payee":"Rent"}
        """), today: try day(2026, 11, 6), calendar: calendar))
        #expect(flow.keptBefore == -600)
        #expect(flow.change == nil)
    }
}

/// The redesign's Budgets card on Finances' home: those worth a look first.
@Suite struct BudgetsGlanceTests {
    private func budgets(_ rows: String) throws -> [FinanceBudget] {
        try JSONDecoder.homelab().decode([FinanceBudget].self, from: Data("[\(rows)]".utf8))
    }

    @Test func overThenAheadThenNearlyGoneThenMostUsed() throws {
        let list = try budgets("""
        {"category":"Car","per":"month","amount":300,"spent":48,"left":252,"pace":200},
        {"category":"Food","per":"month","amount":600,"spent":298,"left":302,"pace":400},
        {"category":"Gifts","per":"month","amount":100,"spent":92,"left":8,"pace":95},
        {"category":"Coffee","per":"month","amount":40,"spent":30,"left":10,"pace":20},
        {"category":"Subscriptions","per":"month","amount":150,"spent":200,"left":-50,"pace":100}
        """)
        #expect(BudgetsGlance.top(list).map(\.category) == ["Subscriptions", "Coffee", "Gifts"])
        #expect(BudgetsGlance.top(list, limit: 5).map(\.category) == ["Subscriptions", "Coffee", "Gifts", "Food", "Car"])
    }

    @Test func noneIsNoCard() {
        #expect(BudgetsGlance.top([]).isEmpty)
    }
}

/// Net worth's biggest moves and cash flow's last months, for the full-width cards.
@Suite struct FullCardsTests {
    private func day(_ s: String) throws -> Date { try #require(LocalDay.parse(s)) }

    @Test func theBiggestMovesInDateOrder() throws {
        let series = [NetWorthPoint(date: try day("2026-11-01"), value: 100), NetWorthPoint(date: try day("2026-11-02"), value: 300),
                      NetWorthPoint(date: try day("2026-11-03"), value: 250), NetWorthPoint(date: try day("2026-11-04"), value: 260),
                      NetWorthPoint(date: try day("2026-11-05"), value: 160)]
        let jumps = NetWorthJumps.top(series, count: 2)
        #expect(jumps.map(\.point.value) == [300, 160])
        #expect(jumps.map(\.up) == [true, false])
        #expect(NetWorthJumps.top([series[0]]).isEmpty)
    }

    @Test func eachMonthsKeptAndRate() throws {
        let months = [CashFlowMonth(month: try day("2026-10-01"), income: 4000, spent: 3000),
                      CashFlowMonth(month: try day("2026-11-01"), income: 0, spent: 50)]
        let history = CashFlowHistory.make(months)
        #expect(history.map(\.kept) == [1000, -50])
        #expect(history.map(\.rate) == [0.25, nil])
    }
}
