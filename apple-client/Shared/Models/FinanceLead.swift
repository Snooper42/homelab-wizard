import Foundation

/// Finances' first card as the redesign's phone picture
/// and the computer's Dashboard (widgets/Now.tsx, `LeadWidget`): what's left
/// in checking on the last day of the next paycheck's period, after its
/// bills; how that compares with the period before; checking each day of the
/// period, a step at each bill; and how many bills come out of checking.
/// The period is `LeftUntil`'s, so the card and the money line agree.
struct FinanceLead: Sendable, Equatable {
    /// Checking on the period's last day, after its bills.
    let left: Double
    /// The period's last day.
    let last: Date?
    /// The bills out of checking in the period (not one paid from a card, not money in), and what they come to.
    let bills: Int
    let owed: Double
    /// Against the period before; nil for the first one.
    let change: Double?
    /// Checking each day of the period, oldest first; a bill's day is marked.
    let days: [Day]

    struct Day: Sendable, Equatable, Identifiable {
        let date: Date
        let balance: Double
        let bill: Bool
        var id: Date { date }
    }

    /// The next paycheck's period, or now's when there's no paycheck ahead (as `LeftUntil`); nil with no periods.
    init?(_ view: FinancesPlanView, calendar: Calendar = Calendar(identifier: .gregorian)) {
        guard !view.periods.isEmpty else { return nil }
        let pick = view.periods.firstIndex { !$0.now && $0.pay != nil } ?? 0
        let period = view.periods[pick]
        left = period.left
        last = period.last
        let out = period.rows.filter { !$0.outside && !$0.into }
        bills = out.count
        owed = out.reduce(0) { $0 + $1.amount }
        change = pick > 0 ? period.left - view.periods[pick - 1].left : nil
        let billDays = Set(out.compactMap(\.dateText))
        var days: [Day] = []
        if let start = period.start, let end = period.last, start <= end {
            var day = start
            while day <= end, days.count < 62 {
                let key = Self.key(day, calendar)
                if let balance = view.dayBalances[key] {
                    days.append(Day(date: day, balance: balance, bill: billDays.contains(key)))
                }
                guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
                day = next
            }
        }
        self.days = days
    }

    /// A day's key in the plan's days (YYYY-MM-DD): the computer's dates, read as noon here (`LocalDay`), so the
    /// calendar here gives each its own date back whatever the time zone.
    static func key(_ date: Date, _ calendar: Calendar) -> String {
        let d = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", d.year ?? 0, d.month ?? 0, d.day ?? 0)
    }

    /// "In checking on Nov 19, after 10 bills".
    func label(locale: Locale = .current) -> String {
        let on = last.map { " on " + $0.formatted(Date.FormatStyle(locale: locale).month(.abbreviated).day()) } ?? ""
        let after = bills == 0 ? "" : bills == 1 ? ", after one bill" : ", after \(bills) bills"
        return "In checking\(on)\(after)"
    }

    /// "$739.77" as "$739" and ".77", the cents set smaller as on the computer; the whole when there are none.
    static func splitCents(_ text: String) -> (whole: String, cents: String) {
        guard let dot = text.lastIndex(of: "."), text.distance(from: dot, to: text.endIndex) == 3,
              text[text.index(after: dot)...].allSatisfy(\.isNumber) else { return (text, "") }
        return (String(text[..<dot]), String(text[dot...]))
    }
}
