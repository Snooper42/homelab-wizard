import Foundation

/// The line under Transactions' review strip, as the redesign's picture
/// (1 needs a category*): what
/// looks like a planned payment or a transfer, sorted just under it, and how
/// many of the new ones have no category yet. Nil when there's nothing to say.
enum ReviewStrip {
    static func line(bills: Int, transfers: Int, uncategorized: Int) -> String? {
        var parts: [String] = []
        if bills > 0 { parts.append(bills == 1 ? "1 looks like a bill" : "\(bills) look like bills") }
        if transfers > 0 { parts.append(transfers == 1 ? "1 looks like a transfer" : "\(transfers) look like transfers") }
        if uncategorized > 0 { parts.append(uncategorized == 1 ? "1 needs a category" : "\(uncategorized) need a category") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The new ones without a category: neither a move between the household's own accounts nor split.
    static func uncategorized(_ new: [FinanceTransaction]) -> Int {
        new.filter { $0.category.isEmpty && ($0.to ?? "").isEmpty && !$0.isSplit }.count
    }
}
