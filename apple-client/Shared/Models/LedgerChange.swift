import Foundation

/// One change made to the ledger on this phone while the Homelab didn't
/// answer (offline Finances 3 of 3): kept as what it does, and replayed on
/// the computer's newest ledger once it answers, as the plan's changes are
/// (`FinanceChange`). Each is a `LedgerEdit`, the same edit the phone sends
/// at home. A transaction added away gets its id from the computer, so it's
/// changed once home; one the computer no longer has is left out.
enum LedgerChange: Codable, Sendable, Equatable {
    case add(NewTransaction)
    case update(id: String, NewTransaction)
    case category(id: String, to: String)
    case delete(id: String)

    /// `ledger` with this change made, or nil when it can't be. `accounts`
    /// are the plan's, for a transaction's account.
    func apply(to ledger: JSONValue, accounts: Set<String>) -> JSONValue? {
        switch self {
        case .add(let t): LedgerEdit.appending(t, accounts: accounts, to: ledger)
        case .update(let id, let t): LedgerEdit.updating(id: id, with: t, accounts: accounts, in: ledger)
        case .category(let id, let to): LedgerEdit.settingCategory(id: id, to: to, in: ledger)
        case .delete(let id): LedgerEdit.removing(id: id, from: ledger)
        }
    }

    /// The transaction it changes; nil for one it adds.
    var transaction: String? {
        switch self {
        case .add: nil
        case .update(let id, _), .category(let id, _), .delete(let id): id
        }
    }

    /// `changes` with `change` made after them: a later change to the same
    /// transaction takes the place of an earlier one that set its category
    /// or its fields (a delete takes the place of all of them).
    static func adding(_ change: LedgerChange, to changes: [LedgerChange]) -> [LedgerChange] {
        guard let id = change.transaction else { return changes + [change] }
        var out = changes
        switch change {
        case .delete:
            out.removeAll { $0.transaction == id }
        case .update:
            out.removeAll { if case .update(let other, _) = $0 { return other == id }; return false }
        case .category:
            out.removeAll { if case .category(let other, _) = $0 { return other == id }; return false }
        case .add:
            break
        }
        out.append(change)
        return out
    }

    /// `changes` made in order on `newest`, with the indexes of those that
    /// couldn't be (what they change is gone there).
    static func replay(_ changes: [LedgerChange], on newest: JSONValue, accounts: Set<String>) -> (ledger: JSONValue, dropped: [Int]) {
        var ledger = newest
        var dropped: [Int] = []
        for (i, change) in changes.enumerated() {
            if let next = change.apply(to: ledger, accounts: accounts) { ledger = next } else { dropped.append(i) }
        }
        return (ledger, dropped)
    }
}
