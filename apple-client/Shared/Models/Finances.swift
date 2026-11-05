import Foundation

/// What a device may do with Finances (`companion.Finances*`). It's set per
/// device on the computer, apart from `canChange`, and the computer checks
/// it on every call. Finances also need the encrypted link, which is the
/// only kind this client uses.
enum FinancesLevel: String, Sendable, Comparable {
    case none = ""
    /// A wall screen: the next payday, what's left after it, the next bills.
    case card
    case view
    case edit

    init(_ raw: String?) {
        self = FinancesLevel(rawValue: (raw ?? "").lowercased()) ?? .none
    }

    private var rank: Int {
        switch self {
        case .none: 0
        case .card: 1
        case .view: 2
        case .edit: 3
        }
    }

    static func < (a: FinancesLevel, b: FinancesLevel) -> Bool { a.rank < b.rank }
}

/// The money card (`finance.Wall`, the `FinancesWall` call). It holds a
/// few facts and never the plan. With Hide amounts on, the computer
/// zeroes every amount before sending.
struct MoneyCard: Decodable, Sendable, Equatable {
    /// The next paycheck's day, nil with none ahead.
    let payday: Date?
    /// Who is paid that day.
    let who: [String]
    /// What's left in checking once that paycheck's stretch has paid its bills.
    let left: Double
    /// The next bills, soonest first.
    let bills: [MoneyBill]
    /// Hide amounts is on: every amount here is 0, so show none.
    let hidden: Bool
    /// ISO 4217; USD when the plan has none.
    let currency: String

    enum CodingKeys: String, CodingKey { case payday, who, left, bills, hidden, currency }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        payday = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .payday))
        who = (try c.decodeIfPresent([String].self, forKey: .who) ?? []).filter { !$0.isEmpty }
        left = try c.decodeIfPresent(Double.self, forKey: .left) ?? 0
        bills = try c.decodeIfPresent([MoneyBill].self, forKey: .bills) ?? []
        hidden = try c.decodeIfPresent(Bool.self, forKey: .hidden) ?? false
        currency = Self.currencyCode(try c.decodeIfPresent(String.self, forKey: .currency))
    }

    /// A three-letter code, as the computer keeps it, or USD.
    static func currencyCode(_ raw: String?) -> String {
        let code = (raw ?? "").trimmingCharacters(in: .whitespaces).uppercased()
        guard code.count == 3, code.unicodeScalars.allSatisfy({ $0.value >= 65 && $0.value <= 90 }) else { return "USD" }
        return code
    }
}

struct MoneyBill: Decodable, Sendable, Equatable, Identifiable {
    let name: String
    let institution: String?
    let date: Date?
    let amount: Double

    var id: String { "\(name)|\(date?.timeIntervalSince1970 ?? 0)" }

    enum CodingKeys: String, CodingKey { case name, institution, date, amount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        institution = try c.decodeIfPresent(String.self, forKey: .institution)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
    }
}

/// One read of the ledger: what the screens show, and the ledger exactly
/// as sent.
struct LedgerRead: Sendable {
    let ledger: FinanceLedger
    let raw: JSONValue
}

/// One read of Finances: what the screens show, and the plan exactly as
/// sent, for an edit to send back (see `FinancePlanEdit`).
struct FinancesRead: Sendable {
    let view: FinancesPlanView
    let rawPlan: JSONValue
}

// MARK: - The plan, read forward (`finance.View`, the `Finances` call)

/// The parts of the computer's Finances view the phone shows: the
/// accounts as of today, and each pay period ahead with its payments.
/// Budgets, goals, loans and the ledger aren't shown here yet, and Codable
/// ignores them.
struct FinancesPlanView: Decodable, Sendable, Equatable {
    let today: Date?
    /// The checking account's id ("" before there's one).
    let checking: String
    /// Each account at the start of today, by id. For a card or a loan,
    /// what it owes.
    let start: [String: Double]
    let periods: [FinancePeriod]
    let plan: FinancePlan
    /// The computer marks this for a device allowed only to look.
    let readOnly: Bool
    let budgets: [FinanceBudget]
    let goals: [FinanceGoal]
    let loans: [FinancePayoff]
    /// The plan's categories, or the defaults while it has none.
    let categories: [FinanceCategory]

