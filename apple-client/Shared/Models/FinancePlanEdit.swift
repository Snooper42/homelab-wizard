import Foundation

/// Changes to the Finances plan, made on the plan exactly as the computer
/// sent it.
///
/// `SaveFinances` takes the whole plan and writes it. The phone decodes
/// only the parts it shows, so a save rebuilt from those would drop
/// everything else: schedules, history, logos, settings. The edits here
/// work on the plan as raw JSON instead. Everything the phone doesn't
/// know about goes back as it came, and the plan's `rev` goes back too, so
/// the computer refuses the save if another device saved after this one read.
enum FinancePlanEdit {
    /// The largest balance the phone sends, so a slip of the keyboard can't
    /// write a nonsense figure.
    static let maxBalance = 1_000_000_000_000.0

    /// `plan` with one account's balance set to `value`, typed in today, as
    /// the computer's Edit screen does it (balance, the account's
    /// `updated`, and the plan's `updated`). Nil when the plan doesn't
    /// have that account or has an unexpected shape, or the value isn't a
    /// sensible amount.
    static func settingBalance(of accountID: String, to value: Double, today: String, in plan: JSONValue) -> JSONValue? {
        guard value.isFinite, abs(value) <= maxBalance,
              LocalDay.parse(today) != nil,
              case .object(var root) = plan,
              case .array(var accounts)? = root["accounts"]
        else { return nil }

        guard let index = accounts.firstIndex(where: { $0["id"] == .string(accountID) }),
              case .object(var account) = accounts[index]
        else { return nil }

        account["balance"] = .number(roundedToCents(value))
        account["updated"] = .string(today)
        accounts[index] = .object(account)
        root["accounts"] = .array(accounts)
        root["updated"] = .string(today)
        return .object(root)
    }

    /// The kinds of account the computer keeps, in the order Add Account offers them.
    static let accountKinds: [(id: String, title: String)] = [
        ("checking", "Checking"), ("savings", "Savings"), ("card", "Credit Card"),
        ("investment", "Investments"), ("retirement", "Retirement"), ("loan", "Loan"),
        ("home", "Home"), ("car", "Car"), ("collectible", "Collectible"), ("other", "Other"),
    ]

    /// `plan` with a new account: its name, kind, and balance today (for a
    /// card or a loan, what's owed). The computer gives it its id. Nil for
    /// no name, an unknown kind, or a balance out of bounds.
    static func addingAccount(name: String, kind: String, balance: Double, today: String, in plan: JSONValue) -> JSONValue? {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name.count <= 80,
              accountKinds.contains(where: { $0.id == kind }),
              balance.isFinite, abs(balance) <= maxBalance,
              LocalDay.parse(today) != nil,
              case .object(var root) = plan
        else { return nil }
        var accounts: [JSONValue] = []
        if case .array(let have)? = root["accounts"] { accounts = have }
        accounts.append(.object([
            "name": .string(name),
            "kind": .string(kind),
            "balance": .number(roundedToCents(balance)),
            "updated": .string(today),
        ]))
        root["accounts"] = .array(accounts)
        root["updated"] = .string(today)
        return .object(root)
    }

    /// `plan` with the budget for `category` set to `amount` this month or
    /// pay period. Its period and rollover are kept. The category matches
    /// regardless of case, as the computer keeps one budget per category.
    /// Nil for an unknown budget, or an amount that isn't more than nothing.
    static func settingBudget(category: String, to amount: Double, in plan: JSONValue) -> JSONValue? {
        let cents = roundedToCents(amount)
        guard amount.isFinite, cents > 0, cents <= maxBalance,
              case .object(var root) = plan,
              case .array(var budgets)? = root["budgets"]
        else { return nil }
        let wanted = category.trimmingCharacters(in: .whitespaces).lowercased()
        guard let index = budgets.firstIndex(where: {
            if case .string(let c)? = $0["category"] { return c.trimmingCharacters(in: .whitespaces).lowercased() == wanted }
            return false
        }), case .object(var budget) = budgets[index] else { return nil }
        budget["amount"] = .number(cents)
        budgets[index] = .object(budget)
        root["budgets"] = .array(budgets)
        return .object(root)
    }

