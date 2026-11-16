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

    /// How often a new payment comes, in the order the computer's Add a payment
    /// offers them. Twice a month and With each paycheck are the computer's for now.
    static let paymentEveries: [(id: String, title: String)] = [
        ("month", "Monthly"), ("2 weeks", "Every 2 weeks"), ("week", "Weekly"), ("twice a month", "Twice a month"),
        ("3 months", "Every 3 months"), ("year", "Yearly"), ("once", "Once"),
    ]

    /// The accounts money from someone outside the household can go into.
    static let paymentToKinds: Set<String> = ["checking", "savings"]

    /// What a payment is for, as the computer names them (`kindName`).
    static let paymentKinds: [(id: String, title: String)] = [
        ("home", "Home"), ("utilities", "Utilities"), ("car", "Car"), ("subscriptions", "Subscriptions"),
        ("loans", "Loans"), ("cards", "Cards"), ("spending", "Spending"), ("savings", "Saving"), ("other", "Other"),
    ]

    /// The accounts a payment can come out of: checking, savings, or a card it's charged to.
    static let paymentFromKinds: Set<String> = ["checking", "savings", "card"]

    /// `plan` with a new payment, as the computer's Add a payment makes one:
    /// its name, what it costs each time (about this much, for one that
    /// changes), how often from its next day, what it's for, and the account
    /// it comes out of (empty: the first checking account, as the computer
    /// reads it). The computer gives it its id. Nil for no name, an amount
    /// that isn't more than nothing, an unknown schedule or kind, a day that
    /// isn't one, or an account the plan doesn't have or a payment can't
    /// come out of.
    static func addingPayment(name: String, amount: Double, every: String, start: String, kind: String,
                              from: String, estimate: Bool, in plan: JSONValue) -> JSONValue? {
        addingPayment(NewPayment(name: name, amount: amount, every: every, start: start, kind: kind, from: from, estimate: estimate), in: plan)
    }

    /// `plan` with a new payment, as the computer's Add a payment makes one
    /// (finance.Payment, Schedule.check): out of an account, or (`payer`) money
    /// in from someone outside the household into `to`; monthly and the rest
    /// from `start`, twice a month on `start`'s day and `day2`, or with each
    /// paycheck (`person`'s, or every one into checking). Nil when it can't be.
    static func addingPayment(_ p: NewPayment, in plan: JSONValue) -> JSONValue? {
        let name = p.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let payer = (p.payer ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let cents = roundedToCents(p.amount)
        guard !name.isEmpty, name.count <= 80, payer.count <= 80,
              p.amount.isFinite, cents > 0, cents <= maxBalance,
              p.every == "paycheck" || paymentEveries.contains(where: { $0.id == p.every }),
              paymentKinds.contains(where: { $0.id == p.kind }),
              case .object(var root) = plan
        else { return nil }
        func account(_ id: String, in kinds: Set<String>) -> Bool {
            guard case .array(let accounts)? = root["accounts"],
                  let a = accounts.first(where: { $0["id"] == .string(id) }),
                  case .string(let kind)? = a["kind"] else { return false }
            return kinds.contains(kind)
        }
        var schedule: [String: JSONValue] = ["every": .string(p.every)]
        if p.every == "paycheck" {
            if let person = p.person, !person.isEmpty {
                guard case .array(let people)? = root["people"], people.contains(where: { $0["id"] == .string(person) }) else { return nil }
                schedule["person"] = .string(person)
            }
            if LocalDay.parse(p.start) != nil { schedule["start"] = .string(p.start) }
        } else {
            guard let first = LocalDay.parse(p.start) else { return nil }
            schedule["start"] = .string(p.start)
            if p.every == "twice a month" {
                let day = Calendar(identifier: .gregorian).component(.day, from: first)
                guard let day2 = p.day2, (1...31).contains(day2), day2 != day else { return nil }
                schedule["day2"] = .number(Double(day2))
            }
        }
        // One that ends: a day, and not before it starts (Schedule.checkUntil); once has none.
        if let until = p.until, !until.isEmpty, p.every != "once" {
            guard LocalDay.parse(until) != nil, p.every == "paycheck" || until >= p.start else { return nil }
            schedule["until"] = .string(until)
        }
        var payment: [String: JSONValue] = [
            "name": .string(name),
            "amount": .number(cents),
            "schedule": .object(schedule),
            "kind": .string(p.kind),
        ]
        if !payer.isEmpty {
            // Money in: from someone, out of none of the household's accounts.
            guard p.from.isEmpty else { return nil }
            payment["payer"] = .string(payer)
            if let to = p.to, !to.isEmpty {
                guard account(to, in: paymentToKinds) else { return nil }
                payment["to"] = .string(to)
            }
        } else {
            if !p.from.isEmpty {
                guard account(p.from, in: paymentFromKinds) else { return nil }
                payment["from"] = .string(p.from)
            }
            if p.estimate { payment["estimate"] = .bool(true) }
        }
        var payments: [JSONValue] = []
        if case .array(let have)? = root["payments"] { payments = have }
        payments.append(.object(payment))
        root["payments"] = .array(payments)
        return .object(root)
    }

    /// The accounts a goal can count a share of (`goalKinds` on the computer).
    static let goalFromKinds: Set<String> = ["checking", "savings", "investment", "retirement", "other"]

    /// How much of `account` the plan's goals already count, in percent.
    static func goalShareGiven(of account: String, in plan: JSONValue) -> Double {
        guard case .object(let root) = plan, case .array(let goals)? = root["goals"] else { return 0 }
        var given = 0.0
        for goal in goals {
            guard case .array(let shares)? = goal["shares"] else { continue }
            for share in shares where share["account"] == .string(account) {
                if case .number(let p)? = share["percent"] { given += p }
            }
        }
        return given
    }

    /// `plan` with a new goal, as the computer's Add a goal makes one: its
    /// name, what it needs, the day it's wanted by (or none: whenever), and a
    /// share of one account's balance that counts toward it. The computer
    /// gives it its id. Nil for no name, a target that isn't more than
    /// nothing, a day that isn't one, an account the plan doesn't have or that
    /// holds no money to put by, or a share past what's left of the account
    /// once the other goals have theirs.
    static func addingGoal(name: String, target: Double, date: String?, account: String, percent: Double,
                           in plan: JSONValue) -> JSONValue? {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cents = roundedToCents(target)
        guard !name.isEmpty, name.count <= 80,
              target.isFinite, cents > 0, cents <= maxBalance,
              date.map({ $0.count == 10 && LocalDay.parse($0) != nil }) ?? true,
              percent.isFinite, percent > 0, percent <= 100,
              goalShareGiven(of: account, in: plan) + percent <= 100 + 1e-9,
              case .object(var root) = plan,
              case .array(let accounts)? = root["accounts"],
              let held = accounts.first(where: { $0["id"] == .string(account) }),
              case .string(let kind)? = held["kind"], goalFromKinds.contains(kind)
        else { return nil }
        var goal: [String: JSONValue] = [
            "name": .string(name),
            "target": .number(cents),
            "shares": .array([.object(["account": .string(account), "percent": .number(percent)])]),
        ]
        if let date { goal["date"] = .string(date) }
        var goals: [JSONValue] = []
        if case .array(let have)? = root["goals"] { goals = have }
        goals.append(.object(goal))
        root["goals"] = .array(goals)
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
struct NewTransaction: Sendable, Equatable, Codable {
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
    /// The bank's own ID for it (an OFX statement's FITID), from a bank's
    /// file: the next import of that file knows it's in.
    var bank: String? = nil
    /// The planned payment it pays, by id (from a bank's file, import 2 of 3).
    var payment: String? = nil
    /// A move between the household's own accounts: the one the money went
    /// into, and that bank's ID for its arriving half. It has no category.
    var to: String? = nil
    var toBank: String? = nil
}

/// What a bank's file gives a row brought in before (import 3 of 4): a
/// payee in place of its own, and the rest only where it has none.
struct LedgerFix: Sendable, Equatable, Codable {
    var payee: String? = nil
    var note: String? = nil
    var category: String? = nil
    var institution: String? = nil
    var bank: String? = nil
}

/// Changes to the ledger, made on the ledger exactly as the computer sent
/// it, for the same reason as `FinancePlanEdit`. The computer gives the
/// new transaction its id and checks it against the plan.
enum LedgerEdit {
    static let maxAmount = 1_000_000_000.0

    /// Why a transaction can't be saved yet, in words, or nil when it can.
    static func problem(with t: NewTransaction, accounts: Set<String>) -> String? {
        if !accounts.contains(t.account) { return "Choose an account." }
        if let to = t.to, !accounts.contains(to) || to == t.account { return "Choose the account it moved to." }
        if !t.amount.isFinite || FinancePlanEdit.roundedToCents(t.amount) <= 0 { return "Type in an amount." }
        if t.amount > maxAmount { return "That amount is too large." }
        if t.payee.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Say who was paid, or who paid." }
        if t.payee.count > 200 || t.note.count > 1000 || t.category.count > 100 { return "That's too long." }
        return nil
    }

    /// `ledger` with the transaction `id` given what a bank's file says of
    /// it: its payee (but a transfer's), and a note, category, logo and the
    /// bank's ID only where it has none; everything else it has kept. Nil for
    /// an unknown id, or a split one whose category is asked for.
    static func fixing(id: String, with fix: LedgerFix, in ledger: JSONValue) -> JSONValue? {
        guard !id.isEmpty, case .object(var root) = ledger, case .array(var all)? = root["transactions"],
              let index = all.firstIndex(where: { $0["id"] == .string(id) }), case .object(var entry) = all[index] else { return nil }
        func empty(_ key: String) -> Bool {
            if case .string(let v)? = entry[key] { return v.trimmingCharacters(in: .whitespaces).isEmpty }
            return true
        }
        func fill(_ key: String, _ value: String?, limit: Int) {
            guard let v = value?.trimmingCharacters(in: .whitespacesAndNewlines), !v.isEmpty, empty(key) else { return }
            entry[key] = .string(String(v.prefix(limit)))
        }
        if let payee = fix.payee?.trimmingCharacters(in: .whitespacesAndNewlines), !payee.isEmpty {
            entry["payee"] = .string(String(payee.prefix(200)))
        }
        fill("note", fix.note, limit: 1000)
        if fix.category != nil, case .array(let parts)? = entry["splits"], !parts.isEmpty { return nil }
        if empty("to") { fill("category", fix.category, limit: 100) }
        fill("institution", fix.institution, limit: 100)
        fill("bank", fix.bank, limit: 200)
        all[index] = .object(entry)
        root["transactions"] = .array(all)
        return .object(root)
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

    /// `ledger` with the transaction `id` moved to `account` (a purchase put
    /// on the wrong card, say). Everything else it has is kept. Nil for an
    /// unknown id or account, or a transfer, whose two accounts are changed
    /// on the computer.
    static func moving(id: String, to account: String, accounts: Set<String>, in ledger: JSONValue) -> JSONValue? {
        guard !id.isEmpty, accounts.contains(account),
              case .object(var root) = ledger, case .array(var all)? = root["transactions"],
              let index = all.firstIndex(where: { $0["id"] == .string(id) }),
              case .object(var entry) = all[index]
        else { return nil }
        if case .string(let to)? = entry["to"], !to.isEmpty { return nil }
        entry["account"] = .string(account)
        all[index] = .object(entry)
        root["transactions"] = .array(all)
        return .object(root)
    }

    /// Selected together: `edit` made for each of `ids` that it can be, with
    /// the ids it was made for (a transfer or split one is left as it is).
    /// Nil when it couldn't be made for any.
    static func each(_ ids: [String], in ledger: JSONValue,
                     _ edit: (String, JSONValue) -> JSONValue?) -> (ledger: JSONValue, done: [String])? {
        var out = ledger
        var done: [String] = []
        for id in ids {
            if let next = edit(id, out) {
                out = next
                done.append(id)
            }
        }
        return done.isEmpty ? nil : (out, done)
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
        if let bank = t.bank?.trimmingCharacters(in: .whitespacesAndNewlines), !bank.isEmpty { entry["bank"] = .string(bank) }
        if let payment = t.payment, !payment.isEmpty, t.to == nil { entry["payment"] = .string(payment) }
        if let to = t.to {
            entry["to"] = .string(to)
            entry.removeValue(forKey: "category")
            if let toBank = t.toBank?.trimmingCharacters(in: .whitespacesAndNewlines), !toBank.isEmpty { entry["toBank"] = .string(toBank) }
        }
        transactions.append(.object(entry))
        root["transactions"] = .array(transactions)
        return .object(root)
    }
}

/// A payment typed on the phone's Add Payment (the owner's mock, Nov 15):
/// out of an account, or money in from someone outside the household, on a
/// schedule that may be twice a month or with each paycheck.
struct NewPayment: Codable, Sendable, Equatable {
    var name = ""
    var amount = 0.0
    var every = "month"
    /// YYYY-MM-DD; for "paycheck", the day it was added (the computer needs none).
    var start = ""
    /// Twice a month: the second day of the month.
    var day2: Int? = nil
    /// With each paycheck: whose, by id; nil or "" for every one into checking.
    var person: String? = nil
    var kind = "other"
    /// Out of: an account's id, "" for checking.
    var from = ""
    var estimate = false
    /// Money in: who sends it, and the account it goes into ("" or nil for checking).
    var payer: String? = nil
    var to: String? = nil
    /// Its last day (YYYY-MM-DD) for one that ends: a lease to Jan 2027 (`Schedule.Until`).
    var until: String? = nil
}