    enum CodingKeys: String, CodingKey { case today, checking, start, periods, plan, readOnly, budgets, goals, loans, categories }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        today = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .today))
        checking = try c.decodeIfPresent(String.self, forKey: .checking) ?? ""
        start = try c.decodeIfPresent([String: Double].self, forKey: .start) ?? [:]
        periods = try c.decodeIfPresent([FinancePeriod].self, forKey: .periods) ?? []
        plan = try c.decode(FinancePlan.self, forKey: .plan)
        readOnly = try c.decodeIfPresent(Bool.self, forKey: .readOnly) ?? false
        // These are extras: one that doesn't read costs only itself.
        budgets = ((try? c.decodeIfPresent([FinanceBudget].self, forKey: .budgets)) ?? nil) ?? []
        goals = ((try? c.decodeIfPresent([FinanceGoal].self, forKey: .goals)) ?? nil) ?? []
        loans = ((try? c.decodeIfPresent([FinancePayoff].self, forKey: .loans)) ?? nil) ?? []
        categories = ((try? c.decodeIfPresent([FinanceCategory].self, forKey: .categories)) ?? nil) ?? []
    }

    func payment(_ id: String) -> FinancePayment? { plan.payments.first { $0.id == id } }
    func person(_ id: String) -> String? { plan.people.first { $0.id == id }?.name }

    /// What's there less what's owed, today.
    var netWorth: Double {
        plan.accounts.reduce(0) { sum, account in
            let value = start[account.id] ?? 0
            return account.isOwed ? sum - value : sum + value
        }
    }
}

struct FinancePlan: Decodable, Sendable, Equatable {
    let people: [FinancePerson]
    let accounts: [FinanceAccount]
    let payments: [FinancePayment]
    /// The least checking should hold. A period that leaves less is flagged.
    let cushion: Double
    let currency: String
    /// Every device follows this: no amounts are shown at all while it's on.
    let hideAmounts: Bool

    enum CodingKeys: String, CodingKey { case people, accounts, payments, cushion, currency, hideAmounts }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        people = try c.decodeIfPresent([FinancePerson].self, forKey: .people) ?? []
        accounts = try c.decodeIfPresent([FinanceAccount].self, forKey: .accounts) ?? []
        payments = try c.decodeIfPresent([FinancePayment].self, forKey: .payments) ?? []
        cushion = try c.decodeIfPresent(Double.self, forKey: .cushion) ?? 0
        currency = MoneyCard.currencyCode(try c.decodeIfPresent(String.self, forKey: .currency))
        hideAmounts = try c.decodeIfPresent(Bool.self, forKey: .hideAmounts) ?? false
    }
}

struct FinanceCategory: Decodable, Sendable, Equatable, Identifiable {
    let name: String
    let parent: String?
    /// Money in: a paycheck, interest, a refund.
    let income: Bool?

    var id: String { name }
}

struct FinancePerson: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
}

struct FinanceAccount: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    /// checking, savings, card, investment, retirement, loan, home, car, collectible, other.
    let kind: String
    let institution: String?
    /// Its own currency, when it isn't the plan's.
    let currency: String?

    /// A card or a loan: its balance is what it owes.
    var isOwed: Bool { kind == "card" || kind == "loan" }

    /// The order the screen lists kinds in.
    var kindOrder: Int {
        ["checking", "savings", "card", "investment", "retirement", "loan", "home", "car", "collectible", "other"].firstIndex(of: kind) ?? 99
    }

    var kindTitle: String {
        switch kind {
        case "checking": "Checking"
        case "savings": "Savings"
        case "card": "Card"
        case "investment": "Investment"
        case "retirement": "Retirement"
        case "loan": "Loan"
        case "home": "Home"
        case "car": "Car"
        case "collectible": "Collectible"
        default: "Other"
        }
    }
}

struct FinancePayment: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let kind: String?
    let institution: String?
}

