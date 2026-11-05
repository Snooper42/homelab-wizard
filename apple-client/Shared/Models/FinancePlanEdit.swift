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
        transactions.append(.object(entry))
        root["transactions"] = .array(transactions)
        return .object(root)
    }
}
