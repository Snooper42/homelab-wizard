import Foundation

// What the iPhone works out from the ledger and the plan it already has,
// for Cash Flow, Month in Review and Recurring's calendar. Nothing here
// asks the computer anything new.

/// One month's money in and money out.
struct CashFlowMonth: Identifiable, Sendable, Equatable {
    /// The month's first day.
    let month: Date
    /// Money in: what went to an income category.
    let income: Double
    /// Money out: what Spending counts.
    let spent: Double
    var net: Double { income - spent }
    var id: Date { month }
}

enum CashFlow {
    /// What came in during the month holding `month`: every part that went to
    /// an income category, net of anything taken back. Money moved between
    /// the household's own accounts isn't counted.
    static func income(_ transactions: [FinanceTransaction], in month: Date, categories: [FinanceCategory],
                       calendar: Calendar = .current) -> Double {
        guard let range = calendar.dateInterval(of: .month, for: month) else { return 0 }
        var total = 0.0
        for t in transactions where (t.to ?? "").isEmpty {
            guard let date = t.date, range.contains(date) else { continue }
            let parts = t.splits.isEmpty ? [FinanceSplit(category: t.category, amount: t.amount)] : t.splits
            for part in parts where Spending.isIncome(Spending.top(part.category, in: categories), in: categories) {
                total += part.amount
            }
        }
        return max(total, 0)
    }

    /// The `count` months up to the one holding `month`, oldest first.
    static func months(_ transactions: [FinanceTransaction], ending month: Date, count: Int, categories: [FinanceCategory],
                       calendar: Calendar = .current) -> [CashFlowMonth] {
        guard let last = calendar.dateInterval(of: .month, for: month)?.start else { return [] }
        return (0..<max(count, 0)).reversed().compactMap { back in
            guard let start = calendar.date(byAdding: .month, value: -back, to: last) else { return nil }
            let spent = Spending.byCategory(transactions, in: start, categories: categories, calendar: calendar).reduce(0) { $0 + $1.spent }
            return CashFlowMonth(month: start, income: income(transactions, in: start, categories: categories, calendar: calendar), spent: spent)
        }
    }
}

/// A month told back: what was spent and how that compares with the month
/// before, where it went, what came in, and the biggest purchase.
struct MonthReview: Sendable, Equatable {
    struct Category: Identifiable, Sendable, Equatable {
        let name: String
        let spent: Double
        /// The month before, for the same category; 0 when nothing.
        let before: Double
        var change: Double { spent - before }
        var id: String { name }
    }

    let month: Date
    let spent: Double
    /// The month before's total; nil when it had nothing in the ledger.
    let spentBefore: Double?
    let income: Double
    /// How many purchases (money out, not transfers or income).
    let purchases: Int
    /// Largest first, at most five.
    let categories: [Category]
    /// The single largest purchase.
    let biggest: FinanceTransaction?
    /// The category that grew the most against the month before, when one did by a real amount.
    let grewMost: Category?
    /// And the one that shrank the most.
    let shrankMost: Category?

    var saved: Double { income - spent }

    /// Spending against the month before, as a share: +0.12 is 12% more.
    var change: Double? {
        guard let spentBefore, spentBefore > 0 else { return nil }
        return (spent - spentBefore) / spentBefore
    }

    static func make(_ transactions: [FinanceTransaction], month: Date, categories: [FinanceCategory],
                     calendar: Calendar = .current) -> MonthReview {
        let start = calendar.dateInterval(of: .month, for: month)?.start ?? month
        let previous = calendar.date(byAdding: .month, value: -1, to: start) ?? start
        let now = Spending.byCategory(transactions, in: start, categories: categories, calendar: calendar)
        let then = Spending.byCategory(transactions, in: previous, categories: categories, calendar: calendar)
        let thenOf = Dictionary(then.map { ($0.name, $0.spent) }, uniquingKeysWith: { a, _ in a })
        let spent = now.reduce(0) { $0 + $1.spent }
        let spentBefore = then.isEmpty ? nil : then.reduce(0) { $0 + $1.spent }

        // Every category either month had, for what grew and what shrank.
        let names = Set(now.map(\.name)).union(then.map(\.name))
        let nowOf = Dictionary(now.map { ($0.name, $0.spent) }, uniquingKeysWith: { a, _ in a })
        let changes = names.map { Category(name: $0, spent: nowOf[$0] ?? 0, before: thenOf[$0] ?? 0) }
        // Only a change worth saying: $10 and a tenth of what it was.
        let worth: (Category) -> Bool = { abs($0.change) >= 10 && abs($0.change) >= 0.1 * max($0.before, $0.spent) }
        let grew = spentBefore == nil ? nil : changes.filter { $0.change > 0 && worth($0) }.max { $0.change < $1.change }
        let shrank = spentBefore == nil ? nil : changes.filter { $0.change < 0 && worth($0) }.min { $0.change < $1.change }

        let range = calendar.dateInterval(of: .month, for: start)
        let outs = transactions.filter { t in
            guard (t.to ?? "").isEmpty, t.amount < 0, let date = t.date, range?.contains(date) == true else { return false }
            return !Spending.isIncome(Spending.top(t.category, in: categories), in: categories)
        }
        let biggest = outs.min { a, b in a.amount != b.amount ? a.amount < b.amount : a.id < b.id }

        return MonthReview(
            month: start,
            spent: spent,
            spentBefore: spentBefore,
            income: CashFlow.income(transactions, in: start, categories: categories, calendar: calendar),
            purchases: outs.count,
            categories: now.prefix(5).map { Category(name: $0.name, spent: $0.spent, before: thenOf[$0.name] ?? 0) },
            biggest: biggest,
            grewMost: grew,
            shrankMost: shrank
        )
    }

