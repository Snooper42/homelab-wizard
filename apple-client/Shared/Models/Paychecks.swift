import Foundation

/// Finances › Paychecks (the owner's yes, Nov 19, on the canvas's *Idea:
/// Paychecks*), as the computer's Plan › Paychecks (web/src/finances/Lists.tsx's
/// `Pay`): each person's pay, take-home a paycheck and about a year, how often
/// and into which account, and where the gross goes (what's taken out, and
/// taxes and the rest); then the next paychecks, month by month with what
/// each month brings in all. Read from the view the computer sent (the plan's
/// `people`, the view's `paydays`): no new call.
struct Paychecks: Sendable, Equatable {
    /// A share of a person's gross, for the bar.
    struct Part: Sendable, Equatable {
        enum Kind: Sendable, Equatable { case takeHome, saved, taken, taxes }
        let label: String
        let value: Double
        let kind: Kind
    }

    struct Deduction: Sendable, Equatable {
        let name: String
        let amount: Double
        /// The account it goes into, by name; nil when it's spent (insurance).
        let into: String?
    }

    struct Person: Sendable, Equatable, Identifiable {
        let id: String
        let name: String
        /// Take-home, each paycheck.
        let net: Double
        let gross: Double?
        /// "Every 2 weeks" (`FinanceSchedule.words`).
        let how: String
        /// The account it goes into, by name.
        let into: String
        /// About a year of take-home.
        let perYear: Double
        let deductions: [Deduction]
        /// The bar: take-home, each deduction, taxes and the rest. Empty without a gross.
        let parts: [Part]
    }

    struct Payday: Sendable, Equatable, Identifiable {
        let date: String
        /// Who's paid, by name, with the account when it isn't checking ("Sam (into Savings)").
        let who: [String]
        /// Every check's take-home, wherever it lands.
        let total: Double
        /// "The weekend, from Dec 19": a check paid early.
        let moved: [String]
        var id: String { date }
    }

    struct Month: Sendable, Equatable, Identifiable {
        /// YYYY-MM.
        let month: String
        let paydays: [Payday]
        /// A payday after it was read, so its total is the whole month's.
        let whole: Bool
        var total: Double { paydays.reduce(0) { $0 + $1.total } }
        var id: String { month }
    }

    let people: [Person]
    let months: [Month]

    init(view v: JSONValue) {
        func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
        func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
        func list(_ x: JSONValue?) -> [JSONValue] { if case .array(let a)? = x { return a }; return [] }
        let plan = v["plan"] ?? .object([:])
        let checking = str(v["checking"]) ?? ""
        var accounts: [String: String] = [:]
        for a in list(plan["accounts"]) { if let id = str(a["id"]) { accounts[id] = str(a["name"]) ?? id } }
        var names: [String: String] = [:], intoOf: [String: String] = [:]

        var people: [Person] = []
        for e in list(plan["people"]) {
            let id = str(e["id"]) ?? "", name = str(e["name"]) ?? id
            names[id] = name
            let account = str(e["account"]).flatMap { $0.isEmpty ? nil : $0 } ?? checking
            if account != checking { intoOf[id] = accounts[account] ?? account }
            let net = num(e["net"]) ?? 0
            let schedule = e["schedule"]
            let how = FinanceSchedule(every: str(schedule?["every"]) ?? "", start: str(schedule?["start"])).words
            let deductions = list(e["deductions"]).map {
                Deduction(name: str($0["name"]) ?? "", amount: num($0["amount"]) ?? 0,
                          into: str($0["account"]).flatMap { $0.isEmpty ? nil : (accounts[$0] ?? $0) })
            }
            let gross = num(e["gross"]).flatMap { $0 > 0 ? $0 : nil }
            var parts: [Part] = []
            if let gross {
                let taken = deductions.reduce(0) { $0 + $1.amount }
                parts = [Part(label: "Take-home", value: net, kind: .takeHome)]
                    + deductions.map { Part(label: $0.name, value: $0.amount, kind: $0.into != nil ? .saved : .taken) }
                if gross - net - taken > 0.5 { parts.append(Part(label: "Taxes and the rest", value: gross - net - taken, kind: .taxes)) }
            }
            people.append(Person(id: id, name: name, net: net, gross: gross, how: how,
                                 into: accounts[account] ?? (account.isEmpty ? "checking" : account),
                                 perYear: net * LoanPapers.perMonth(schedule, people: [], checking: "") * 12,
                                 deductions: deductions, parts: parts))
        }
        self.people = people

        // The next ten paydays, and the rest of the last one's month, so each month's total is the whole month.
        let read = list(v["paydays"])
        let lastMonth = read.count > 9 ? str(read[9]["date"]).map { String($0.prefix(7)) } : nil
        let shown = read.enumerated().filter { $0.offset < 10 || str($0.element["date"]).map { String($0.prefix(7)) } == lastMonth }.map(\.element)
        var months: [(month: String, paydays: [Payday])] = []
        for p in shown {
            let date = str(p["date"]) ?? ""
            let who: [String] = list(p["people"]).compactMap { str($0) }.map { id in
                let into = intoOf[id].map { " (into \($0))" } ?? ""
                return (names[id] ?? id) + into
            }
            let moved: [String] = list(p["moved"]).map { m in
                let why = str(m["why"]) ?? ""
                let first = why.prefix(1).uppercased(), rest = String(why.dropFirst())
                guard let from = LocalDay.parse(str(m["from"])) else { return first + rest }
                return first + rest + ", from " + from.formatted(.dateTime.month(.abbreviated).day())
            }
            let day = Payday(date: date, who: who, total: num(p["total"]) ?? num(p["amount"]) ?? 0, moved: moved)
            let month = String(date.prefix(7))
            if months.last?.month == month { months[months.count - 1].paydays.append(day) } else { months.append((month, [day])) }
        }
        let readMonths = read.compactMap { str($0["date"]).map { String($0.prefix(7)) } }
        self.months = months.map { m in Month(month: m.month, paydays: m.paydays, whole: readMonths.contains { $0 > m.month }) }
    }
}
