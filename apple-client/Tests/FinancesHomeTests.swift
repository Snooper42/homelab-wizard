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

    @Test func whatRepeats() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-20","checking":"chk","start":{"chk":2400},
         "plan":{"people":[],"cushion":0,"accounts":[{"id":"chk","name":"Everyday","kind":"checking"}],
           "payments":[
             {"id":"netflix","name":"Netflix","kind":"subscriptions","amount":15.49,"schedule":{"every":"month","start":"2026-01-03"}},
             {"id":"rent","name":"Rent","kind":"home","amount":1200,"schedule":{"every":"month","start":"2026-01-01"}},
             {"id":"gym","name":"Gym","amount":10,"schedule":{"every":"week","start":"2026-01-02"}},
             {"id":"visa","name":"Visa","amount":300,"card":"visa","schedule":{"every":"month","start":"2026-01-21"}},
             {"id":"save","name":"To savings","amount":100,"to":"sav","schedule":{"every":"2 weeks","start":"2026-01-02"}},
             {"id":"jamie","name":"Jamie's share","amount":400,"payer":"Jamie","schedule":{"every":"month","start":"2026-01-05"}},
             {"id":"fix","name":"Plumber","amount":250,"schedule":{"every":"once","start":"2026-11-25"}},
             {"id":"odd","name":"Odd","amount":5,"schedule":"not a schedule"}]},
         "periods":[{"now":true,"start":"2026-11-20","carried":2400,"in":0,"out":0,"saved":0,"left":2400,
                     "rows":[{"date":"2026-11-24","payment":"rent","amount":1200},{"date":"2026-11-21","payment":"gym","amount":10}]}]}
        """#.utf8))
        let items = view.recurring
        // Not one-offs, nor a payment whose schedule doesn't read (it still reads itself).
        #expect(items.map(\.id) == ["jamie", "netflix", "gym", "rent", "visa", "save"])
        #expect(items.map(\.sort) == [.moneyIn, .subscriptions, .bills, .bills, .cards, .savings])
        // Soonest first within a sort: the gym before the rent.
        #expect(items[2].next != nil && items[3].next != nil && items[2].next! < items[3].next!)
        // A card payoff's amount isn't what it costs: no monthly figure.
        #expect(items[4].monthly == nil)
        // Weekly: 52 a year, 12 months.
        #expect(abs((items[2].monthly ?? 0) - 10 * 52 / 12) < 0.001)
        // Bills and subscriptions only.
        #expect(abs(view.recurringPerMonth - (15.49 + 1200 + 10 * 52 / 12)) < 0.001)
        #expect(view.plan.payments.contains { $0.id == "odd" && $0.schedule == nil })
        #expect(FinanceSchedule(every: "2 weeks", start: nil).words == "Every 2 weeks")
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

// Spending: money out by category in a month, refunds netted, never
// transfers or money coming in; and a category set from the inbox.
@Suite("Spending")
struct SpendingTests {
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
          {"id":"c","date":"2026-10-04","account":"chk","amount":15,"payee":"Kroger","category":"Groceries","note":"Returned"},
          {"id":"d","date":"2026-10-05","account":"chk","amount":2400,"payee":"Paycheck","category":"Income"},
          {"id":"e","date":"2026-10-06","account":"chk","amount":-500,"payee":"Savings","to":"sav"},
          {"id":"f","date":"2026-10-07","account":"chk","amount":-30,"payee":"Corner shop"},
          {"id":"g","date":"2026-10-08","account":"chk","amount":-60,"payee":"Target","splits":[{"category":"Groceries","amount":-20},{"category":"Home","amount":-40}]},
          {"id":"h","date":"2026-09-20","account":"chk","amount":-80,"payee":"Kroger","category":"Groceries"},
          {"id":"i","date":"2026-10-09","account":"chk","amount":-12,"payee":"Chipotle","category":"Takeout"}
        ]}
        """#.utf8))
    }

    private let categories: [FinanceCategory] = {
        let json = #"[{"name":"Groceries"},{"name":"Gas"},{"name":"Home"},{"name":"Food"},{"name":"Takeout","parent":"Food"},{"name":"Income","income":true}]"#
        return try! JSONDecoder.homelab().decode([FinanceCategory].self, from: Data(json.utf8))
    }()

    @Test func byCategoryInAMonth() throws {
        let october = try #require(calendar.date(from: DateComponents(year: 2026, month: 10, day: 15)))
        let spent = Spending.byCategory(try ledger().transactions, in: october, categories: categories, calendar: calendar)
        // Groceries: 100 − 15 refunded + 20 of the split; Home: the split's 40;
        // Gas 40; no category: 30; Takeout counted under its parent, Food.
        // Not the paycheck, not the move to savings, not September's.
        #expect(spent.map(\.name) == ["Groceries", "Gas", "Home", "Uncategorized", "Food"])
        #expect(spent.map(\.spent) == [105, 40, 40, 30, 12])
    }

    @Test func sixMonthsOldestFirst() throws {
        let october = try #require(calendar.date(from: DateComponents(year: 2026, month: 10, day: 15)))
        let months = Spending.months(try ledger().transactions, ending: october, count: 6, categories: categories, calendar: calendar)
        #expect(months.count == 6)
        #expect(months.map(\.total).suffix(2) == [80, 227])
        #expect(months.first?.total == 0)
    }

    @Test func aCategorysTransactions() throws {
        let october = try #require(calendar.date(from: DateComponents(year: 2026, month: 10, day: 15)))
        let ids = Spending.transactions(try ledger().transactions, in: "Groceries", month: october, categories: categories, calendar: calendar).map(\.id)
        #expect(ids == ["g", "c", "a"])
    }

    @Test func settingACategoryKeepsTheRest() throws {
        let raw = try JSONDecoder().decode(JSONValue.self, from: Data(#"""
        {"rev":"r1","transactions":[
          {"id":"a","date":"2026-10-02","account":"chk","amount":-100,"payee":"Kroger","bankId":"x1","tags":["weekly"]},
          {"id":"t","date":"2026-10-06","account":"chk","amount":-500,"payee":"Savings","to":"sav"},
          {"id":"s","date":"2026-10-08","account":"chk","amount":-60,"payee":"Target","splits":[{"category":"Home","amount":-60}]}
        ]}
        """#.utf8))
        func first(_ ledger: JSONValue?) -> JSONValue? {
            guard case .array(let all)? = ledger?["transactions"] else { return nil }
            return all.first
        }
        let edited = try #require(LedgerEdit.settingCategory(id: "a", to: " Groceries ", in: raw))
        let entry = first(edited)
        #expect(entry?["category"] == .string("Groceries"))
        #expect(entry?["bankId"] == .string("x1"))
        #expect(edited["rev"] == .string("r1"))
        // Cleared with "".
        let cleared = first(LedgerEdit.settingCategory(id: "a", to: "", in: edited))
        #expect(cleared != nil && cleared?["category"] == nil)
        // A transfer, a split one, or one that isn't there: on the computer.
        #expect(LedgerEdit.settingCategory(id: "t", to: "Home", in: raw) == nil)
        #expect(LedgerEdit.settingCategory(id: "s", to: "Home", in: raw) == nil)
        #expect(LedgerEdit.settingCategory(id: "zz", to: "Home", in: raw) == nil)
    }
}
