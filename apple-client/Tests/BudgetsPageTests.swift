import Foundation
import Testing
@testable import HomelabClient

// Budgets as the computer's (the owner's yes, Nov 21, on the canvas's
// *Idea: Budgets*): each row's period, what's left a day and the pace line;
// a tap to its transactions; Add a Budget and its removal, as the computer's
// Edit budgets keeps them, home or away.
@Suite("Budgets, as the computer's")
struct BudgetsPageTests {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) throws -> Date {
        try #require(calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 9)))
    }

    private func budget(_ json: String) throws -> FinanceBudget {
        try JSONDecoder.homelab().decode(FinanceBudget.self, from: Data(json.utf8))
    }

    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r3","budgets":[
      {"category":"Groceries","amount":600},
      {"category":"Shopping","amount":150,"per":"paycheck","rollover":true}
    ]}
    """#.utf8))

    private func budgets(_ plan: JSONValue?) -> [JSONValue] {
        if case .array(let b)? = plan?["budgets"] { return b }
        return []
    }

    @Test func aRowSaysItsPeriodAndWhatsLeftADay() throws {
        let b = try budget(#"{"category":"Groceries","per":"month","start":"2026-11-01","last":"2026-11-30","amount":650,"rolled":50,"spent":412,"left":238,"pace":420}"#)
        #expect(b.rolled == 50)
        #expect(b.periodWords.hasPrefix("This month, to "))
        // Nov 21 to Nov 30, today's included: ten days.
        let perDay = try #require(b.perDay(today: try day(2026, 11, 21), calendar: calendar))
        #expect(perDay.days == 10)
        #expect(abs(perDay.amount - 23.8) < 0.001)
        // The last day: what's left, today.
        #expect(b.perDay(today: try day(2026, 11, 30), calendar: calendar)?.days == 1)
        // Ended, or nothing left: no per day.
        #expect(b.perDay(today: try day(2026, 12, 1), calendar: calendar) == nil)
        #expect(abs(b.paceShare - 420.0 / 650) < 0.0001)

        let over = try budget(#"{"category":"Shopping","per":"paycheck","start":"2026-11-20","last":"2026-12-03","amount":150,"spent":190.1,"left":-40.1,"pace":82}"#)
        #expect(over.isOver && over.perDay(today: try day(2026, 11, 21), calendar: calendar) == nil)
        #expect(over.periodWords.hasPrefix("This pay period, to "))
        #expect(over.rolled == 0)
    }

    @Test func aTapShowsItsTransactions() throws {
        let b = try budget(#"{"category":"Groceries","per":"month","start":"2026-11-01","last":"2026-11-30","amount":600,"spent":0,"left":600,"pace":0}"#)
        let f = b.transactionsFilter(calendar: calendar)
        #expect(f.category == "Groceries")
        #expect(f.month == calendar.dateInterval(of: .month, for: try day(2026, 11, 15))?.start)
        // A pay period's: every month.
        let paid = try budget(#"{"category":"Shopping","per":"paycheck","start":"2026-11-20","last":"2026-12-03","amount":150,"spent":0,"left":150,"pace":0}"#)
        #expect(paid.transactionsFilter(calendar: calendar).month == nil)

        // The filter finds the category itself as well as a group's own.
        let categories = try JSONDecoder.homelab().decode([FinanceCategory].self, from: Data(#"[{"name":"Food"},{"name":"Groceries","parent":"Food"},{"name":"Eating out","parent":"Food"}]"#.utf8))
        let t = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"{"transactions":[{"id":"g","date":"2026-11-05","account":"chk","amount":-40,"payee":"Green Grocer","category":"Groceries"},{"id":"e","date":"2026-11-06","account":"chk","amount":-12,"payee":"Corner Café","category":"Eating out"}]}"#.utf8)).transactions
        #expect(t.filter { TransactionFilter(category: "Groceries").keeps($0, categories: categories) }.map(\.id) == ["g"])
        #expect(t.filter { TransactionFilter(category: "Food").keeps($0, categories: categories) }.map(\.id) == ["g", "e"])
    }

    @Test func addsOneAsTheComputersFormDoes() throws {
        let edited = try #require(FinancePlanEdit.addingBudget(category: " Coffee ", amount: 60.004, perPaycheck: false, rollover: true, in: plan))
        let list = budgets(edited)
        #expect(list.count == 3)
        #expect(list[2] == .object(["category": .string("Coffee"), "amount": .number(60), "rollover": .bool(true)]))
        #expect(edited["rev"] == .string("r3"))
        let paid = try #require(FinancePlanEdit.addingBudget(category: "Fuel", amount: 80, perPaycheck: true, rollover: false, in: plan))
        #expect(budgets(paid)[2] == .object(["category": .string("Fuel"), "amount": .number(80), "per": .string("paycheck")]))
        // One a category, whatever its case; a category picked; more than nothing.
        #expect(FinancePlanEdit.addingBudget(category: "groceries", amount: 50, perPaycheck: false, rollover: false, in: plan) == nil)
        #expect(FinancePlanEdit.addingBudget(category: "  ", amount: 50, perPaycheck: false, rollover: false, in: plan) == nil)
        #expect(FinancePlanEdit.addingBudget(category: "Coffee", amount: 0.001, perPaycheck: false, rollover: false, in: plan) == nil)
        // The first budget a plan has.
        let none = try JSONDecoder().decode(JSONValue.self, from: Data(#"{"rev":"r1"}"#.utf8))
        #expect(budgets(FinancePlanEdit.addingBudget(category: "Coffee", amount: 60, perPaycheck: false, rollover: false, in: none)).count == 1)
    }

    @Test func removesOne() throws {
        let edited = try #require(FinancePlanEdit.removingBudget(category: "SHOPPING", in: plan))
        #expect(budgets(edited).count == 1)
        #expect(budgets(edited)[0]["category"] == .string("Groceries"))
        // The last one gone: no budgets at all, as the computer keeps none.
        let empty = try #require(FinancePlanEdit.removingBudget(category: "Groceries", in: edited))
        #expect(empty["budgets"] == nil)
        #expect(FinancePlanEdit.removingBudget(category: "Coffee", in: plan) == nil)
    }

    @Test func awayTheyWaitAndReplay() throws {
        // A change to a budget's amount, then its removal: one change, the removal.
        let changes = FinanceChange.adding(.removeBudget(category: "Shopping"),
                                           to: [.budget(category: "shopping", to: 200, was: 150)])
        #expect(changes == [.removeBudget(category: "Shopping")])
        // Added and removed away, replayed on the computer's newest: as it was.
        let replayed = FinanceReplay.replay([.addBudget(category: "Coffee", amount: 60, perPaycheck: false, rollover: false),
                                             .removeBudget(category: "Coffee")], on: plan)
        #expect(budgets(replayed.plan).count == 2)
        #expect(replayed.dropped.isEmpty && replayed.clashes.isEmpty)
        // Removed on another device meanwhile: it can't be removed twice, and is left out.
        let gone = try #require(FinancePlanEdit.removingBudget(category: "Shopping", in: plan))
        #expect(FinanceReplay.replay([.removeBudget(category: "Shopping")], on: gone).dropped == [0])
        // Kept as it was written, so a change made in an older build reads back.
        let kept = try JSONDecoder().decode([FinanceChange].self, from: JSONEncoder().encode(changes))
        #expect(kept == changes)
    }
}
