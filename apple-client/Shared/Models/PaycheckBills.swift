import Foundation

/// This paycheck's bills, as two groups: what's still to come out of
/// checking before the next payday (and what that leaves to pay), and what
/// has been paid since the last payday: transactions linked to a planned
/// payment, at what they really came to.
struct PaycheckBills: Equatable {
    struct Bill: Identifiable, Equatable {
        let id: String
        let payment: String
        let amount: Double
        let date: Date?
    }

    /// The last payday (or the period's first day) through the period's last.
    let days: ClosedRange<Date>
    /// Oldest first.
    let upcoming: [Bill]
    /// Newest first.
    let paid: [Bill]

    var leftToPay: Double { upcoming.reduce(0) { $0 + $1.amount } }

    /// nil without a pay period, or with nothing in either group.
    static func make(_ view: FinancesPlanView, transactions: [FinanceTransaction], named: (String) -> Bool = { _ in true },
                     calendar: Calendar = .current) -> PaycheckBills? {
        guard let period = view.periods.first, let last = period.last, let today = view.today else { return nil }
        let first = view.before.first?.date ?? period.start ?? today
        guard first <= last else { return nil }
        let todayStart = calendar.startOfDay(for: today)
        let upcoming = period.rows
            .filter { !$0.outside && !$0.into && $0.amount > 0 && named($0.payment) && ($0.dateText ?? "") >= view.todayText }
            .enumerated()
            .map { Bill(id: "row:\($0.offset)", payment: $0.element.payment, amount: $0.element.amount, date: $0.element.date) }
        let paid = transactions
            .filter { t in
                guard let id = t.payment, !id.isEmpty, named(id), t.amount < 0, let date = t.date else { return false }
                let day = calendar.startOfDay(for: date)
                return day >= calendar.startOfDay(for: first) && day < todayStart
            }
            .sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
            .map { Bill(id: $0.id, payment: $0.payment ?? "", amount: -$0.amount, date: $0.date) }
        guard !upcoming.isEmpty || !paid.isEmpty else { return nil }
        return PaycheckBills(days: first...last, upcoming: upcoming, paid: paid)
    }

    /// "in 4 days" within two weeks, else the day: "Dec 1".
    static func due(_ date: Date?, today: Date, calendar: Calendar = .current) -> String {
        guard let date else { return "" }
        let n = calendar.dateComponents([.day], from: calendar.startOfDay(for: today), to: calendar.startOfDay(for: date)).day ?? 0
        return n <= 14 ? until(date, today: today, calendar: calendar) : date.formatted(.dateTime.month(.abbreviated).day())
    }

    /// "Today", "Tomorrow", "in 4 days".
    static func until(_ date: Date?, today: Date, calendar: Calendar = .current) -> String {
        guard let date else { return "" }
        let n = calendar.dateComponents([.day], from: calendar.startOfDay(for: today), to: calendar.startOfDay(for: date)).day ?? 0
        return n <= 0 ? "Today" : n == 1 ? "Tomorrow" : "in \(n) days"
    }
}
