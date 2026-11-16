import Foundation

/// The money flow, as the computer's (web/src/finances/flowData.ts): where
/// a month's money came from, through all of it together, to taxes,
/// spending and saving, and on to each kind of spending and each account it
/// was saved in. A real month reads the ledger (`month`); a typical month
/// the plan (`typical`). Made here from what was read: no new call.
struct FinanceFlow: Sendable, Equatable {
    /// What a box stands for, for its colour.
    enum Role: Sendable, Equatable {
        case source, accounts, total, taxes, expenses, spending, saved, savedInto, cash
    }

    struct Node: Sendable, Equatable, Identifiable {
        let id: String
        let label: String
        var value: Double
        /// 0 where it comes from, 1 all of it, 2 taxes, spending and saved, 3 each kind and where it was saved.
        let col: Int
        let role: Role
    }

    struct Link: Sendable, Equatable {
        let from: String
        let to: String
        let value: Double
    }

    let nodes: [Node]
    let links: [Link]
    let income: Double
    let taxes: Double
    let expenses: Double
    /// What's left of the income: put in savings, or kept as cash; less than nothing when the month took more.
    let saved: Double

    // MARK: Reading the view

    private static func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
    private static func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
    private static func list(_ x: JSONValue?) -> [JSONValue] { if case .array(let a)? = x { return a }; return [] }
    private static func bool(_ x: JSONValue?) -> Bool { if case .bool(true)? = x { return true }; return false }

    /// Money into an account of this kind is kept, not spent (money.ts's saving).
    static func saving(_ kind: String?) -> Bool { kind == "savings" || kind == "investment" || kind == "retirement" }

    /// The computer's names for a payment's kind (model.ts's kindName).
    static func kindName(_ kind: String) -> String {
        ["home": "Home", "utilities": "Utilities", "car": "Car", "subscriptions": "Subscriptions", "loans": "Loans",
         "cards": "Cards", "spending": "Spending", "savings": "Saving", "other": "Other"][kind] ?? kind
    }

