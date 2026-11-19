import Foundation
import Testing
@testable import HomelabClient

// Cash Flow, Month in Review, Recurring's calendar and Transactions' filter.
@Suite("Finance insights")
struct FinanceInsightsTests {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func ledger() throws -> FinanceLedger {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"a","date":"2026-10-02","account":"chk","amount":-100,"payee":"Kroger","category":"Groceries"},
          {"id":"b","date":"2026-10-03","account":"chk","amount":-40,"payee":"Shell","category":"Gas"},
          {"id":"d","date":"2026-10-05","account":"chk","amount":2400,"payee":"Paycheck","category":"Income"},
          {"id":"e","date":"2026-10-06","account":"chk","amount":-500,"payee":"Savings","to":"sav"},
          {"id":"g","date":"2026-10-08","account":"chk","amount":-260,"payee":"Best Buy","category":"Shopping"},
          {"id":"h","date":"2026-09-20","account":"chk","amount":-80,"payee":"Kroger","category":"Groceries"},
          {"id":"i","date":"2026-09-21","account":"chk","amount":-200,"payee":"Shell","category":"Gas"},
          {"id":"j","date":"2026-09-05","account":"chk","amount":2300,"payee":"Paycheck","category":"Income"},
          {"id":"k","date":"2026-10-09","account":"chk","amount":-12,"payee":"Chipotle","category":"Takeout"}
        ]}
        """#.utf8))
    }

    private let categories: [FinanceCategory] = {
        let json = #"[{"name":"Groceries"},{"name":"Gas"},{"name":"Shopping"},{"name":"Food"},{"name":"Takeout","parent":"Food"},{"name":"Income","income":true}]"#
        return try! JSONDecoder.homelab().decode([FinanceCategory].self, from: Data(json.utf8))
    }()

    private func day(_ y: Int, _ m: Int, _ d: Int) throws -> Date {
        try #require(calendar.date(from: DateComponents(year: y, month: m, day: d)))
    }

    @Test func cashFlowByMonth() throws {
        let months = CashFlow.months(try ledger().transactions, ending: try day(2026, 10, 15), count: 3, categories: categories, calendar: calendar)
        #expect(months.count == 3)
        #expect(months.map(\.income) == [0, 2300, 2400])
        // October out: 100 + 40 + 260 + 12, not the move to savings.
        #expect(months.map(\.spent) == [0, 280, 412])
        #expect(months.last?.net == 1988)
    }

    /// As the computer's Cash Flow counts a month (reportData.ts's byMonth):
    /// every transaction that brought money in, and every one that took it
    /// out; only a move between the household's own accounts is neither. A
    /// paycheck with no category, or one not marked as income, is money in
    /// (the owner's Cash Flow, Nov 16, read $0 in every month).
    @Test func cashFlowCountsAllMoneyInAsTheComputerDoes() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"p1","date":"2026-10-01","account":"chk","amount":2000,"payee":"Employer"},
          {"id":"p2","date":"2026-10-15","account":"chk","amount":1500,"payee":"Employer","category":"Paycheck"},
          {"id":"r","date":"2026-10-04","account":"chk","amount":20,"payee":"Kroger","category":"Groceries"},
          {"id":"o1","date":"2026-10-02","account":"chk","amount":-100,"payee":"Kroger","category":"Groceries"},
          {"id":"o2","date":"2026-10-03","account":"chk","amount":-40,"payee":"Shell"},
          {"id":"t","date":"2026-10-06","account":"chk","amount":-500,"payee":"Savings","to":"sav"},
          {"id":"t2","date":"2026-10-07","account":"sav","amount":500,"payee":"Savings","to":"chk"}
        ]}
        """#.utf8))
        let months = CashFlow.months(ledger.transactions, ending: try day(2026, 10, 15), count: 2, categories: categories, calendar: calendar)
        #expect(months.map(\.income) == [0, 3520])
        #expect(months.map(\.spent) == [0, 140])
        #expect(months.last?.net == 3380)
        // Month in Review's "came in" the same way (the computer's Reports, totals).
        let review = MonthReview.make(ledger.transactions, month: try day(2026, 10, 15), categories: categories, calendar: calendar)
        #expect(review.income == 3520)
        // And its Left over as Cash Flow's, in less out (main's pictures, Nov 16: $5,536 there, $5,504 on Cash Flow).
        #expect(review.saved == 3380 && review.moneyOut == 140)
    }

    /// Came in, You spent and Left over add up, a refund taken off what was spent
    /// as Money Flow takes it, not counted as money in too.
    @Test func aMonthsThreeNumbersAddUp() throws {
        let refunded = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"p","date":"2026-10-05","account":"chk","amount":2000,"payee":"Paycheck","category":"Income"},
          {"id":"a","date":"2026-10-06","account":"chk","amount":-100,"payee":"Target","category":"Shopping"},
          {"id":"r","date":"2026-10-09","account":"chk","amount":30,"payee":"Target","category":"Shopping"}
        ]}
        """#.utf8))
        let review = MonthReview.make(refunded.transactions, month: try day(2026, 10, 15), categories: categories, calendar: calendar)
        #expect(review.spent == 70)
        #expect(review.saved == 1930)
        #expect(review.cameIn == 2000)
        #expect(review.cameIn - review.spent == review.saved)
    }

    @Test func aMonthToldBack() throws {
        let review = MonthReview.make(try ledger().transactions, month: try day(2026, 10, 15), categories: categories, calendar: calendar)
        #expect(review.spent == 412)
        #expect(review.spentBefore == 280)
        #expect(review.income == 2400)
        #expect(review.saved == 1988)
        #expect(review.purchases == 4)
        #expect(review.biggest?.id == "g")
        #expect(review.categories.map(\.name) == ["Shopping", "Groceries", "Gas", "Food"])
        #expect(review.categories.first { $0.name == "Gas" }?.change == -160)
        // Shopping is new this month (+260); Gas fell the most (−160).
        #expect(review.grewMost?.name == "Shopping")
        #expect(review.shrankMost?.name == "Gas")
        let change = try #require(review.change)
        #expect(abs(change - (412.0 - 280) / 280) < 0.0001)
    }

    @Test func theFirstMonthHasNothingToCompare() throws {
        let review = MonthReview.make(try ledger().transactions, month: try day(2026, 9, 15), categories: categories, calendar: calendar)
        #expect(review.spentBefore == nil)
        #expect(review.change == nil)
        #expect(review.grewMost == nil && review.shrankMost == nil)
    }

    @Test func monthsWithTransactions() throws {
        let months = MonthReview.months(in: try ledger().transactions, upTo: try day(2026, 10, 31), calendar: calendar)
        #expect(months == [try day(2026, 9, 1), try day(2026, 10, 1)])
        let upToSeptember = MonthReview.months(in: try ledger().transactions, upTo: try day(2026, 9, 30), calendar: calendar)
        #expect(upToSeptember == [try day(2026, 9, 1)])
    }

    @Test func theFilter() throws {
        let all = try ledger().transactions
        func ids(_ f: TransactionFilter) -> [String] { all.filter { f.keeps($0, categories: categories) }.map(\.id) }
        #expect(!TransactionFilter().isOn)
        #expect(ids(TransactionFilter(flow: .moneyIn)) == ["d", "j"])
        #expect(ids(TransactionFilter(category: "Food")) == ["k"])
        #expect(ids(TransactionFilter(flow: .moneyOut, atLeast: 100)) == ["a", "e", "g", "i"])
        #expect(TransactionFilter(atLeast: 100).isOn)
    }

    @Test func recurringOnTheCalendar() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","checking":"chk","start":{"chk":2400},
         "plan":{"people":[],"cushion":0,"accounts":[{"id":"chk","name":"Everyday","kind":"checking"}],
           "payments":[
             {"id":"netflix","name":"Netflix","kind":"subscriptions","amount":15.49,"schedule":{"every":"month"}},
             {"id":"rent","name":"Rent","amount":1200,"schedule":{"every":"month"}},
             {"id":"pay","name":"Paycheck","amount":2400,"schedule":{"every":"2 weeks"},"payer":"me"},
             {"id":"tv","name":"New TV","amount":900,"schedule":{"every":"once"}}]},
         "periods":[
           {"now":true,"start":"2026-11-20","last":"2026-11-30","carried":0,"in":0,"out":0,"saved":0,"left":0,
            "rows":[{"date":"2026-11-24","payment":"rent","amount":1200},
                    {"date":"2026-11-24","payment":"netflix","amount":15.49},
                    {"date":"2026-11-27","payment":"pay","amount":2400,"into":true},
                    {"date":"2026-11-28","payment":"tv","amount":900}]},
           {"start":"2026-12-01","last":"2026-12-14","carried":0,"in":0,"out":0,"saved":0,"left":0,
            "rows":[{"date":"2026-12-03","payment":"netflix","amount":15.49}]}]}
        """#.utf8))
        let today = try #require(view.today)
        let days = view.recurringCalendar(in: today)
        // Not the one-off TV, not December's.
        #expect(days.count == 2)
        #expect(days.first?.items.map(\.payment.id) == ["netflix", "rent"])
        #expect(days.last?.items.map(\.sort) == [.moneyIn])
    }

    /// A month's days before today come from the computer's due days
    /// (`dues`), so its earlier bills have their dots: not a one-off, not
    /// a day ahead twice, nothing from another month (Nov 16).
    @Test func recurringMarksTheMonthsEarlierBills() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","checking":"chk","start":{"chk":2400},
         "plan":{"people":[],"cushion":0,"accounts":[{"id":"chk","name":"Everyday","kind":"checking"}],
           "payments":[
             {"id":"netflix","name":"Netflix","kind":"subscriptions","amount":15.49,"schedule":{"every":"month"}},
             {"id":"rent","name":"Rent","amount":1200,"schedule":{"every":"month"}},
             {"id":"tv","name":"New TV","amount":900,"schedule":{"every":"once"}}]},
         "periods":[
           {"now":true,"start":"2026-11-20","last":"2026-11-30","carried":0,"in":0,"out":0,"saved":0,"left":0,
            "rows":[{"date":"2026-11-24","payment":"netflix","amount":15.49}]}],
         "dues":{"netflix":["2026-10-24","2026-11-03","2026-11-24"],"rent":["2026-11-03"],"tv":["2026-11-05"]}}
        """#.utf8))
        let today = try #require(view.today)
        let days = view.recurringCalendar(in: today)
        #expect(days.count == 2)
        #expect(days.first?.items.map(\.payment.id) == ["netflix", "rent"])
        #expect(days.first?.items.first?.amount == 15.49)
        #expect(days.last?.items.map(\.payment.id) == ["netflix"])
    }
}
