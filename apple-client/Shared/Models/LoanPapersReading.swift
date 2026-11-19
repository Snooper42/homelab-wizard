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

/// What a loan's papers say, as typed on its page (the account's `original`,
/// `rate`, `firstDue`, `payment`, `term` and `charge`, as the computer's
/// account form keeps them). With them, what it owes is read from the papers
/// each day: no balance to type.
struct LoanPapersTyped: Codable, Sendable, Equatable {
    var original: Double
    /// Interest (APR), % a year.
    var rate: Double
    /// YYYY-MM-DD.
    var firstDue: String
    /// Each payment; nil for what the plan pays into it a month.
    var payment: Double?
    /// The number of payments, if the papers say.
    var term: Int?
    /// The finance charge, if the papers say.
    var charge: Double?

    /// The papers an account holds, or nil when it has none typed in.
    static func of(account id: String, in plan: JSONValue) -> LoanPapersTyped? {
        func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
        guard case .array(let accounts)? = plan["accounts"],
              let a = accounts.first(where: { $0["id"] == .string(id) }),
              case .string(let first)? = a["firstDue"], !first.isEmpty, let original = num(a["original"]), original > 0
        else { return nil }
        return LoanPapersTyped(original: original, rate: num(a["rate"]) ?? 0, firstDue: first, payment: num(a["payment"]),
                               term: num(a["term"]).map { Int($0) }, charge: num(a["charge"]))
    }

    /// What the payments it reads with come to: its own, else the plan's into it.
    func monthly(planMonthly: Double) -> Double {
        if let payment, payment > 0 { return payment }
        return planMonthly
    }

    /// Why they can't be saved, in the computer's form's words; nil when they can.
    func problem(planMonthly: Double, today: String) -> String? {
        if !(original > 0) { return "Type what was borrowed." }
        if LocalDay.parse(firstDue) == nil { return "Pick the day its first payment was due." }
        if (payment ?? 0) < 0 || (charge ?? 0) < 0 { return "Type the payment and the charge without a minus." }
        if !(rate >= 0 && rate <= 100) { return "Type the interest as a percent a year, as 6.5." }
        if (term ?? 0) < 0 { return "The number of payments is a whole number, as 36." }
        if !(monthly(planMonthly: planMonthly) > 0) { return "Type each payment." }
        if reading(planMonthly: planMonthly, today: today) == nil { return "At that payment it is never paid off: check the payment and the rate." }
        return nil
    }

    func reading(planMonthly: Double, today: String) -> LoanPapers.Reading? {
        LoanPapers.reading(original: original, rate: rate, firstDue: firstDue, term: term ?? 0, charge: charge ?? 0,
                           monthly: monthly(planMonthly: planMonthly), today: today)
    }
}

extension LoanPapers {
    /// What the plan pays into an account a month (the computer's form's `planMonthly`), to the cent.
    static func planMonthly(into id: String, plan: JSONValue, checking: String) -> Double {
        guard case .array(let payments)? = plan["payments"] else { return 0 }
        var people: [JSONValue] = []
        if case .array(let p)? = plan["people"] { people = p }
        let sum = payments.filter { $0["to"] == .string(id) }.reduce(0.0) { t, x in
            guard case .number(let amount)? = x["amount"] else { return t }
            return t + amount * perMonth(x["schedule"], people: people, checking: checking)
        }
        return cents(sum)
    }
}

extension FinancePlanEdit {
    /// `plan` with a loan's papers typed in, as the computer's account form
    /// saves them: its papers, and what it owes today from them as its
    /// balance (that day its `updated`, when it changed). Nil when it isn't a
    /// loan in the plan, or the papers can't be read.
    static func settingPapers(of accountID: String, _ p: LoanPapersTyped, planMonthly: Double, today: String, in plan: JSONValue) -> JSONValue? {
        guard p.problem(planMonthly: planMonthly, today: today) == nil, let read = p.reading(planMonthly: planMonthly, today: today),
              case .object(var root) = plan, case .array(var accounts)? = root["accounts"],
              let index = accounts.firstIndex(where: { $0["id"] == .string(accountID) }),
              case .object(var account) = accounts[index], account["kind"] == .string("loan")
        else { return nil }
        func put(_ key: String, _ value: Double?) {
            if let value, value > 0 { account[key] = .number(roundedToCents(value)) } else { account.removeValue(forKey: key) }
        }
        put("original", p.original)
        put("rate", p.rate)
        account["firstDue"] = .string(p.firstDue)
        put("payment", p.payment)
        if let term = p.term, term > 0 { account["term"] = .number(Double(term)) } else { account.removeValue(forKey: "term") }
        put("charge", p.charge)
        let owed = roundedToCents(read.owed)
        if account["balance"] != .number(owed) {
            account["balance"] = .number(owed)
            account["updated"] = .string(today)
        }
        accounts[index] = .object(account)
        root["accounts"] = .array(accounts)
        root["updated"] = .string(today)
        return .object(root)
    }
}