    /// Taxes: a category, or its group, named for them.
    static func taxing(_ name: String) -> Bool {
        name.range(of: #"\btax(es)?\b"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// The months the ledger has transactions in, newest first ("yyyy-MM").
    /// The ledger as Track from counts it (`trackFrom`, YYYY-MM-DD): the
    /// transactions dated before that day left out, so a month it starts in
    /// is counted from it, not whole. Nil or "" leaves it as it is.
    static func counted(_ ledger: JSONValue?, from day: String?) -> JSONValue? {
        guard let day, !day.isEmpty, case .object(var root)? = ledger else { return ledger }
        root["transactions"] = .array(list(ledger?["transactions"]).filter { (str($0["date"]) ?? "") >= day })
        return .object(root)
    }

    static func ledgerMonths(_ ledger: JSONValue?) -> [String] {
        Array(Set(list(ledger?["transactions"]).compactMap { str($0["date"]).map { String($0.prefix(7)) } })).sorted(by: >)
    }

    /// Nodes in order of value, largest first, the same values in the order they came (JavaScript's sort is stable).
    private static func sortedByValue(_ nodes: [Node]) -> [Node] {
        nodes.enumerated().sorted { a, b in a.element.value != b.element.value ? a.element.value > b.element.value : a.offset < b.offset }.map(\.element)
    }

    /// Keeps the largest top of a column's nodes, the rest as one Other.
    private static func topOf(_ nodes: [Node], top: Int, id: String, role: Role) -> [Node] {
        let sorted = sortedByValue(nodes)
        guard top > 0, sorted.count > top else { return sorted }
        let kept = Array(sorted.prefix(top - 1)), rest = Array(sorted.dropFirst(top - 1))
        return kept + [Node(id: id, label: "Other (\(rest.count))", value: rest.reduce(0) { $0 + $1.value }, col: rest[0].col, role: role)]
    }

    /// The flow from its pieces: sources into all of it, it out to taxes, spending and saved, those on to their own.
    private init(sources: [Node], taxes: Node?, spend: [Node], kept: [Node], top: Int) {
        func sum(_ ns: [Node]) -> Double { ns.reduce(0) { $0 + $1.value } }
        let income = sum(sources), tax = taxes?.value ?? 0, expenses = sum(spend)
        let saved = income - tax - expenses
        let into = kept.filter { $0.value > 0.005 }
        let moved = sum(into)
        // What went into savings went, saved or not: more out than in, the rest came out of what the accounts held.
        let short = tax + expenses + moved - income
        var nodes: [Node] = [], links: [Link] = []
        var srcs = Self.topOf(sources.filter { $0.value > 0.005 }, top: top, id: "src:other", role: .source)
        if short > 0.005 { srcs.append(Node(id: "src:accounts", label: "From your accounts", value: short, col: 0, role: .accounts)) }
        nodes += srcs
        nodes.append(Node(id: "total", label: "Total income", value: sum(srcs), col: 1, role: .total))
        links += srcs.map { Link(from: $0.id, to: "total", value: $0.value) }
        if let taxes, tax > 0.005 {
            nodes.append(taxes)
            links.append(Link(from: "total", to: taxes.id, value: tax))
        }
        let kinds = Self.topOf(spend.filter { $0.value > 0.005 }, top: top, id: "cat:other", role: .spending)
        if expenses > 0.005 {
            nodes.append(Node(id: "expenses", label: "Expenses", value: expenses, col: 2, role: .expenses))
            links.append(Link(from: "total", to: "expenses", value: expenses))
            for k in kinds {
                nodes.append(k)
                links.append(Link(from: "expenses", to: k.id, value: k.value))
            }
        }
        // Saved: each account it went into, and the rest, which stayed where it came in.
        let stays = saved - moved
        let outs = into + (stays > 0.005 ? [Node(id: "kept:cash", label: "Kept as cash", value: stays, col: 3, role: .cash)] : [])
        let savings = sum(outs)
        if savings > 0.005 {
            nodes.append(Node(id: "saved", label: "Savings", value: savings, col: 2, role: .saved))
            links.append(Link(from: "total", to: "saved", value: savings))
            for o in outs {
                nodes.append(o)
                links.append(Link(from: "saved", to: o.id, value: o.value))
            }
        }
        self.nodes = nodes
        self.links = links
        self.income = income
        self.taxes = tax
        self.expenses = expenses
        self.saved = saved
    }

    /// Adds to a node by id, keeping the order they first came in (a JavaScript Map's).
    private struct Ordered {
        var nodes: [Node] = []
        mutating func add(_ id: String, _ label: String, col: Int, role: Role, _ value: Double) {
            if let i = nodes.firstIndex(where: { $0.id == id }) { nodes[i].value += value } else {
                nodes.append(Node(id: id, label: label, value: value, col: col, role: role))
            }
        }
    }

    /// A real month, from the ledger: money in by its category (or payee),
    /// taxes, spending by top category (a refund taking off its own), and
    /// what's left, into each savings account it was moved to and the rest
    /// kept as cash. A move between the household's own accounts is neither
    /// in nor out; one into savings is where the saved went.
    static func month(view v: JSONValue, ledger: JSONValue?, month: String, top: Int = 8) -> FinanceFlow {
        let plan = v["plan"] ?? .object([:])
        var byName: [String: JSONValue] = [:]
        for c in list(v["categories"]) { if let n = str(c["name"]) { byName[n.lowercased()] = byName[n.lowercased()] ?? c } }
        func groupOf(_ name: String) -> String {
            let c = byName[name.lowercased()]
            return str(c?["parent"]).flatMap { $0.isEmpty ? nil : $0 } ?? str(c?["name"]) ?? (name.isEmpty ? "No category" : name)
        }
        func incomeCat(_ name: String) -> Bool {
            guard let c = byName[name.lowercased()] else { return false }
            if bool(c["income"]) { return true }
            guard let parent = str(c["parent"]), !parent.isEmpty else { return false }
            return bool(byName[parent.lowercased()]?["income"])
        }
        var kinds: [String: String] = [:], rates: [String: Double] = [:], rateOf: [String: Double] = [:]
        if case .object(let r)? = plan["rates"] { for (k, x) in r { if let n = num(x) { rates[k.uppercased()] = n } } }
        for a in list(plan["accounts"]) {
            guard let id = str(a["id"]) else { continue }
            kinds[id] = str(a["kind"])
            rateOf[id] = str(a["currency"]).flatMap { rates[$0.uppercased()] } ?? 1
        }
        func home(_ n: Double, _ account: String) -> Double {
            guard !rates.isEmpty, let r = rateOf[account], r != 1 else { return n }
            return (n * r * 100).rounded() / 100
        }
        var src = Ordered(), spend = Ordered(), into = Ordered()
        var names: [String: String] = [:]
        for a in list(plan["accounts"]) { if let id = str(a["id"]) { names[id] = str(a["name"]) ?? id } }
        var tax: Node?
        for t in list(ledger?["transactions"]) where str(t["date"])?.hasPrefix(month) == true {
            let account = str(t["account"]) ?? ""
            let amount = home(num(t["amount"]) ?? 0, account)
            if let to = str(t["to"]), !to.isEmpty {
                // Moved into savings: saved there; moved back out of it, less so.
                let toSaving = saving(kinds[to]), fromSaving = saving(kinds[account])
                if toSaving != fromSaving {
                    let acct = toSaving ? to : account
                    into.add("kept:" + acct, names[acct] ?? acct, col: 3, role: .savedInto, toSaving ? -amount : amount)
                }
                continue
            }
            let splits = list(t["splits"])
            let parts: [(category: String, amount: Double)] = splits.isEmpty
                ? [(str(t["category"]) ?? "", amount)]
                : splits.map { (str($0["category"]) ?? "", home(num($0["amount"]) ?? 0, account)) }
            for p in parts {
                if p.amount > 0, p.category.isEmpty || incomeCat(p.category) {
                    // Money in: by its own category under Income, else who paid it.
                    let underIncome = !p.category.isEmpty && (str(byName[p.category.lowercased()]?["parent"]).map { !$0.isEmpty } ?? false)
                    let payee = str(t["payee"]) ?? ""
                    let name = underIncome ? p.category : (!payee.isEmpty ? payee : (!p.category.isEmpty ? p.category : "Money in"))
                    src.add("src:" + name.lowercased(), name, col: 0, role: .source, p.amount)
                    continue
                }
                let g = groupOf(p.category)
                if taxing(g) || taxing(p.category) {
                    var n = tax ?? Node(id: "taxes", label: "Taxes", value: 0, col: 2, role: .taxes)
                    n.value -= p.amount
                    tax = n
                    continue
                }
                spend.add("cat:" + g.lowercased(), g, col: 3, role: .spending, -p.amount)
            }
        }
        if let t = tax, t.value < 0 { tax = nil }
        return FinanceFlow(sources: src.nodes, taxes: tax, spend: spend.nodes, kept: into.nodes, top: top)
    }

    /// A typical month, from the plan: each person's pay (before taxes,
    /// when their gross pay is typed in) and money in from someone; taxes,
    /// what's taken from pay that isn't saved, each kind of payment, and
    /// what's saved, into each account and the rest kept as cash.
    static func typical(view v: JSONValue, top: Int = 8) -> FinanceFlow {
        let plan = v["plan"] ?? .object([:])
        let people = list(plan["people"])
        let checking = str(v["checking"]) ?? ""
        var kinds: [String: String] = [:], names: [String: String] = [:]
        for a in list(plan["accounts"]) {
            guard let id = str(a["id"]) else { continue }
            kinds[id] = str(a["kind"])
            names[id] = str(a["name"]) ?? id
        }
        func kept(_ id: String?) -> Bool { saving(kinds[id ?? ""]) }
        var src: [Node] = [], spend = Ordered(), into = Ordered()
        var taxes = 0.0
        for e in people {
            let id = str(e["id"]) ?? "", name = str(e["name"]) ?? id
            let each = LoanPapers.perMonth(e["schedule"], people: [], checking: "")
            let ded = list(e["deductions"])
            let fromPay = ded.reduce(0) { $0 + (num($1["amount"]) ?? 0) }
            let net = num(e["net"]) ?? 0
            let gross = num(e["gross"]).flatMap { $0 >= net + fromPay ? $0 : nil } ?? net + fromPay
            src.append(Node(id: "src:" + id, label: "\(name)'s pay", value: gross * each, col: 0, role: .source))
            let tax = (gross - net - fromPay) * each
            if tax > 0.005 { taxes += tax }
            for d in ded {
                let amount = (num(d["amount"]) ?? 0) * each
                if let account = str(d["account"]), kept(account) {
                    into.add("kept:" + account, names[account] ?? account, col: 3, role: .savedInto, amount)
                } else {
                    spend.add("cat:frompay", "Taken from pay", col: 3, role: .spending, amount)
                }
            }
        }
        // The plan's payments, and each card paid off with each paycheck (money.ts's allPayments).
        var payments = list(plan["payments"])
        for a in list(plan["accounts"]) where str(a["kind"]) == "card" && bool(a["paidEach"]) {
            guard let id = str(a["id"]) else { continue }
            payments.append(.object(["id": .string("card:" + id), "name": a["name"] ?? .string(id), "amount": a["spend"] ?? .number(0),
                                     "kind": .string("cards"), "card": .string(id), "schedule": .object(["every": .string("paycheck")])]))
        }
        for x in payments {
            let each = (num(x["amount"]) ?? 0) * LoanPapers.perMonth(x["schedule"], people: people, checking: checking)
            let pid = str(x["id"]) ?? "", pname = str(x["name"]) ?? pid
            if let payer = str(x["payer"]), !payer.isEmpty {
                src.append(Node(id: "src:pay:" + pid, label: "\(pname), from \(payer)", value: each, col: 0, role: .source))
                continue
            }
            let from = str(x["from"]) ?? "", to = str(x["to"]) ?? ""
            let onCard = kinds[from] == "card"
            if !(from.isEmpty || from == checking || onCard) || (!to.isEmpty && to == checking) { continue }
            if kept(to) {
                into.add("kept:" + to, names[to] ?? to, col: 3, role: .savedInto, each)
            } else {
                let kind = str(x["kind"]).flatMap { $0.isEmpty ? nil : $0 } ?? "other"
                spend.add("kind:" + kind, kindName(kind), col: 3, role: .spending, each)
            }
        }
        let taxNode = taxes > 0.005 ? Node(id: "taxes", label: "Taxes", value: taxes, col: 2, role: .taxes) : nil
        return FinanceFlow(sources: src, taxes: taxNode, spend: spend.nodes, kept: into.nodes, top: top)
    }
}
