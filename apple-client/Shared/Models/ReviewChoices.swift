import Foundation

/// The categories a new transaction's review card offers: its own first, then
/// those its payee's other transactions had (the most often first), then the
/// household's most used; each once, `limit` at most.
enum ReviewChoices {
    static func categories(for t: FinanceTransaction, others: [FinanceTransaction], all: [FinanceTransaction], limit: Int = 5) -> [String] {
        var out: [String] = []
        func add(_ name: String) {
            guard !name.isEmpty, out.count < limit, !out.contains(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) else { return }
            out.append(name)
        }
        add(t.category)
        for name in byUse(others) { add(name) }
        for name in byUse(all.filter { ($0.to ?? "").isEmpty }) { add(name) }
        return out
    }

    /// Categories by how often they're used, the most first, then A to Z.
    private static func byUse(_ ts: [FinanceTransaction]) -> [String] {
        var count: [String: Int] = [:]
        for t in ts where !t.category.isEmpty { count[t.category, default: 0] += 1 }
        return count.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.map(\.key)
    }
}