    /// `plan` with `key` marked as not in the balances yet (it comes today),
    /// or back as in them, as the computer's Taken as done does it: the
    /// plan's `waiting` becomes the keys waiting now, with this one added
    /// or taken out, and the older `notYet` is dropped (it's one of them).
    static func settingWaiting(_ key: String, waiting: Bool, current: [String], in plan: JSONValue) -> JSONValue? {
        guard FinancePast.isValidKey(key), case .object(var root) = plan else { return nil }
        var keys = current.filter(FinancePast.isValidKey)
        keys.removeAll { $0 == key }
        if waiting { keys.append(key) }
        root["waiting"] = keys.isEmpty ? nil : .array(keys.map { .string($0) })
        root["notYet"] = nil
        return .object(root)
    }

    /// `plan` with the goal `id`'s target set to `amount`. Its name, day
    /// and the accounts' shares toward it are kept. Nil for an unknown goal
    /// or a target that isn't more than nothing.
    static func settingGoal(id: String, target amount: Double, in plan: JSONValue) -> JSONValue? {
        let cents = roundedToCents(amount)
        guard !id.isEmpty, amount.isFinite, cents > 0, cents <= maxBalance,
              case .object(var root) = plan,
              case .array(var goals)? = root["goals"],
              let index = goals.firstIndex(where: { $0["id"] == .string(id) }),
              case .object(var goal) = goals[index]
        else { return nil }
        goal["target"] = .number(cents)
        goals[index] = .object(goal)
        root["goals"] = .array(goals)
        return .object(root)
    }

    /// `plan` with the payment `id` costing `amount` each time from now on.
    /// Its schedule, accounts, kind and "about this much" are kept. Nil for
    /// an unknown payment, a card payoff (whose amount means the card's
    /// other spending), or an amount that isn't more than nothing.
    static func settingPayment(id: String, to amount: Double, in plan: JSONValue) -> JSONValue? {
        let cents = roundedToCents(amount)
        guard !id.isEmpty, amount.isFinite, cents > 0, cents <= maxBalance,
              case .object(var root) = plan,
              case .array(var payments)? = root["payments"],
              let index = payments.firstIndex(where: { $0["id"] == .string(id) }),
              case .object(var payment) = payments[index]
        else { return nil }
        if case .string(let card)? = payment["card"], !card.isEmpty { return nil }
        payment["amount"] = .number(cents)
        payments[index] = .object(payment)
        root["payments"] = .array(payments)
        return .object(root)
    }

    /// `plan` with the cushion, the least checking should hold, set to
    /// `amount`. A pay period that leaves less is flagged. Nothing (0)
    /// turns the warning off. Nil for a negative or nonsense amount.
    static func settingCushion(_ amount: Double, in plan: JSONValue) -> JSONValue? {
        let cents = roundedToCents(amount)
        guard amount.isFinite, cents >= 0, cents <= maxBalance, case .object(var root) = plan else { return nil }
        root["cushion"] = .number(cents == 0 ? 0 : cents)
        return .object(root)
    }

    /// `plan` without the followed ticker `symbol` (the Watchlist's Unfollow).
    /// Nil when it isn't followed.
    static func removingWatched(_ symbol: String, in plan: JSONValue) -> JSONValue? {
        guard case .object(var root) = plan, case .array(let list)? = root["watch"] else { return nil }
        let kept = list.filter { item in
            guard case .string(let s)? = item["symbol"] else { return true }
            return s.caseInsensitiveCompare(symbol) != .orderedSame
        }
        guard kept.count < list.count else { return nil }
        root["watch"] = kept.isEmpty ? nil : .array(kept)
        return .object(root)
    }

    /// `plan` with Hide amounts on or off, which every device follows (the
    /// computer's ⌘⇧H). Omitted when off, as the computer writes it.
    static func settingHideAmounts(_ hide: Bool, in plan: JSONValue) -> JSONValue? {
        guard case .object(var root) = plan else { return nil }
        root["hideAmounts"] = hide ? .bool(true) : nil
        return .object(root)
    }

