import Foundation

/// A loan read from its papers, as the computer's Loans shows one
/// (web/src/finances/widgets/Loans.tsx's Papers): how many payments are
/// made, what's paid down of what was borrowed, the next payment split into
/// what pays it down and its interest, who pays it each month, when it's
/// half paid and paid off, and every payment. From the view the computer
/// sent (`loans[].rows`, `made`): nothing is worked out again here.
struct LoanPapers: Sendable, Equatable {
    /// One payment on the papers.
    struct Row: Sendable, Equatable, Identifiable {
        let date: String
        let payment: Double
        let principal: Double
        let interest: Double
        /// What's owed after it.
        let after: Double
        var id: String { date }
    }

    /// A payment in the plan that goes into the loan, a month's worth.
    struct Payer: Sendable, Equatable {
        let name: String
        let amount: Double
    }

    let rows: [Row]
    let made: Int
    /// What's owed now.
    let balance: Double
    /// Interest still to pay, as paid.
    let interest: Double
    /// What was borrowed: every payment's principal.
    let original: Double
    let into: [Payer]
    /// What the papers' payment leaves for someone else, a month.
    let rest: Double

    var down: Double { max(0, original - balance) }
    var share: Double { original > 0 ? down / original : 0 }
    var next: Row? { made < rows.count ? rows[made] : nil }
    var last: Row? { rows.last }
    /// Payments still to make.
    var left: Int { max(0, rows.count - made) }
    /// The payment that leaves half or less owed, when it isn't the first.
    var half: Row? {
        guard let i = rows.firstIndex(where: { $0.after <= original / 2 + 0.005 }), i > 0 else { return nil }
        return rows[i]
    }
    var halfMade: Bool {
        guard let half, let i = rows.firstIndex(of: half) else { return false }
        return i < made
    }
    /// Interest paid with the payments made.
    var paidIn: Double { rows.prefix(made).reduce(0) { $0 + $1.interest } }
    /// Whether to say who pays it: more than one payment, or one and some other way.
    var saysWhoPays: Bool { into.count > 1 || (!into.isEmpty && rest > 0.005) }

    init?(view v: JSONValue, account: String) {
        func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
        func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
        func list(_ x: JSONValue?) -> [JSONValue] { if case .array(let a)? = x { return a }; return [] }
        guard let p = list(v["loans"]).first(where: { str($0["account"]) == account }) else { return nil }
        let rows = list(p["rows"]).compactMap { r -> Row? in
            guard let date = str(r["date"]) else { return nil }
            return Row(date: date, payment: num(r["payment"]) ?? 0, principal: num(r["principal"]) ?? 0,
                       interest: num(r["interest"]) ?? 0, after: num(r["after"]) ?? 0)
        }
        guard !rows.isEmpty else { return nil }
        self.rows = rows
        made = min(max(Int(num(p["made"]) ?? 0), 0), rows.count)
        balance = num(p["balance"]) ?? 0
        interest = num(p["interest"]) ?? 0
        original = rows.reduce(0) { $0 + $1.principal }
        let plan = v["plan"] ?? .object([:])
        let people = list(plan["people"])
        let checking = str(v["checking"]) ?? ""
        into = list(plan["payments"]).filter { str($0["to"]) == account }.map {
            Payer(name: str($0["name"]) ?? "", amount: (num($0["amount"]) ?? 0) * Self.perMonth($0["schedule"], people: people, checking: checking))
        }
        rest = (num(p["monthly"]) ?? 0) - into.reduce(0) { $0 + $1.amount }
    }

    /// How many times a month a schedule comes, as the computer counts it
    /// (money.ts's perMonth): with each paycheck, the person's, or everyone's
    /// paid into checking.
    static func perMonth(_ s: JSONValue?, people: [JSONValue], checking: String) -> Double {
        func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
        let every = str(s?["every"]) ?? ""
        // One that has ended comes no more (Schedule.Until, money.ts's perMonth).
        if let until = str(s?["until"]), !until.isEmpty, until < FinancePlanEdit.todayString() { return 0 }
        if every == "paycheck" {
            if let person = str(s?["person"]), !person.isEmpty {
                return perMonth(people.first { str($0["id"]) == person }?["schedule"], people: [], checking: "")
            }
            return people.filter { str($0["account"]).map { $0.isEmpty || $0 == checking } ?? true }
                .reduce(0) { $0 + perMonth($1["schedule"], people: [], checking: "") }
        }
        switch every {
        case "week": return 52.0 / 12
        case "2 weeks": return 26.0 / 12
        case "twice a month": return 2
        case "month": return 1
        case "3 months": return 1.0 / 3
        case "year": return 1.0 / 12
        default: return 0
        }
    }
}
