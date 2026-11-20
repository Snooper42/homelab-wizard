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
    case move(id: String, to: String)
    /// What a bank's file gave a row brought in before (import 3 of 4).
    case fix(id: String, LedgerFix)
    /// Transactions' sorting (`TransactionReview`): linked to a planned
    /// payment, or said to pay none (nil, Not It); `unlink` is their Undo.
    case link(id: String, payment: String?)
    case unlink(id: String)
    /// Two rows joined as one transfer; `unjoin` puts them back as they were.
    case join(out: String, into: String)
    case unjoin(out: JSONValue, into: JSONValue)
    /// Said not one transfer, or not any more (its Undo).
    case apart(ids: [String], Bool)

    /// `ledger` with this change made, or nil when it can't be. `accounts`
    /// are the plan's, for a transaction's account.
    func apply(to ledger: JSONValue, accounts: Set<String>) -> JSONValue? {
        switch self {
        case .add(let t): LedgerEdit.appending(t, accounts: accounts, to: ledger)
        case .update(let id, let t): LedgerEdit.updating(id: id, with: t, accounts: accounts, in: ledger)
        case .category(let id, let to): LedgerEdit.settingCategory(id: id, to: to, in: ledger)
        case .delete(let id): LedgerEdit.removing(id: id, from: ledger)
        case .move(let id, let to): LedgerEdit.moving(id: id, to: to, accounts: accounts, in: ledger)
        case .fix(let id, let fix): LedgerEdit.fixing(id: id, with: fix, in: ledger)
        case .link(let id, let payment): LedgerEdit.settingLink(id: id, payment: payment, in: ledger)
        case .unlink(let id): LedgerEdit.clearingLink(id: id, in: ledger)
        case .join(let out, let into): LedgerEdit.joining(out: out, into: into, in: ledger)
        case .unjoin(let out, let into): LedgerEdit.unjoining(out: out, into: into, in: ledger)
        case .apart(let ids, let on): LedgerEdit.settingApart(ids, on, in: ledger)
        }
    }

    /// The transaction it changes; nil for one it adds.
    var transaction: String? {
        switch self {
        case .add: nil
        case .update(let id, _), .category(let id, _), .delete(let id), .move(let id, _), .fix(let id, _),
             .link(let id, _), .unlink(let id), .join(let id, _): id
        case .unjoin(let out, _): Self.id(of: out)
        case .apart(let ids, _): ids.first
        }
    }

    private static func id(of row: JSONValue) -> String? {
        if case .string(let id)? = row["id"] { return id }
        return nil
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
        case .move:
            out.removeAll { if case .move(let other, _) = $0 { return other == id }; return false }
        case .add, .fix, .link, .unlink, .join, .unjoin, .apart:
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