/// From a paycheck until the day before the next one, or from today for
/// the first (`finance.Period`).
struct FinancePeriod: Decodable, Sendable, Equatable, Identifiable {
    let now: Bool
    let start: Date?
    let last: Date?
    let pay: FinancePayday?
    /// Checking at the start, before the paycheck.
    let carried: Double
    let moneyIn: Double
    let out: Double
    let saved: Double
    /// Checking on the last day.
    let left: Double
    let rows: [FinanceRow]

    var id: String { "\(start?.timeIntervalSince1970 ?? 0)|\(now)" }

    enum CodingKeys: String, CodingKey {
        case now, start, last, pay, carried, out, saved, left, rows
        case moneyIn = "in"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        now = try c.decodeIfPresent(Bool.self, forKey: .now) ?? false
        start = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .start))
        last = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .last))
        pay = try c.decodeIfPresent(FinancePayday.self, forKey: .pay)
        carried = try c.decodeIfPresent(Double.self, forKey: .carried) ?? 0
        moneyIn = try c.decodeIfPresent(Double.self, forKey: .moneyIn) ?? 0
        out = try c.decodeIfPresent(Double.self, forKey: .out) ?? 0
        saved = try c.decodeIfPresent(Double.self, forKey: .saved) ?? 0
        left = try c.decodeIfPresent(Double.self, forKey: .left) ?? 0
        rows = try c.decodeIfPresent([FinanceRow].self, forKey: .rows) ?? []
    }
}

struct FinancePayday: Decodable, Sendable, Equatable {
    let date: Date?
    /// The earners' ids.
    let people: [String]
    /// Into checking.
    let amount: Double

    enum CodingKeys: String, CodingKey { case date, people, amount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        people = try c.decodeIfPresent([String].self, forKey: .people) ?? []
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
    }
}

/// One payment on its day (`finance.Row`).
struct FinanceRow: Decodable, Sendable, Equatable, Identifiable {
    let date: Date?
    let payment: String
    let amount: Double
    let estimate: Bool
    /// Between other accounts; checking isn't in it.
    let outside: Bool
    /// Money moved into checking from another account.
    let into: Bool
    /// Dated before today and still waiting: it comes today.
    let late: Bool
    /// Into savings, an investment or retirement: kept, not spent.
    let saved: Bool

    var id: String { "\(payment)|\(date?.timeIntervalSince1970 ?? 0)" }

    enum CodingKeys: String, CodingKey { case date, payment, amount, estimate, outside, into, late, saved }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        payment = try c.decodeIfPresent(String.self, forKey: .payment) ?? ""
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        estimate = try c.decodeIfPresent(Bool.self, forKey: .estimate) ?? false
        outside = try c.decodeIfPresent(Bool.self, forKey: .outside) ?? false
        into = try c.decodeIfPresent(Bool.self, forKey: .into) ?? false
        late = try c.decodeIfPresent(Bool.self, forKey: .late) ?? false
        saved = try c.decodeIfPresent(Bool.self, forKey: .saved) ?? false
    }
}

// MARK: - The ledger (`finance.Ledger`, the `FinancesLedger` call)

/// What actually happened, as the household recorded it or brought it in.
struct FinanceLedger: Decodable, Sendable, Equatable {
    let transactions: [FinanceTransaction]

    enum CodingKeys: String, CodingKey { case transactions }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        transactions = try c.decodeIfPresent([FinanceTransaction].self, forKey: .transactions) ?? []
    }

    /// Newest first, and by id when two share a day, so the order holds still.
    var newestFirst: [FinanceTransaction] {
        transactions.sorted { a, b in
            switch (a.date, b.date) {
            case let (x?, y?) where x != y: return x > y
            case (nil, _?): return false
            case (_?, nil): return true
            default: return a.id > b.id
            }
        }
    }
}

