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
    /// Today as the computer wrote it (YYYY-MM-DD).
    let todayText: String
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
    /// Paychecks and payments taken to be in the balances, or waiting, oldest first.
    let since: [FinancePast]
    /// How checking at the start of today was reached, from its balance as
    /// typed in; and checking once the next paycheck into it lands (main
    /// #482). Nil without a checking account, or no paycheck ahead.
    let checkingNow: FinanceWorking?
    let afterPay: FinanceWorking?

    enum CodingKeys: String, CodingKey {
        case today, checking, start, periods, plan, readOnly, budgets, goals, loans, categories, since, checkingNow, afterPay
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        todayText = try c.decodeIfPresent(String.self, forKey: .today) ?? ""
        today = LocalDay.parse(todayText)
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
        since = ((try? c.decodeIfPresent([FinancePast].self, forKey: .since)) ?? nil) ?? []
        checkingNow = (try? c.decodeIfPresent(FinanceWorking.self, forKey: .checkingNow)) ?? nil
        afterPay = (try? c.decodeIfPresent(FinanceWorking.self, forKey: .afterPay)) ?? nil
    }

    /// The keys waiting now: what `Plan.waiting` should hold, as the computer reads it.
    var waitingKeys: [String] { since.filter(\.waiting).map(\.key) }

    func payment(_ id: String) -> FinancePayment? { plan.payments.first { $0.id == id } }
    func person(_ id: String) -> String? { plan.people.first { $0.id == id }?.name }

    /// A payment's name as rows show it: "Mortgage share, from Jamie" for
    /// money from someone outside the household.
    func paymentTitle(_ id: String) -> String? {
        guard let payment = payment(id) else { return nil }
        if let payer = payment.payer, !payer.isEmpty { return "\(payment.name), from \(payer)" }
        return payment.name
    }

    /// "Sam and Alex", from people's ids, as the computer joins them.
    func names(_ people: [String]) -> String {
        people.map { person($0).flatMap { $0.isEmpty ? nil : $0 } ?? $0 }.joined(separator: " and ")
    }

    /// What one step of a working was, in the words its row uses elsewhere
    /// (the computer's `stepName`).
    func stepName(_ step: FinanceStep) -> String {
        if !step.people.isEmpty { return "\(names(step.people))'s paycheck" }
        if let id = step.payment, !id.isEmpty { return paymentTitle(id) ?? id }
        if step.interest { return "Interest" }
        if let name = step.name, !name.isEmpty { return name }
        return "A transaction"
    }

    /// The paycheck `afterPay` waits for, from the pay period it starts.
    var nextPay: FinancePayday? {
        guard let date = afterPay?.dateText else { return nil }
        return periods.first { $0.pay?.dateText == date }?.pay
    }

    /// How many payments due on payday come out of that paycheck after it
    /// lands, so aren't in `afterPay` (as the computer counts them).
    var paydayPayments: Int {
        guard let date = afterPay?.dateText,
              let period = periods.first(where: { $0.pay?.dateText == date })
        else { return 0 }
        return period.rows.filter { $0.dateText == date && !$0.outside && !$0.into }.count
    }

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
    /// When the investments were last read from Ghostfolio (main #489).
    let holdingsRead: Date?

    enum CodingKeys: String, CodingKey { case people, accounts, payments, cushion, currency, hideAmounts, holdingsRead }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        people = try c.decodeIfPresent([FinancePerson].self, forKey: .people) ?? []
        accounts = try c.decodeIfPresent([FinanceAccount].self, forKey: .accounts) ?? []
        payments = try c.decodeIfPresent([FinancePayment].self, forKey: .payments) ?? []
        cushion = try c.decodeIfPresent(Double.self, forKey: .cushion) ?? 0
        currency = MoneyCard.currencyCode(try c.decodeIfPresent(String.self, forKey: .currency))
        hideAmounts = try c.decodeIfPresent(Bool.self, forKey: .hideAmounts) ?? false
        holdingsRead = ((try? c.decodeIfPresent(String.self, forKey: .holdingsRead)) ?? nil).flatMap(GoTime.parse)
    }
}

/// A paycheck or payment dated on or before today, taken to be in the
/// balances, or waiting (`finance.Past`).
struct FinancePast: Decodable, Sendable, Equatable, Identifiable {
    /// "pay:<person>:<date>" or "payment:<payment>:<date>", its name in `Plan.waiting`.
    let key: String
    let date: Date?
    let person: String?
    let payment: String?
    let amount: Double
    /// Money into checking.
    let moneyIn: Bool
    /// Between other accounts.
    let outside: Bool
    /// Dated the day its balance was typed in.
    let typed: Bool
    /// The household said it isn't in the balances yet: it comes today.
    let waiting: Bool

    var id: String { key }