    static func roundedToCents(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }

    /// Reads an amount as a person types it, in their own locale. Currency
    /// symbols and spaces are ignored. Nil for anything that isn't a number.
    static func parseAmount(_ text: String, locale: Locale = .current) -> Double? {
        let kept = text.filter { $0.isNumber || $0 == "-" || $0 == "." || $0 == "," || $0 == "'" || $0 == "\u{2019}" }
        guard !kept.isEmpty else { return nil }
        let style = FloatingPointFormatStyle<Double>(locale: locale)
        guard let value = try? Double(kept, format: style), value.isFinite else { return nil }
        return value
    }

    /// Today, as the computer writes days (YYYY-MM-DD, here).
    static func todayString(_ now: Date = Date(), calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }
}

/// A transaction a person types in on the phone: money in or out of one
/// account. Transfers, splits and receipts are for the computer.
struct NewTransaction: Sendable, Equatable {
    var date: Date
    var account: String
    /// Money out of the account (most purchases), or money in.
    var isMoneyIn: Bool
    /// Positive. The sign comes from `isMoneyIn`.
    var amount: Double
    var payee: String
    var category: String
    var note: String
    /// A receipt already kept on the computer (`SaveFinancesReceipt`), by name.
    var receipt: String? = nil
}

/// Changes to the ledger, made on the ledger exactly as the computer sent
/// it, for the same reason as `FinancePlanEdit`. The computer gives the
/// new transaction its id and checks it against the plan.
enum LedgerEdit {
    static let maxAmount = 1_000_000_000.0

    /// Why a transaction can't be saved yet, in words, or nil when it can.
    static func problem(with t: NewTransaction, accounts: Set<String>) -> String? {
        if !accounts.contains(t.account) { return "Choose an account." }
        if !t.amount.isFinite || FinancePlanEdit.roundedToCents(t.amount) <= 0 { return "Type in an amount." }
        if t.amount > maxAmount { return "That amount is too large." }
        if t.payee.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Say who was paid, or who paid." }
        if t.payee.count > 200 || t.note.count > 1000 || t.category.count > 100 { return "That's too long." }
        return nil
    }

    /// `ledger` with the transaction `id` linked to the planned payment
    /// `payment` (nil: linked to none, and said to pay none), and counted in
    /// full or not (`extra`, only with a payment), everything else it has
    /// kept: a loan's Link, Not this one and Count it. Nil for an unknown id.
    static func settingLink(id: String, payment: String?, extra: Bool = false, in ledger: JSONValue) -> JSONValue? {
        guard !id.isEmpty, case .object(var root) = ledger, case .array(var all)? = root["transactions"],
              let index = all.firstIndex(where: { $0["id"] == .string(id) }), case .object(var entry) = all[index] else { return nil }
        entry["payment"] = payment.map { .string($0) }
        entry["extra"] = payment != nil && extra ? .bool(true) : nil
        entry["notPlanned"] = payment == nil ? .bool(true) : nil
        all[index] = .object(entry)
        root["transactions"] = .array(all)
        return .object(root)
    }

    /// `ledger` without the transaction `id`, or nil when it has none by that id.
    static func removing(id: String, from ledger: JSONValue) -> JSONValue? {
        guard !id.isEmpty, case .object(var root) = ledger, case .array(let all)? = root["transactions"] else { return nil }
        let kept = all.filter { $0["id"] != .string(id) }
        guard kept.count == all.count - 1 else { return nil }
        root["transactions"] = .array(kept)
        return .object(root)
    }

