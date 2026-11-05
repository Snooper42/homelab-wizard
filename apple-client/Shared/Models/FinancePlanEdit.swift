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
