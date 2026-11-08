import Foundation
import Testing
@testable import HomelabClient

// Finances' home: net worth's line and this month's change from the
// accounts' kept balances, and the next bill in words.
@Suite("Finances home")
struct FinancesHomeTests {
    private let json = #"""
    {"today":"2026-11-20","checking":"chk","start":{"chk":2400,"sav":10000},
     "plan":{"people":[],
             "accounts":[{"id":"chk","name":"Everyday","kind":"checking","balance":2400,
                          "history":[{"date":"2026-08-01","amount":1000},{"date":"2026-10-01","amount":2000},{"date":"2026-11-01","amount":2200}]},
                         {"id":"sav","name":"Rainy day","kind":"savings","balance":10000,"history":[{"date":"2026-11-01","amount":9000}]}],
             "payments":[{"id":"rent","name":"Rent","amount":1200,"schedule":{}},{"id":"move","name":"To savings","amount":100,"schedule":{}},
                         {"id":"gift","name":"Gift","amount":50,"schedule":{},"payer":"Grandma"}],
             "cushion":0},
     "periods":[{"now":true,"start":"2026-11-20","last":"2026-11-30","carried":2400,"in":0,"out":1200,"saved":0,"left":1200,
                 "rows":[{"date":"2026-11-21","payment":"move","amount":100,"outside":true},
                         {"date":"2026-11-22","payment":"gift","amount":50,"into":true},
                         {"date":"2026-11-24","payment":"rent","amount":1200}]}]}
    """#

    @Test func netWorthsLine() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        let series = view.netWorthSeries(days: 92)
        // Aug 1 is more than 92 days back; Oct 1 and Nov 1 from the kept balances
        // (savings had none on Oct 1, so its first), then today from the start of today.
        #expect(series.map(\.value) == [11000, 11200, 12400])
        #expect(series.last?.date == view.today)
        #expect(view.netWorthThisMonth == 1200)
    }

    @Test func noKeptBalancesNoChange() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","start":{"a":5},"plan":{"people":[],"accounts":[{"id":"a","name":"A","kind":"checking","balance":5}],"payments":[],"cushion":0},"periods":[]}
        """#.utf8))
        #expect(view.netWorthThisMonth == nil)
        #expect(view.netWorthSeries(days: 92).count == 1)
    }

    @Test func theNextBill() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        // Not money between the household's own accounts, nor money coming in.
        let words = try #require(FinancesView.nextBill(view))
        #expect(words.hasPrefix("Rent on "))
        let none = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","plan":{"people":[],"accounts":[],"payments":[],"cushion":0},"periods":[]}
        """#.utf8))
        #expect(FinancesView.nextBill(none) == nil)
        // Coming up: soonest first, the same rule.
        #expect(FinancesView.upcomingBills(view, limit: 4).map(\.payment) == ["rent"])
    }

    @Test func accountsBySort() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","start":{"chk":2400,"sav":10000,"visa":500,"car":18000,"rav":21000,"x":7},
         "plan":{"people":[],"payments":[],"cushion":0,"accounts":[
           {"id":"visa","name":"Visa","kind":"card"},{"id":"sav","name":"Rainy day","kind":"savings"},
           {"id":"chk","name":"Everyday","kind":"checking"},{"id":"car","name":"Car loan","kind":"loan"},
           {"id":"rav","name":"RAV4","kind":"car"},{"id":"x","name":"Odd","kind":"something new"}]},
         "periods":[]}
        """#.utf8))
        let groups = view.accountGroups
        #expect(groups.map(\.title) == ["Cash", "Credit Cards", "Loans", "Property and Other"])
        #expect(groups[0].accounts.map(\.id) == ["chk", "sav"])
        #expect(groups[0].total == 12400)
        // A kind the app doesn't know yet still shows, with property.
        #expect(groups[3].accounts.map(\.id) == ["rav", "x"])
        #expect(view.assets == 33407)
        #expect(view.liabilities == 18500)
        #expect(view.netWorth == 33407 - 18500)
    }
}

// The top of the Budgets page: what's left in all, and about how much a day.
@Suite("Budgets in all")
struct BudgetsTotalTests {
    private func budgets(_ json: String) throws -> [FinanceBudget] {
        try JSONDecoder.homelab().decode([FinanceBudget].self, from: Data(json.utf8))
    }

    @Test func leftAndADay() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let today = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 21, hour: 12)))
        let list = try budgets(#"""
        [{"category":"Groceries","per":"month","amount":600,"spent":400,"left":200,"pace":420},
         {"category":"Eating out","per":"month","amount":150,"spent":190,"left":-40,"pace":105}]
        """#)
        let total = BudgetsTotal(list, today: today, calendar: calendar)
        #expect(total.amount == 750 && total.spent == 590 && total.left == 160)
        // November has 30 days: the 21st to the 30th is 10 days.
        #expect(total.perDay == 16)
        #expect(!total.isOver && abs(total.share - 590.0 / 750.0) < 1e-9)
        // A budget by pay period: no day's worth, its days differ.
        let mixed = try budgets(#"[{"category":"Fun","per":"paycheck","amount":100,"spent":10,"left":90,"pace":50}]"#)
        #expect(BudgetsTotal(mixed, today: today, calendar: calendar).perDay == nil)
        #expect(BudgetsTotal([], today: today, calendar: calendar).perDay == nil)
    }
}