    enum CodingKeys: String, CodingKey {
        case key, date, person, payment, amount, outside, typed, waiting
        case moneyIn = "in"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = try c.decode(String.self, forKey: .key)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        person = try c.decodeIfPresent(String.self, forKey: .person)
        payment = try c.decodeIfPresent(String.self, forKey: .payment)
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        moneyIn = try c.decodeIfPresent(Bool.self, forKey: .moneyIn) ?? false
        outside = try c.decodeIfPresent(Bool.self, forKey: .outside) ?? false
        typed = try c.decodeIfPresent(Bool.self, forKey: .typed) ?? false
        waiting = try c.decodeIfPresent(Bool.self, forKey: .waiting) ?? false
    }

    /// The key's shape, as the computer writes it.
    static func isValidKey(_ key: String) -> Bool {
        let parts = key.split(separator: ":", omittingEmptySubsequences: false)
        return parts.count == 3 && (parts[0] == "pay" || parts[0] == "payment")
            && !parts[1].isEmpty && LocalDay.parse(String(parts[2])) != nil && key.count <= 200
    }
}

struct FinanceCategory: Decodable, Sendable, Equatable, Identifiable {
    let name: String
    let parent: String?
    /// What it shows by: one of Mark.tsx's glyphs ("food", "home", "car"…).
    let icon: String?
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
    /// Its balance as typed in (or as Ghostfolio read it).
    let balance: Double?
    /// Its balance on each day it was kept, oldest first.
    let history: [FinancePoint]
    /// What an investment account holds, as Ghostfolio last read it (main #489).
    let holdings: [FinanceHolding]

    enum CodingKeys: String, CodingKey { case id, name, kind, institution, currency, balance, history, holdings }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        kind = try c.decode(String.self, forKey: .kind)
        institution = try c.decodeIfPresent(String.self, forKey: .institution)
        currency = try c.decodeIfPresent(String.self, forKey: .currency)
        // Extras: one that doesn't read costs only itself, never the account.
        balance = (try? c.decodeIfPresent(Double.self, forKey: .balance)) ?? nil
        history = ((try? c.decodeIfPresent([FinancePoint].self, forKey: .history)) ?? nil) ?? []
        holdings = Array((((try? c.decodeIfPresent([FinanceHolding].self, forKey: .holdings)) ?? nil) ?? []).prefix(500))
    }

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
    /// What it costs each time. For a card payoff, the card's other spending instead.
    let amount: Double?
    /// The amount changes (electric): about this much.
    let estimate: Bool?
    /// A card whose whole balance it pays (`Payment.Card`).
    let card: String?
    /// Someone outside the household who sends it ("Jamie", for a share of
    /// the mortgage): money in, from none of the household's accounts (main #483).
    let payer: String?

    /// Whether the phone can change its amount. A card payoff's amount
    /// isn't what the rows show (they show what the card owes), so it's
    /// changed on the computer.
    var canChangeAmount: Bool { (card ?? "").isEmpty }
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
    /// The day as the computer wrote it (YYYY-MM-DD), to match it exactly.
    let dateText: String?
    /// The earners' ids.
    let people: [String]
    /// Into checking.
    let amount: Double

    enum CodingKeys: String, CodingKey { case date, people, amount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        dateText = try c.decodeIfPresent(String.self, forKey: .date)
        date = LocalDay.parse(dateText)
        people = try c.decodeIfPresent([String].self, forKey: .people) ?? []
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
    }
}

/// One payment on its day (`finance.Row`).
struct FinanceRow: Decodable, Sendable, Equatable, Identifiable {
    let date: Date?
    /// The day as the computer wrote it (YYYY-MM-DD).
    let dateText: String?
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
        dateText = try c.decodeIfPresent(String.self, forKey: .date)
        date = LocalDay.parse(dateText)
        payment = try c.decodeIfPresent(String.self, forKey: .payment) ?? ""
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        estimate = try c.decodeIfPresent(Bool.self, forKey: .estimate) ?? false
        outside = try c.decodeIfPresent(Bool.self, forKey: .outside) ?? false
        into = try c.decodeIfPresent(Bool.self, forKey: .into) ?? false
        late = try c.decodeIfPresent(Bool.self, forKey: .late) ?? false
        saved = try c.decodeIfPresent(Bool.self, forKey: .saved) ?? false
    }
}

/// How a checking figure was reached, row by row (`finance.Working`):
/// `start` on `from`, each step, and `result` on `date`. It's the
/// computer's own sum, so the phone shows it and adds nothing up itself.
struct FinanceWorking: Decodable, Sendable, Equatable {
    /// The day of the result, and the day the start is from (YYYY-MM-DD).
    let dateText: String
    let fromText: String
    let start: Double
    let steps: [FinanceStep]
    let result: Double

