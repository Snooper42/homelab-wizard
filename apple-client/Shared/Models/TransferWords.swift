import Foundation

/// A transfer's second line in a list of transactions, short enough for one
/// line on a phone: the payee already names one end ("Roth IRA"), so the
/// line names the other ("From Chase Checking"), and both only when the
/// payee is neither.
enum TransferWords {
    static func line(payee: String, from: String, to: String) -> String {
        let p = payee.trimmingCharacters(in: .whitespaces)
        if p.caseInsensitiveCompare(to) == .orderedSame { return "From \(from)" }
        if p.caseInsensitiveCompare(from) == .orderedSame { return "To \(to)" }
        return "\(from) → \(to)"
    }
}

/// A row's second line from its parts ("Groceries", "Oct 30"), joined by " · "
/// with a no-break space before the dot, so a line too long for a phone breaks
/// after it and the dot never starts the next line ("From Chase Checking" over
/// "· Oct 27" in light-inbox and Transactions, Nov 19).
enum RowWords {
    static func line(_ parts: [String?]) -> String {
        parts.compactMap { $0?.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: "\u{00A0}· ")
    }
}
