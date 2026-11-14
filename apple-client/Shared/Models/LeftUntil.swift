import Foundation

/// What's left, as Finances' first card says it (apple-loop.md item 1, the
/// web's task 15 item 2): checking once the next paycheck is in and the bills
/// it covers are paid, on the last day before the paycheck after it. The home
/// used to lead with checking now and checking the moment the paycheck
/// lands, before its bills, with what's left below the fold.
struct LeftUntil: Sendable, Equatable {
    /// Checking on `day`, after the bills before it.
    let amount: Double
    /// The period's last day, if the computer sent one.
    let day: Date?
    /// The paycheck the period starts with; nil when no paycheck is ahead.
    let pay: FinancePayday?
    /// The first period, up to this one, that ends short or under the cushion.
    let low: Low?

    struct Low: Sendable, Equatable {
        let day: Date?
        let amount: Double
        var short: Bool { amount < 0 }
    }

    /// The next paycheck's period, or now's when there's no paycheck ahead;
    /// nil with no periods at all.
    init?(_ view: FinancesPlanView) {
        guard !view.periods.isEmpty else { return nil }
        let pick = view.periods.firstIndex { !$0.now && $0.pay != nil } ?? 0
        let period = view.periods[pick]
        amount = period.left
        day = period.last
        pay = period.now ? nil : period.pay
        let cushion = view.plan.cushion
        low = view.periods[...pick]
            .first { $0.left < 0 || (cushion > 0 && $0.left < cushion) }
            .map { Low(day: $0.last, amount: $0.left) }
    }

    /// "Left until Nov 19, after the bills".
    func title(locale: Locale = .current) -> String {
        guard let day else { return "Left after the bills" }
        return "Left until \(Self.short(day, locale)), after the bills"
    }

    /// "After Alex's paycheck on Nov 6"; nil with no paycheck ahead.
    func detail(_ view: FinancesPlanView, locale: Locale = .current) -> String? {
        guard let pay else { return nil }
        let whose = view.names(pay.people)
        let on = pay.date.map { " on \(Self.short($0, locale))" } ?? ""
        return "After \(whose.isEmpty ? "the next" : whose + "'s") paycheck\(on)"
    }

    /// "Under your $500 cushion on Thu, Nov 5", or "Short $120 on Thu, Nov 5";
    /// the amounts as the card shows them (`cushion`, and `short`, what it's short by).
    func warning(cushion: String, short: String, locale: Locale = .current) -> String? {
        guard let low else { return nil }
        let on = low.day.map { " on \($0.formatted(Date.FormatStyle(locale: locale).weekday(.abbreviated).month(.abbreviated).day()))" } ?? ""
        return low.short ? "Short \(short)\(on)" : "Under your \(cushion) cushion\(on)"
    }

    private static func short(_ date: Date, _ locale: Locale) -> String {
        date.formatted(Date.FormatStyle(locale: locale).month(.abbreviated).day())
    }
}