struct FinanceTransaction: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let date: Date?
    /// The plan's account it happened on, by id.
    let account: String
    /// Signed as the account sees it: money in is plus, money out minus.
    let amount: Double
    let payee: String
    let category: String
    let note: String
    /// For a transfer, the account the money went into.
    let to: String?
    let tags: [String]
    /// A receipt is kept with it on the computer.
    let hasReceipt: Bool

    enum CodingKeys: String, CodingKey { case id, date, account, amount, payee, category, note, to, tags, receipt }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        account = try c.decodeIfPresent(String.self, forKey: .account) ?? ""
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        payee = try c.decodeIfPresent(String.self, forKey: .payee) ?? ""
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
        note = try c.decodeIfPresent(String.self, forKey: .note) ?? ""
        to = try c.decodeIfPresent(String.self, forKey: .to)
        tags = try c.decodeIfPresent([String].self, forKey: .tags) ?? []
        hasReceipt = !(try c.decodeIfPresent(String.self, forKey: .receipt) ?? "").isEmpty
    }

    /// Whether `text` is in the payee, the category, the note or a tag.
    func matches(_ text: String) -> Bool {
        let needle = text.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return true }
        return ([payee, category, note] + tags).contains { $0.localizedCaseInsensitiveContains(needle) }
    }
}

// MARK: - Budgets, goals and loans (parts of `finance.View`)

/// One budget this month or pay period (`finance.BudgetNow`).
struct FinanceBudget: Decodable, Sendable, Equatable, Identifiable {
    let category: String
    /// "month" or "paycheck".
    let per: String
    /// What it may take this time, including what rolled over.
    let amount: Double
    let spent: Double
    let left: Double
    /// What would be spent by today at an even pace.
    let pace: Double

    var id: String { category }
    var isOver: Bool { spent > amount }
    var isAhead: Bool { spent > pace && !isOver }
    /// Spent, as a share of the budget, 0 to 1.
    var share: Double { amount > 0 ? min(max(spent / amount, 0), 1) : 0 }
}

/// One goal today (`finance.GoalNow`).
struct FinanceGoal: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let target: Double
    let date: Date?
    let saved: Double
    let left: Double
    let needsMonth: Double
    let needsPaycheck: Double
    /// The month the pace reaches the target, nil when reached or at no pace.
    let reaches: Date?

    enum CodingKeys: String, CodingKey { case id, name, target, date, saved, left, needsMonth, needsPaycheck, reaches }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        target = try c.decodeIfPresent(Double.self, forKey: .target) ?? 0
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        saved = try c.decodeIfPresent(Double.self, forKey: .saved) ?? 0
        left = try c.decodeIfPresent(Double.self, forKey: .left) ?? 0
        needsMonth = try c.decodeIfPresent(Double.self, forKey: .needsMonth) ?? 0
        needsPaycheck = try c.decodeIfPresent(Double.self, forKey: .needsPaycheck) ?? 0
        reaches = LocalDay.parseMonth(try c.decodeIfPresent(String.self, forKey: .reaches))
    }

    var share: Double { target > 0 ? min(max(saved / target, 0), 1) : 0 }
    var isReached: Bool { target > 0 && saved >= target }
}

/// A loan read down to zero at its rate and payments (`finance.Payoff`).
struct FinancePayoff: Decodable, Sendable, Equatable, Identifiable {
    let account: String
    let balance: Double
    /// The yearly rate, as a percentage.
    let rate: Double
    let monthly: Double
    let months: Int
    /// The month it's paid off.
    let paidOff: Date?
    /// Interest still to pay, at its rate, as paid.
    let interest: Double
    /// The payment doesn't keep up with the interest: never paid off at this pace.
    let never: Bool

    var id: String { account }

    enum CodingKeys: String, CodingKey { case account, balance, rate, monthly, months, date, interest, never }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        account = try c.decodeIfPresent(String.self, forKey: .account) ?? ""
        balance = try c.decodeIfPresent(Double.self, forKey: .balance) ?? 0
        rate = try c.decodeIfPresent(Double.self, forKey: .rate) ?? 0
        monthly = try c.decodeIfPresent(Double.self, forKey: .monthly) ?? 0
        months = try c.decodeIfPresent(Int.self, forKey: .months) ?? 0
        paidOff = LocalDay.parseMonth(try c.decodeIfPresent(String.self, forKey: .date))
        interest = try c.decodeIfPresent(Double.self, forKey: .interest) ?? 0
        never = try c.decodeIfPresent(Bool.self, forKey: .never) ?? false
    }
}
