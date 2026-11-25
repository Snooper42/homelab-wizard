import Foundation

/// Spending this month against last month, day by day, as a line: what had
/// gone out by each day of the month (money out, not moves between your own
/// accounts, as Cash Flow counts it), this month to today and last month
/// whole, and the two compared by the same day.
struct SpendingPace: Sendable, Equatable {
    struct Point: Sendable, Equatable, Identifiable {
        let day: Int
        let total: Double
        var id: Int { day }
    }

    /// This month's first day.
    let month: Date
    let thisMonth: [Point]
    /// Every day of last month; empty when it had no transactions.
    let lastMonth: [Point]
    /// Last month by the same day of the month (its last, when it's shorter); nil without last month.
    let lastByToday: Double?
    let daysInMonth: Int

    var spent: Double { thisMonth.last?.total ?? 0 }
    /// More (plus) or less than last month by the same day.
    var difference: Double? { lastByToday.map { spent - $0 } }

    /// nil when neither month has a transaction.
    static func make(_ all: [FinanceTransaction], today: Date, calendar: Calendar = .current) -> SpendingPace? {
        guard let month = calendar.dateInterval(of: .month, for: today),
              let lastStart = calendar.date(byAdding: .month, value: -1, to: month.start),
              let last = calendar.dateInterval(of: .month, for: lastStart),
              let days = calendar.range(of: .day, in: .month, for: today)?.count,
              let lastDays = calendar.range(of: .day, in: .month, for: lastStart)?.count else { return nil }
        let counted = all.filter { ($0.to ?? "").isEmpty }
        let now = counted.filter { t in t.date.map { month.contains($0) } ?? false }
        let then = counted.filter { t in t.date.map { last.contains($0) } ?? false }
        guard !now.isEmpty || !then.isEmpty else { return nil }
        func byDay(_ rows: [FinanceTransaction], through n: Int) -> [Point] {
            var out = Array(repeating: 0.0, count: n + 1)
            for t in rows where t.amount < 0 {
                guard let date = t.date else { continue }
                let d = calendar.component(.day, from: date)
                if d <= n { out[d] -= t.amount }
            }
            var running = 0.0
            return (1...max(n, 1)).map { d -> Point in running += out[d]; return Point(day: d, total: running) }
        }
        let todayDay = calendar.component(.day, from: today)
        let lastLine = then.isEmpty ? [] : byDay(then, through: lastDays)
        let sameDay = min(todayDay, lastDays)
        return SpendingPace(month: month.start, thisMonth: byDay(now, through: todayDay), lastMonth: lastLine,
                            lastByToday: lastLine.isEmpty ? nil : lastLine[sameDay - 1].total, daysInMonth: max(days, lastDays))
    }
}