    /// The months the ledger has anything in, oldest first, up to the one holding `latest`.
    static func months(in transactions: [FinanceTransaction], upTo latest: Date, calendar: Calendar = .current) -> [Date] {
        guard let last = calendar.dateInterval(of: .month, for: latest)?.start else { return [] }
        let firsts = Set(transactions.compactMap { t in t.date.flatMap { calendar.dateInterval(of: .month, for: $0)?.start } })
        return firsts.filter { $0 <= last }.sorted()
    }
}

/// One day on Recurring's calendar, and the repeating payments it brings.
struct RecurringDay: Identifiable, Sendable, Equatable {
    let day: Date
    let items: [Item]
    var id: Date { day }

    struct Item: Identifiable, Sendable, Equatable {
        let payment: FinancePayment
        let sort: RecurringItem.Sort
        let amount: Double
        let estimate: Bool
        var id: String { payment.id }
    }
}

extension FinancesPlanView {
    /// Each day in the month holding `month` that a repeating payment lands
    /// on, as the pay periods have them (the computer's own dates), soonest first.
    func recurringCalendar(in month: Date, calendar: Calendar = .current) -> [RecurringDay] {
        guard let range = calendar.dateInterval(of: .month, for: month) else { return [] }
        let sortOf = Dictionary(recurring.map { ($0.payment.id, $0) }, uniquingKeysWith: { a, _ in a })
        var byDay: [Date: [RecurringDay.Item]] = [:]
        var seen = Set<String>()
        for period in periods {
            for row in period.rows {
                guard let date = row.date, range.contains(date), let item = sortOf[row.payment] else { continue }
                let day = calendar.startOfDay(for: date)
                let key = "\(row.payment)|\(day.timeIntervalSince1970)"
                guard seen.insert(key).inserted else { continue }
                byDay[day, default: []].append(.init(payment: item.payment, sort: item.sort, amount: row.amount, estimate: row.estimate))
            }
        }
        return byDay.keys.sorted().map { day in
            RecurringDay(day: day, items: byDay[day, default: []].sorted {
                $0.sort.rawValue != $1.sort.rawValue ? $0.sort.rawValue < $1.sort.rawValue : $0.payment.name < $1.payment.name
            })
        }
    }
}

/// What Transactions shows: everything, money in or out only, or one
/// category or account; with the search as before.
struct TransactionFilter: Equatable, Sendable {
    enum Flow: String, CaseIterable, Sendable { case all, moneyOut, moneyIn }

    var flow: Flow = .all
    /// A category's name (its top, as Spending counts it); nil for all.
    var category: String?
    /// Only transactions of at least this much, either way; nil for any.
    var atLeast: Double?

    var isOn: Bool { flow != .all || category != nil || atLeast != nil }

    func keeps(_ t: FinanceTransaction, categories: [FinanceCategory]) -> Bool {
        switch flow {
        case .all: break
        case .moneyOut: if t.amount >= 0 { return false }
        case .moneyIn: if t.amount <= 0 { return false }
        }
        if let category {
            let names = t.splits.isEmpty ? [t.category] : t.splits.map(\.category)
            if !names.contains(where: { Spending.top($0, in: categories) == category }) { return false }
        }
        if let atLeast, abs(t.amount) < atLeast { return false }
        return true
    }
}

/// What of the household's money the owner shares with a member's phone
/// (`FinancesShared`): names, amounts and days, never an account.
struct HouseholdShared: Decodable, Sendable, Equatable {
    struct Payment: Decodable, Sendable, Equatable, Identifiable {
        let name: String
        let kind: String?
        let institution: String?
        let amount: Double
        let estimate: Bool
        let date: Date?
        let every: String?
        var id: String { "\(name)|\(date?.timeIntervalSince1970 ?? 0)" }

        enum CodingKeys: String, CodingKey { case name, kind, institution, amount, estimate, date, every }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
            kind = try c.decodeIfPresent(String.self, forKey: .kind)
            institution = try c.decodeIfPresent(String.self, forKey: .institution)
            amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
            estimate = try c.decodeIfPresent(Bool.self, forKey: .estimate) ?? false
            date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
            every = try c.decodeIfPresent(String.self, forKey: .every)
        }
    }

    struct Budget: Decodable, Sendable, Equatable, Identifiable {
        let category: String
        let amount: Double
        let spent: Double
        let left: Double
        var id: String { category }
        var share: Double { amount > 0 ? min(max(spent / amount, 0), 1) : 0 }
    }

    let currency: String
    let shares: [String]
    let bills: [Payment]
    let subscriptions: [Payment]
    let budgets: [Budget]

    enum CodingKeys: String, CodingKey { case currency, shares, bills, subscriptions, budgets }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        currency = MoneyCard.currencyCode(try c.decodeIfPresent(String.self, forKey: .currency))
        shares = try c.decodeIfPresent([String].self, forKey: .shares) ?? []
        bills = try c.decodeIfPresent([Payment].self, forKey: .bills) ?? []
        subscriptions = try c.decodeIfPresent([Payment].self, forKey: .subscriptions) ?? []
        budgets = try c.decodeIfPresent([Budget].self, forKey: .budgets) ?? []
    }

    var isEmpty: Bool { bills.isEmpty && subscriptions.isEmpty && budgets.isEmpty }
}