    var date: Date? { LocalDay.parse(dateText) }
    var from: Date? { LocalDay.parse(fromText) }
    /// The balance was typed in on the day of the result.
    var typedSameDay: Bool { !fromText.isEmpty && fromText == dateText }

    enum CodingKeys: String, CodingKey { case date, from, start, steps, result }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        dateText = try c.decodeIfPresent(String.self, forKey: .date) ?? ""
        fromText = try c.decodeIfPresent(String.self, forKey: .from) ?? ""
        start = try c.decodeIfPresent(Double.self, forKey: .start) ?? 0
        // At most a year of steps; a longer list is cut, never refused.
        steps = Array((try c.decodeIfPresent([FinanceStep].self, forKey: .steps) ?? []).prefix(2000))
        result = try c.decodeIfPresent(Double.self, forKey: .result) ?? 0
    }
}

/// One change to checking (`finance.Step`): a paycheck, a planned payment,
/// a transaction, or a stretch of interest, and checking after it.
struct FinanceStep: Decodable, Sendable, Equatable {
    let date: Date?
    let people: [String]
    let payment: String?
    let transaction: String?
    let name: String?
    let interest: Bool
    let amount: Double
    let after: Double

    enum CodingKeys: String, CodingKey { case date, people, payment, transaction, name, interest, amount, after }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        people = try c.decodeIfPresent([String].self, forKey: .people) ?? []
        payment = try c.decodeIfPresent(String.self, forKey: .payment)
        transaction = try c.decodeIfPresent(String.self, forKey: .transaction)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        interest = try c.decodeIfPresent(Bool.self, forKey: .interest) ?? false
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        after = try c.decodeIfPresent(Double.self, forKey: .after) ?? 0
    }
}

/// An amount on a day (`finance.Point`).
struct FinancePoint: Decodable, Sendable, Equatable {
    /// YYYY-MM-DD, as the computer wrote it.
    let dateText: String
    let amount: Double

    var date: Date? { LocalDay.parse(dateText) }

    enum CodingKeys: String, CodingKey { case date, amount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        dateText = try c.decodeIfPresent(String.self, forKey: .date) ?? ""
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
    }
}

/// A fund or a company's shares an account holds (`finance.Holding`): how
/// many, what went in, and what they were worth when read, with that worth
/// on each day it was read.
struct FinanceHolding: Decodable, Sendable, Equatable {
    let symbol: String
    let name: String?
    let shares: Double
    let paid: Double
    let value: Double
    let history: [FinancePoint]

    var gain: Double { value - paid }
    var title: String {
        if let name, !name.isEmpty { return name }
        return symbol
    }

    enum CodingKeys: String, CodingKey { case symbol, name, shares, paid, value, history }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        symbol = try c.decode(String.self, forKey: .symbol)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        shares = try c.decodeIfPresent(Double.self, forKey: .shares) ?? 0
        paid = try c.decodeIfPresent(Double.self, forKey: .paid) ?? 0
        value = try c.decodeIfPresent(Double.self, forKey: .value) ?? 0
        history = Array((((try? c.decodeIfPresent([FinancePoint].self, forKey: .history)) ?? nil) ?? []).suffix(800))
    }
}

/// The Investments card's figures, as the computer works them out
/// (web/src/finances/widgets/Investments.tsx): what's held, what went in,
/// the gain, and this month's change, with a line a holding and each
/// account's cash besides.
struct FinanceInvestments: Sendable {
    struct Line: Sendable, Equatable {
        let account: FinanceAccount
        /// Nil for the account's cash: what it holds besides its holdings.
        let holding: FinanceHolding?
        let cash: Double
    }

    /// Largest first, with their worth today.
    let accounts: [(account: FinanceAccount, worth: Double)]
    let lines: [Line]
    let total: Double
    let paid: Double
    let month: Double
    /// The first of this month, which `month` is counted from.
    let since: Date?

    var gain: Double { total - paid }
    var holdingCount: Int { lines.filter { $0.holding != nil }.count }

    /// "+24.4%", "−3.1%"; nil without what went in.
    static func share(_ gain: Double, of paid: Double) -> String? {
        guard abs(paid) >= 0.005 else { return nil }
        let percent = abs(gain / abs(paid) * 100)
        return "\(gain < 0 ? "−" : "+")\(percent.formatted(.number.precision(.fractionLength(1))))%"
    }
}

extension FinancesPlanView {
    /// An account's worth today, as the computer reads it for Net worth.
    func worth(of account: FinanceAccount) -> Double {
        let today = start[account.id] ?? account.balance ?? 0
        return account.isOwed ? -today : today
    }

    /// Its worth on a day: its last kept balance on or before it, else its first, else today's.
    func worth(of account: FinanceAccount, on day: String) -> Double {
        var at: Double?
        for point in account.history where point.dateText <= day { at = point.amount }
        guard let kept = at ?? account.history.first?.amount else { return worth(of: account) }
        return account.isOwed ? -kept : kept
    }

