import Foundation

/// Transactions as the redesign's phone picture (phone-transactions.png)
/// lists them: a day at a time, each day with its total, and over the list
/// how many there are with what came in and what went out.
enum TransactionDays {
    struct Day: Identifiable, Equatable {
        /// The day's start, or `.distantPast` for transactions with no date.
        let day: Date
        var items: [FinanceTransaction]
        var id: Date { day }
    }

    /// The rows in the order given, a group each run of one day.
    static func group(_ items: [FinanceTransaction], calendar: Calendar = .current) -> [Day] {
        var out: [Day] = []
        for t in items {
            let day = t.date.map { calendar.startOfDay(for: $0) } ?? .distantPast
            if out.last?.day == day {
                out[out.count - 1].items.append(t)
            } else {
                out.append(Day(day: day, items: [t]))
            }
        }
        return out
    }

    /// What a transaction did to the money shown: with every account shown,
    /// a move between two of them is nothing; with one, it's in or out of it.
    static func signed(_ t: FinanceTransaction, account: String?) -> Double {
        guard let to = t.to, !to.isEmpty else { return t.amount }
        guard let account else { return 0 }
        return to == account ? -t.amount : t.amount
    }

    struct Line: Equatable {
        let count: Int
        let moneyIn: Double
        let moneyOut: Double
    }

    /// "18 transactions · In +$4,300 · Out −$2,300", as figures.
    static func line(_ shown: [FinanceTransaction], account: String?) -> Line {
        var moneyIn = 0.0, moneyOut = 0.0
        for t in shown {
            let v = signed(t, account: account)
            if v > 0 { moneyIn += v } else { moneyOut -= v }
        }
        return Line(count: shown.count, moneyIn: moneyIn, moneyOut: abs(moneyOut))
    }

    /// A day's total: what its transactions did to the money shown.
    static func total(_ items: [FinanceTransaction], account: String?) -> Double {
        items.reduce(0.0) { $0 + signed($1, account: account) }
    }

    /// "Nov 22", "Nov 22, 2025" in another year, "No date"; a day before
    /// Track from's is "Not counted".
    static func title(_ day: Date, trackFrom: String?, today: Date, calendar: Calendar = .current) -> String {
        if day == .distantPast { return "No date" }
        var style = Date.FormatStyle(locale: calendar.locale ?? .current, calendar: calendar, timeZone: calendar.timeZone).month(.abbreviated).day()
        if calendar.component(.year, from: day) != calendar.component(.year, from: today) { style = style.year() }
        let name = day.formatted(style)
        if let start = LocalDay.parse(trackFrom), day < calendar.startOfDay(for: start) { return name + " · Not counted" }
        return name
    }
}
