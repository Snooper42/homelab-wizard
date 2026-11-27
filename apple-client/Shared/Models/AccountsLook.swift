import Foundation

/// Accounts' top card and rows, as the owner's reference pictures:
/// how a line moved over its range, with its share, and how long ago an
/// account's balance was typed in.
enum AccountsLook {
    struct Change: Equatable {
        let amount: Double
        /// Of where the line started; nil when it started at nothing.
        let share: Double?
    }

    /// From the line's first point to its last; nil with fewer than two.
    static func change(_ series: [NetWorthPoint]) -> Change? {
        guard series.count >= 2, let first = series.first?.value, let last = series.last?.value else { return nil }
        let amount = last - first
        return Change(amount: amount, share: abs(first) >= 0.005 ? amount / abs(first) : nil)
    }

    /// "Today", "Yesterday", "3 days ago", else "Nov 12"; nil without a day.
    static func updated(_ day: Date?, today: Date?, calendar: Calendar = .current) -> String? {
        guard let day, let today else { return nil }
        let n = calendar.dateComponents([.day], from: calendar.startOfDay(for: day), to: calendar.startOfDay(for: today)).day ?? 0
        switch n {
        case ...0: return "Today"
        case 1: return "Yesterday"
        case 2...6: return "\(n) days ago"
        default: return day.formatted(.dateTime.month(.abbreviated).day())
        }
    }
}