    /// `ledger` with the transaction `id`'s day, amount, payee, category
    /// and note set from `t`. Every other field it has (splits, tags, bank
    /// id, receipt, a transfer's other account, the planned payment it
    /// pays) is kept. Nil when it can't be: an unknown id, a bad entry, or
    /// a transfer or split one, which is changed on the computer.
    static func updating(id: String, with t: NewTransaction, accounts: Set<String>, calendar: Calendar = .current, in ledger: JSONValue) -> JSONValue? {
        guard problem(with: t, accounts: accounts) == nil,
              case .object(var root) = ledger, case .array(var all)? = root["transactions"],
              let index = all.firstIndex(where: { $0["id"] == .string(id) }),
              case .object(var entry) = all[index]
        else { return nil }
        if case .string(let to)? = entry["to"], !to.isEmpty { return nil }
        if case .array(let splits)? = entry["splits"], !splits.isEmpty { return nil }

        let amount = FinancePlanEdit.roundedToCents(t.amount)
        entry["date"] = .string(FinancePlanEdit.todayString(t.date, calendar: calendar))
        entry["account"] = .string(t.account)
        entry["amount"] = .number(t.isMoneyIn ? amount : -amount)
        entry["payee"] = .string(t.payee.trimmingCharacters(in: .whitespacesAndNewlines))
        let category = t.category.trimmingCharacters(in: .whitespacesAndNewlines)
        entry["category"] = category.isEmpty ? nil : .string(category)
        let note = t.note.trimmingCharacters(in: .whitespacesAndNewlines)
        entry["note"] = note.isEmpty ? nil : .string(note)
        all[index] = .object(entry)
        root["transactions"] = .array(all)
        return .object(root)
    }

    /// `ledger` with the transaction `id`'s category set (or cleared, for
    /// ""), everything else it has kept. Nil when it can't be: an unknown
    /// id, a bad entry, a category too long, or a transfer or split one.
    static func settingCategory(id: String, to category: String, in ledger: JSONValue) -> JSONValue? {
        let category = category.trimmingCharacters(in: .whitespacesAndNewlines)
        guard category.count <= 100,
              case .object(var root) = ledger, case .array(var all)? = root["transactions"],
              let index = all.firstIndex(where: { $0["id"] == .string(id) }),
              case .object(var entry) = all[index]
        else { return nil }
        if case .string(let to)? = entry["to"], !to.isEmpty { return nil }
        if case .array(let splits)? = entry["splits"], !splits.isEmpty { return nil }
        entry["category"] = category.isEmpty ? nil : .string(category)
        all[index] = .object(entry)
        root["transactions"] = .array(all)
        return .object(root)
    }

    /// Whether the phone can change `t`: not a transfer or a split one.
    static func canUpdate(_ t: FinanceTransaction) -> Bool {
        (t.to ?? "").isEmpty && !t.isSplit
    }

    /// `ledger` with `t` added at the end, or nil when it can't be. The
    /// computer keeps the order by day itself.
    static func appending(_ t: NewTransaction, accounts: Set<String>, calendar: Calendar = .current, to ledger: JSONValue) -> JSONValue? {
        guard problem(with: t, accounts: accounts) == nil else { return nil }
        var root: [String: JSONValue]
        switch ledger {
        case .object(let o): root = o
        case .null: root = [:]
        default: return nil
        }
        var transactions: [JSONValue]
        switch root["transactions"] {
        case .array(let a)?: transactions = a
        case .null?, nil: transactions = []
        default: return nil
        }
        let amount = FinancePlanEdit.roundedToCents(t.amount)
        var entry: [String: JSONValue] = [
            "date": .string(FinancePlanEdit.todayString(t.date, calendar: calendar)),
            "account": .string(t.account),
            "amount": .number(t.isMoneyIn ? amount : -amount),
            "payee": .string(t.payee.trimmingCharacters(in: .whitespacesAndNewlines)),
        ]
        let category = t.category.trimmingCharacters(in: .whitespacesAndNewlines)
        if !category.isEmpty { entry["category"] = .string(category) }
        let note = t.note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !note.isEmpty { entry["note"] = .string(note) }
        if let receipt = t.receipt {
            guard ReceiptCodec.isValidName(receipt) else { return nil }
            entry["receipt"] = .string(receipt)
        }
        transactions.append(.object(entry))
        root["transactions"] = .array(transactions)
        return .object(root)
    }
}
