import Foundation

/// An amount short enough for a half-width card, as the computer's
/// `compact` (web/src/finances/money.ts): "$812", "$9.01k", "$198.1k",
/// "$1.24M", "−$1.5k".
enum CompactMoney {
    static func text(_ value: Double, currency: String, locale: Locale = .current) -> String {
        let a = abs(value)
        let sign = value <= -0.5 ? "−" : ""
        let number: String
        if a >= 1e6 {
            number = String(format: "%.2fM", a / 1e6)
        } else if a >= 1e4 {
            number = String(format: "%.1fk", a / 1e3)
        } else if a >= 1e3 {
            number = String(format: "%.2fk", a / 1e3)
        } else {
            number = String(Int(a.rounded()))
        }
        return sign + symbol(currency, locale: locale) + number
    }

    /// "$" for dollars, "€" for euros, as the locale writes it.
    static func symbol(_ currency: String, locale: Locale) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = locale
        f.currencyCode = currency
        return f.currencySymbol ?? currency
    }
}

/// Cash flow as the redesign's phone picture has it,
/// beside Net worth: this month from the transactions, what came in less
/// what went out, how much of what came in was kept, and the change against
/// last month by the same day. Counted as Cash Flow counts (`CashFlow`): a
/// move between the household's own accounts is neither in nor out.
struct CashFlowGlance: Sendable, Equatable {
    /// The month's first day.
    let month: Date
    let moneyIn: Double
    let moneyOut: Double
    /// Last month by the same day, what was kept; nil when it had no transactions by then.
    let keptBefore: Double?

    var kept: Double { moneyIn - moneyOut }

    /// The share of what came in that was kept, 0 to 1; nil when nothing came in.
    var keptShare: Double? {
        guard moneyIn > 0 else { return nil }
        return min(max(kept / moneyIn, 0), 1)
    }

    /// How much more (plus) or less was kept than last month by the same
    /// day, as a share of it; nil when last month kept nothing by then, so
    /// there's no share to give, and nil when this month has kept nothing,
    /// where "−138%" says less than the red figure and *Spent more than
    /// came in* already do.
    var change: Double? {
        guard let keptBefore, keptBefore >= 0.5, kept >= 0 else { return nil }
        return (kept - keptBefore) / keptBefore
    }

    /// This month to `today`; nil when the month has no transactions yet.
    static func make(_ all: [FinanceTransaction], today: Date, calendar: Calendar = .current) -> CashFlowGlance? {
        guard let month = calendar.dateInterval(of: .month, for: today) else { return nil }
        let counted = all.filter { ($0.to ?? "").isEmpty }
        let now = counted.filter { t in t.date.map { month.contains($0) } ?? false }
        guard !now.isEmpty else { return nil }
        var before: Double?
        if let lastMonth = calendar.date(byAdding: .month, value: -1, to: month.start),
           let days = calendar.range(of: .day, in: .month, for: lastMonth),
           let sameDay = calendar.date(byAdding: .day, value: min(days.count, calendar.component(.day, from: today)) - 1, to: lastMonth),
           let end = calendar.dateInterval(of: .day, for: sameDay)?.end {
            let then = counted.filter { t in t.date.map { $0 >= lastMonth && $0 < end } ?? false }
            if !then.isEmpty { before = then.reduce(0.0) { $0 + $1.amount } }
        }
        let moneyIn = now.filter { $0.amount > 0 }.reduce(0.0) { $0 + $1.amount }
        // abs, not a minus: nothing out is 0, never -0.
        let moneyOut = abs(now.filter { $0.amount < 0 }.reduce(0.0) { $0 + $1.amount })
        return CashFlowGlance(month: month.start, moneyIn: moneyIn, moneyOut: moneyOut, keptBefore: before)
    }

    /// "70% kept · November", "Spent more than came in · November", "Nothing in yet · November".
    func caption(locale: Locale = .current, calendar: Calendar = .current) -> String {
        let name = month.formatted(Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).month(.wide))
        guard moneyIn > 0 else { return "Nothing in yet · \(name)" }
        if kept < 0 { return "Spent more than came in · \(name)" }
        return "\(Int(((keptShare ?? 0) * 100).rounded()))% kept · \(name)"
    }
}

/// The budgets Finances' home shows, as the redesign's Budgets card: those
/// worth a look first, as the computer's Dashboard picks them (Budgets.tsx's
/// `toWatch`: over, then ahead of an even pace, then nine tenths gone), then
/// the most used; at most `limit`.
enum BudgetsGlance {
    static func top(_ budgets: [FinanceBudget], limit: Int = 3) -> [FinanceBudget] {
        func rank(_ b: FinanceBudget) -> Int {
            if b.isOver { return 0 }
            if b.isAhead { return 1 }
            if b.amount > 0, b.spent >= b.amount * 0.9 { return 2 }
            return 3
        }
        func used(_ b: FinanceBudget) -> Double { b.amount > 0 ? b.spent / b.amount : 1 }
        return Array(budgets.enumerated()
            .sorted { (rank($0.element), -used($0.element), $0.offset) < (rank($1.element), -used($1.element), $1.offset) }
            .map(\.element)
            .prefix(max(limit, 0)))
    }
}

/// Net worth's line marked where it moved most: the
/// `count` biggest changes from one point to the next, up in green, down in red.
enum NetWorthJumps {
    struct Jump: Equatable, Identifiable {
        let point: NetWorthPoint
        let up: Bool
        var id: Date { point.date }
    }

    static func top(_ series: [NetWorthPoint], count: Int = 3) -> [Jump] {
        guard series.count >= 2 else { return [] }
        let moves = (1..<series.count).map { (series[$0], series[$0].value - series[$0 - 1].value) }
        return moves.filter { abs($0.1) >= 0.5 }
            .sorted { abs($0.1) > abs($1.1) }
            .prefix(max(count, 0))
            .map { Jump(point: $0.0, up: $0.1 > 0) }
            .sorted { $0.point.date < $1.point.date }
    }
}

/// Cash flow's last months as bars: what each kept,
/// and what share of what came in that was, the savings rate.
enum CashFlowHistory {
    struct Month: Equatable, Identifiable {
        let month: Date
        let kept: Double
        /// Kept as a share of what came in; nil when nothing came in.
        let rate: Double?
        var id: Date { month }
    }

    static func make(_ months: [CashFlowMonth]) -> [Month] {
        months.map { Month(month: $0.month, kept: $0.net, rate: $0.income > 0 ? $0.net / $0.income : nil) }
    }
}
