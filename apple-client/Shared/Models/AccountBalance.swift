import Foundation

/// An account's balance at the end of each day, worked back (and on) from
/// its balance as typed in on its day, through every transaction in or out
/// of it: the computer's `balanceAfter` (web/src/finances/model.ts), for an
/// account's page. Not for a home, a car, or a collectible, whose worth no
/// transaction moves: `runs` says which do.
enum AccountBalance {
    /// Whether its balance can be worked through its transactions.
    static func runs(_ a: FinanceAccount) -> Bool {
        a.updated != nil && a.balance != nil && !["home", "car", "collectible"].contains(a.kind)
    }

    /// What it held (a card or loan: owed) at the end of `day`; nil when it
    /// can't say (no balance typed in on a day).
    static func after(_ a: FinanceAccount, _ all: [FinanceTransaction], day: Date) -> Double? {
        guard let at = a.updated, let balance = a.balance else { return nil }
        let sign: Double = a.isOwed ? -1 : 1
        func effect(_ t: FinanceTransaction) -> Double {
            (t.account == a.id ? t.amount : t.to == a.id ? -t.amount : 0) * sign
        }
        return all.reduce(balance) { n, t in
            guard let d = t.date else { return n }
            if day < at { return d > day && d <= at ? n - effect(t) : n }
            return d > at && d <= day ? n + effect(t) : n
        }
    }

    /// The end of each of the last `days` days and today, oldest first; empty
    /// when it can't be worked out. Each day is noon, as LocalDay reads the
    /// computer's days, so a transaction falls on its own day.
    static func series(_ a: FinanceAccount, _ all: [FinanceTransaction], today: Date, days: Int, calendar: Calendar = Calendar(identifier: .gregorian)) -> [NetWorthPoint] {
        guard runs(a), let start = calendar.date(bySettingHour: 12, minute: 0, second: 0, of: today) else { return [] }
        return (0...max(days, 1)).reversed().compactMap { back in
            guard let day = calendar.date(byAdding: .day, value: -back, to: start),
                  let value = after(a, all, day: day) else { return nil }
            return NetWorthPoint(date: day, value: value)
        }
    }

    /// Transactions' running balance for one account: for
    /// each day in `shown` (newest first), its latest transaction, by id,
    /// with what the account held (a card or loan: owed) after the day, as
    /// the computer's Transactions shows it once a day. Empty when it can't
    /// be worked out (a home, a car, a collectible, no balance typed in).
    static func daily(_ a: FinanceAccount, _ all: [FinanceTransaction], shown: [FinanceTransaction],
                      calendar: Calendar = Calendar(identifier: .gregorian)) -> [String: Double] {
        guard runs(a) else { return [:] }
        var out: [String: Double] = [:]
        var lastDay: Date?
        for t in shown {
            guard let d = t.date, t.account == a.id || t.to == a.id else { continue }
            if let lastDay, calendar.isDate(lastDay, inSameDayAs: d) { continue }
            lastDay = d
            if let after = after(a, all, day: d) { out[t.id] = after }
        }
        return out
    }

    /// Its transactions in or out, newest first.
    static func mine(_ a: FinanceAccount, _ all: [FinanceTransaction]) -> [FinanceTransaction] {
        all.filter { $0.account == a.id || $0.to == a.id }
            .sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
    }
}
