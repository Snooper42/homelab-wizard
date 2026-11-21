import Foundation

/// Transactions' search, as the computer's (Transactions.tsx's `wordsOf`):
/// each word typed is somewhere in the payee, its categories, the note, a
/// tag, its accounts, the amount as typed or as shown (86.10, 1,240.55), so a
/// charge is found by what it came to, or its day as shown (Oct 28).
struct TransactionSearch {
    /// The words typed, lower case; none finds everything.
    let wanted: [String]
    private let day: DateFormatter

    init(_ query: String, locale: Locale = .current, timeZone: TimeZone = .current) {
        wanted = query.lowercased().split(whereSeparator: \.isWhitespace).map(String.init)
        let day = DateFormatter()
        day.locale = locale
        day.timeZone = timeZone
        day.setLocalizedDateFormatFromTemplate("MMMd")
        self.day = day
    }

    var isEmpty: Bool { wanted.isEmpty }

    /// Whether every word typed is in `t`'s words. `accountName` is an
    /// account's name by id.
    func finds(_ t: FinanceTransaction, accountName: (String) -> String?) -> Bool {
        guard !wanted.isEmpty else { return true }
        let words = self.words(t, accountName: accountName)
        return wanted.allSatisfy { words.contains($0) }
    }

    /// What a search looks through, lower case.
    func words(_ t: FinanceTransaction, accountName: (String) -> String?) -> String {
        var parts = [t.payee]
        parts += t.splits.isEmpty ? [t.category] : t.splits.map(\.category)
        parts.append(t.note)
        parts += t.tags
        parts.append(accountName(t.account) ?? "")
        if let to = t.to, !to.isEmpty { parts.append(accountName(to) ?? "") }
        parts += Self.amountWords(t.amount)
        if let date = t.date { parts.append(day.string(from: date)) }
        return parts.filter { !$0.isEmpty }.joined(separator: " ").lowercased()
    }

    /// An amount as typed and as shown, without its sign: "1850.00" and
    /// "1,850.00" (the computer's en-US way, whatever the phone's language).
    static func amountWords(_ amount: Double) -> [String] {
        let plain = String(format: "%.2f", abs(amount))
        guard let dot = plain.firstIndex(of: ".") else { return [plain] }
        var whole = String(plain[..<dot])
        var grouped = ""
        while whole.count > 3 {
            grouped = "," + String(whole.suffix(3)) + grouped
            whole = String(whole.dropLast(3))
        }
        grouped = whole + grouped + String(plain[dot...])
        return grouped == plain ? [plain] : [plain, grouped]
    }
}
