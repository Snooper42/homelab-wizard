import Foundation

/// A loan read from its papers as they're typed in, the same reading as the
/// computer's account form (web/src/finances/payoffPlan.ts's `papers`,
/// `installments`, `oddDays` and `dueOn`, themselves internal/finance's
/// loanpapers.go): each payment from the first, how many fell due before
/// today, and what it owes. The computer's engine keeps the reading once
/// saved; this one only says what it will be.
extension LoanPapers {
    struct Reading: Sendable, Equatable {
        let rows: [Row]
        /// Payments due before today.
        let made: Int
        /// What it owes today.
        let owed: Double
    }

    /// As far as a loan is read: fifty years.
    private static var maxMonths: Int { 600 }

    /// To the cent, as JavaScript's Math.round(x * 100) / 100 (a half cent up).
    static func cents(_ x: Double) -> Double {
        let y = x * 100, down = y.rounded(.down)
        return (y - down >= 0.5 ? down + 1 : down) / 100
    }

    /// The k-th payment day after the first (0 is the first): the same day of the month, or the month's last.
    static func dueOn(_ first: String, _ k: Int) -> String {
        let parts = first.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return first }
        let months = parts[0] * 12 + (parts[1] - 1) + k
        let (y, m) = (months >= 0 ? months / 12 : (months - 11) / 12, ((months % 12) + 12) % 12 + 1)
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
        let last = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
        return String(format: "%04d-%02d-%02d", y, m, min(parts[2], last))
    }

    /// Each payment from the first to the last, `odd` more interest on the first; nil when the payment never keeps up.
    static func installments(first: String, original: Double, rate: Double, monthly: Double, odd: Double = 0) -> [Row]? {
        let r = rate / 1200
        var b = cents(original)
        var out: [Row] = []
        var k = 0
        while b > 0.005 {
            if k >= maxMonths { return nil }
            let interest = cents(cents(b * r) + (k == 0 ? odd : 0))
            var payment = min(monthly, cents(b + interest))
            if payment <= interest { return nil }
            b = cents(b + interest - payment)
            if b > 0 && b < 0.05 {
                payment = cents(payment + b)
                b = 0
            }
            out.append(Row(date: dueOn(first, k), payment: payment, principal: cents(payment - interest), interest: interest, after: b))
            k += 1
        }
        return out
    }

    /// The first payment's interest for the days before it, from the finance charge the papers state.
    static func oddDays(first: String, original: Double, rate: Double, monthly: Double, charge: Double) -> Double {
        func of(_ odd: Double) -> Double {
            guard let rows = installments(first: first, original: original, rate: rate, monthly: monthly, odd: odd) else { return .infinity }
            return cents(rows.reduce(0) { $0 + $1.interest })
        }
        if rate <= 0 || charge <= of(0) + 0.005 { return 0 }
        var lo = 0.0, hi = max(0, min(charge, monthly - (original * rate) / 1200 - 0.01))
        for _ in 0..<60 {
            let mid = (lo + hi) / 2
            if of(mid) < charge { lo = mid } else { hi = mid }
        }
        let a = (lo * 100).rounded(.down) / 100, b = (hi * 100).rounded(.up) / 100
        return abs(of(a) - charge) <= abs(of(b) - charge) ? a : b
    }

    /// A loan from its papers on a day (YYYY-MM-DD): nil when it can't be read
    /// (nothing borrowed, no first payment day, no payment, or one that never pays it off).
    static func reading(original: Double, rate: Double, firstDue: String, term: Int, charge: Double,
                        monthly: Double, today: String) -> Reading? {
        guard original > 0, monthly > 0, firstDue.range(of: #"^\d{4}-\d\d-\d\d$"#, options: .regularExpression) != nil else { return nil }
        let odd = term > 0 && charge > 0 ? oddDays(first: firstDue, original: original, rate: rate, monthly: monthly, charge: charge) : 0
        guard let rows = installments(first: firstDue, original: original, rate: rate, monthly: monthly, odd: odd) else { return nil }
        let made = rows.prefix { $0.date < today }.count
        return Reading(rows: rows, made: made, owed: made > 0 ? rows[made - 1].after : cents(original))
    }
}