    /// The Investments card, or nil when no account holds anything read from Ghostfolio.
    var investments: FinanceInvestments? {
        let held = plan.accounts.filter { !$0.holdings.isEmpty }
            .map { (account: $0, worth: worth(of: $0)) }
            .sorted { $0.worth > $1.worth }
        guard !held.isEmpty else { return nil }
        var lines: [FinanceInvestments.Line] = []
        for (account, _) in held {
            let holdings = account.holdings.sorted { $0.value > $1.value }
            lines += holdings.map { FinanceInvestments.Line(account: account, holding: $0, cash: 0) }
            let cash = ((account.balance ?? 0) - holdings.reduce(0) { $0 + $1.value }) * 100
            let rounded = cash.rounded() / 100
            if rounded >= 0.01 { lines.append(FinanceInvestments.Line(account: account, holding: nil, cash: rounded)) }
        }
        let total = held.reduce(0) { $0 + $1.worth }
        let paid = lines.reduce(0) { $0 + ($1.holding?.paid ?? $1.cash) }
        // This month: from the first, by each account's kept balances.
        let first = todayText.count == 10 ? String(todayText.prefix(8)) + "01" : nil
        let month = first.map { day in held.reduce(0) { $0 + $1.worth - worth(of: $1.account, on: day) } } ?? 0
        return FinanceInvestments(accounts: held, lines: lines, total: total, paid: paid, month: month,
                                  since: first.flatMap(LocalDay.parse))
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
    /// The payee's logo picked by hand: a brand's key, or "none" for none.
    let institution: String?
    let category: String
    let note: String
    /// For a transfer, the account the money went into.
    let to: String?
    let tags: [String]
    /// The receipt kept with it on the computer, by its file's name.
    let receipt: String?
    /// Divided across categories (changed only on the computer).
    let isSplit: Bool
    /// The first part's category, when it's divided: what its mark is coloured by.
    let splitCategory: String?
    var hasReceipt: Bool { receipt != nil }

    enum CodingKeys: String, CodingKey { case id, date, account, amount, payee, institution, category, note, to, tags, receipt, splits }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        account = try c.decodeIfPresent(String.self, forKey: .account) ?? ""
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        payee = try c.decodeIfPresent(String.self, forKey: .payee) ?? ""
        institution = try c.decodeIfPresent(String.self, forKey: .institution)
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
        note = try c.decodeIfPresent(String.self, forKey: .note) ?? ""
        to = try c.decodeIfPresent(String.self, forKey: .to)
        tags = try c.decodeIfPresent([String].self, forKey: .tags) ?? []
        let name = try c.decodeIfPresent(String.self, forKey: .receipt) ?? ""
        receipt = ReceiptCodec.isValidName(name) ? name : nil
        let splits = ((try? c.decodeIfPresent([JSONValue].self, forKey: .splits)) ?? nil) ?? []
        isSplit = !splits.isEmpty
        if case .string(let first)? = splits.first?["category"] { splitCategory = first } else { splitCategory = nil }
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

// MARK: - Net worth over time (Finances' home)

/// Net worth on a day, for the chart on Finances' home.
struct NetWorthPoint: Hashable, Sendable {
    let date: Date
    let value: Double
}

extension FinancesPlanView {
    /// Net worth on each day an account's balance was kept, over the last
    /// `days` days, then today, oldest first; from each account's kept
    /// balances, as the computer draws its line.
    func netWorthSeries(days: Int) -> [NetWorthPoint] {
        guard let today else { return [] }
        let from = today.addingTimeInterval(-Double(days) * 86_400)
        let kept = Set(plan.accounts.flatMap { $0.history.map(\.dateText) })
            .filter { $0 < todayText }
            .compactMap { text -> (String, Date)? in
                guard let date = LocalDay.parse(text), date >= from else { return nil }
                return (text, date)
            }
            .sorted { $0.0 < $1.0 }
        var out = kept.map { pair in
            NetWorthPoint(date: pair.1, value: plan.accounts.reduce(0) { $0 + worth(of: $1, on: pair.0) })
        }
        out.append(NetWorthPoint(date: today, value: plan.accounts.reduce(0) { $0 + worth(of: $1) }))
        return out
    }

    /// How net worth moved since the first of this month, or nil when no
    /// account has kept balances to tell.
    var netWorthThisMonth: Double? {
        guard todayText.count == 10, plan.accounts.contains(where: { !$0.history.isEmpty }) else { return nil }
        let first = String(todayText.prefix(8)) + "01"
        return plan.accounts.reduce(0) { $0 + worth(of: $1) - worth(of: $1, on: first) }
    }
}
