import Foundation

/// A transfer's second line in a list of transactions, short enough for one
/// line on a phone: the payee already names one end ("Roth IRA"), so the
/// line names the other ("From Chase Checking"), and both only when the
/// payee is neither (apple-loop.md item 1: "Chase Checking →…" was cut off).
enum TransferWords {
    static func line(payee: String, from: String, to: String) -> String {
        let p = payee.trimmingCharacters(in: .whitespaces)
        if p.caseInsensitiveCompare(to) == .orderedSame { return "From \(from)" }
        if p.caseInsensitiveCompare(from) == .orderedSame { return "To \(to)" }
        return "\(from) → \(to)"
    }
}
