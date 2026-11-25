import Foundation

// What the iPhone works out from the ledger and the plan it already has,
// for Cash Flow, Month in Review and Recurring's calendar. Nothing here
// asks the computer anything new.

/// One month's money in and money out.
struct CashFlowMonth: Identifiable, Sendable, Equatable {
    /// The month's first day.
    let month: Date
    /// Money in: every transaction that brought money in (a paycheck, a refund).
    let income: Double
    /// Money out: every transaction that took money out.
    let spent: Double
    var net: Double { income - spent }
    var id: Date { month }
}

enum CashFlow {
    /// The `count` months up to the one holding `month`, oldest first, as
    /// the computer's Cash Flow counts them (reportData.ts's byMonth): in is
    /// every transaction that brought money in, out every one that took it
    /// out, whatever its category; a move between the household's own
    /// accounts is neither. (Counting only income categories missed every
    /// paycheck without one: the owner's read $0 in, Nov 16.)
    /// Each Month's bars by name ("2026-10"), one category a month: on a date
    /// axis the chart left the last month's name out, the month shown (main's
    /// pictures, Nov 16, even with the axis run to the month's end).
    static func key(_ month: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month], from: month)
        return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
    }

    /// The name under a month's bars: "Oct".
    static func label(_ key: String) -> String {
        LocalDay.parseMonth(key)?.formatted(.dateTime.month(.abbreviated)) ?? key
    }

    static func months(_ transactions: [FinanceTransaction], ending month: Date, count: Int, categories: [FinanceCategory],
                       calendar: Calendar = .current) -> [CashFlowMonth] {
        guard let last = calendar.dateInterval(of: .month, for: month)?.start else { return [] }
        return (0..<max(count, 0)).reversed().compactMap { back in
            guard let start = calendar.date(byAdding: .month, value: -back, to: last),
                  let range = calendar.dateInterval(of: .month, for: start) else { return nil }
            var moneyIn = 0.0, moneyOut = 0.0
            for t in transactions where (t.to ?? "").isEmpty {
                guard let date = t.date, range.contains(date) else { continue }
                if t.amount > 0 { moneyIn += t.amount } else { moneyOut -= t.amount }
            }
            return CashFlowMonth(month: start, income: moneyIn, spent: moneyOut)
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
    /// What went out, as Cash Flow counts it: every transaction that took
    /// money out, not moves between your own accounts.
    let moneyOut: Double
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

    /// Left over: in less out, as Cash Flow and the computer's Reports say it
    /// (`spent` takes refunds off, which Cash Flow counts as money in).
    var saved: Double { income - moneyOut }

    /// What came in as Money Flow says it: a refund taken off what was spent
    /// rather than counted as money in, so Came in less You spent is Left over
    /// (Month in Review showed $6,732 in and $1,196 spent but $5,504 left over,
    /// a refund counted on both sides; Money Flow says $6,700 in).
    var cameIn: Double { saved + spent }

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
        let flow = CashFlow.months(transactions, ending: start, count: 1, categories: categories, calendar: calendar).first

        return MonthReview(
            month: start,
            spent: spent,
            spentBefore: spentBefore,
            // What came in, as the computer's Reports count it (reportData.ts's totals): every transaction
            // that brought money in, whatever its category, not moves between your own accounts.
            income: flow?.income ?? 0,
            moneyOut: flow?.spent ?? 0,
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
        // The month's days before today, from the computer's due days: its earlier
        // bills have their dots too, not only the days ahead (main's pictures, Nov 16).
        let todayStart = calendar.startOfDay(for: today ?? Date())
        for (id, days) in dues {
            guard let item = sortOf[id] else { continue }
            for text in days {
                guard let date = LocalDay.parse(text), range.contains(date), calendar.startOfDay(for: date) < todayStart else { continue }
                let day = calendar.startOfDay(for: date)
                guard seen.insert("\(id)|\(day.timeIntervalSince1970)").inserted else { continue }
                byDay[day, default: []].append(.init(payment: item.payment, sort: item.sort,
                                                     amount: item.payment.amount ?? 0, estimate: item.payment.estimate ?? false))
            }
        }
        return byDay.keys.sorted().map { day in
            RecurringDay(day: day, items: byDay[day, default: []].sorted {
                $0.sort.rawValue != $1.sort.rawValue ? $0.sort.rawValue < $1.sort.rawValue : $0.payment.name < $1.payment.name
            })
        }
    }
}

/// What Transactions shows, as the computer's filters: everything, money in
/// or out only (moves between the household's own accounts left out, as the
/// computer's), or only those moves; one category, month or tag; or the
/// larger ones only; with the search as before.
struct TransactionFilter: Equatable, Sendable {
    enum Flow: String, CaseIterable, Sendable { case all, moneyOut, moneyIn, betweenAccounts }

    var flow: Flow = .all
    /// A category's name (its top, as Spending counts it); nil for all.
    var category: String?
    /// Only transactions of at least this much, either way; nil for any.
    var atLeast: Double?
    /// A month, by its first day; nil for every month.
    var month: Date?
    /// A pay period's days, first to last (This paycheck, Last paycheck); nil for none.
    var days: ClosedRange<Date>?
    /// One tag; nil for every tag.
    var tag: String?

    var isOn: Bool { flow != .all || category != nil || atLeast != nil || month != nil || days != nil || tag != nil }

    func keeps(_ t: FinanceTransaction, categories: [FinanceCategory], calendar: Calendar = .current) -> Bool {
        let move = !(t.to ?? "").isEmpty
        switch flow {
        case .all: break
        case .moneyOut: if move || t.amount >= 0 { return false }
        case .moneyIn: if move || t.amount <= 0 { return false }
        case .betweenAccounts: if !move { return false }
        }
        if let category {
            let names = t.splits.isEmpty ? [t.category] : t.splits.map(\.category)
            // The category itself, or its group (a budget on Groceries, inside Food, finds Groceries).
            if !names.contains(where: { $0 == category || Spending.top($0, in: categories) == category }) { return false }
        }
        if let atLeast, abs(t.amount) < atLeast { return false }
        if let month {
            guard let date = t.date, calendar.isDate(date, equalTo: month, toGranularity: .month) else { return false }
        }
        if let days {
            guard let date = t.date else { return false }
            let day = calendar.startOfDay(for: date)
            guard day >= calendar.startOfDay(for: days.lowerBound), day <= calendar.startOfDay(for: days.upperBound) else { return false }
        }
        if let tag, !t.tags.contains(tag) { return false }
        return true
    }

    /// The months the transactions fall in, newest first, by their first day:
    /// the Month filter's choices.
    static func months(in transactions: [FinanceTransaction], calendar: Calendar = .current) -> [Date] {
        let firsts = Set(transactions.compactMap { t in t.date.flatMap { calendar.dateInterval(of: .month, for: $0)?.start } })
        return firsts.sorted(by: >)
    }

    /// Every tag on a transaction, A to Z: the Tag filter's choices.
    static func tags(in transactions: [FinanceTransaction]) -> [String] {
        Set(transactions.flatMap(\.tags)).sorted { $0.localizedLowercase < $1.localizedLowercase }
    }

    /// What a filtered list comes to together, as the computer's: a move
    /// between the household's own accounts counts only with one account
    /// picked (out of it, or into it), else it's left out.
    static func together(_ shown: [FinanceTransaction], account: String?) -> Double {
        shown.reduce(0.0) { sum, t in
            guard let to = t.to, !to.isEmpty else { return sum + t.amount }
            guard let account else { return sum }
            return sum + (to == account ? -t.amount : t.amount)
        }
    }

    /// "6 transactions", "1 transaction".
    static func count(_ n: Int) -> String {
        n == 1 ? "1 transaction" : "\(n.formatted()) transactions"
    }
}

/// This month on Transactions, as the computer's *This month* card: what came
/// in, went out and was kept, every account, moves between them left out; and
/// what had gone out by the same day last month (its last, in a shorter month).
struct ThisMonth: Equatable, Sendable {
    let moneyIn: Double
    let moneyOut: Double
    let kept: Double
    let count: Int
    /// The day last month it's set against.
    let lastMonthDay: Date?
    /// What had gone out by `lastMonthDay`; nil when nothing had (no
    /// transactions there to compare with).
    let outBefore: Double?

    static func make(_ all: [FinanceTransaction], today: Date, calendar: Calendar = .current) -> ThisMonth {
        let spent = all.filter { ($0.to ?? "").isEmpty }
        let now = spent.filter { t in t.date.map { calendar.isDate($0, equalTo: today, toGranularity: .month) } ?? false }
        let moneyIn = now.filter { $0.amount > 0 }.reduce(0.0) { $0 + $1.amount }
        // abs, not a minus: nothing out is 0, never -0 ("-$0", main's pictures after #800).
        let moneyOut = abs(now.filter { $0.amount < 0 }.reduce(0.0) { $0 + $1.amount })
        var lastDay: Date?
        var outBefore: Double?
        if let lastMonth = calendar.date(byAdding: .month, value: -1, to: today),
           let days = calendar.range(of: .day, in: .month, for: lastMonth),
           let first = calendar.dateInterval(of: .month, for: lastMonth)?.start {
            let day = min(days.count, calendar.component(.day, from: today))
            if let d = calendar.date(byAdding: .day, value: day - 1, to: first), let end = calendar.dateInterval(of: .day, for: d)?.end {
                lastDay = d
                let before = spent.filter { t in
                    guard let date = t.date else { return false }
                    return date >= first && date < end
                }
                if !before.isEmpty { outBefore = abs(before.filter { $0.amount < 0 }.reduce(0.0) { $0 + $1.amount }) }
            }
        }
        return ThisMonth(moneyIn: moneyIn, moneyOut: moneyOut, kept: moneyIn - moneyOut, count: now.count,
                         lastMonthDay: lastDay, outBefore: outBefore)
    }

    /// How this month's money out compares: nil with nothing to compare;
    /// zero the same (within half a cent); more is plus.
    var outChange: Double? {
        guard let outBefore else { return nil }
        let change = moneyOut - outBefore
        return abs(change) < 0.005 ? 0 : change
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
