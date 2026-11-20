import Foundation

/// What Transactions offers to sort (the owner's yes, Nov 20, on the
/// canvas's *Idea: Sort these on Transactions*), as the computer's two cards
/// at its top (web/src/finances/Transactions.tsx's `LinksWidget` and
/// `PairsWidget`, importData.ts's `suggestLinks` and `pairs`): rows that look
/// like a planned payment, to Link or say Not It; and money out of one of the
/// household's accounts with the same into another, to Join as one transfer
/// or say Not One Transfer.
enum TransactionReview {
    /// A row and the planned payment it looks like it pays, on that day.
    struct Link: Sendable, Equatable, Identifiable {
        let id: String
        let payment: String
        let due: String
    }

    /// Money out of one account (`out`) and the same into another (`into`), by id.
    struct Pair: Sendable, Equatable, Identifiable {
        let out: String
        let into: String
        var id: String { out + "+" + into }
    }

    /// Each row linked to nothing, not said to pay nothing and not a
    /// transfer that plainly pays a planned payment (not a card's), oldest
    /// first so each planned day is taken once; listed newest first.
    static func links(_ ledger: [BankImport.Kept], plan: JSONValue?, view: JSONValue?, checking: String, logos: PayeeLogos) -> [Link] {
        let payments = BankGuess.payments(in: plan).filter { $0.card == nil }
        let dues = BankGuess.dues(in: view)
        var taken = BankGuess.paidDays(ledger, dues: dues)
        let learned = BankGuess.learnedLinks(ledger, logos: logos)
        let same = { (payee: String, x: BankGuess.Payment) in
            BankGuess.paysBill(payee, x, logos: logos) || learned[BankGuess.payeeKey(payee, logos: logos)]?.contains(x.id) == true
        }
        var found: [String: Link] = [:]
        for t in ledger.enumerated().sorted(by: { ($0.element.date, $0.offset) < ($1.element.date, $1.offset) }).map(\.element) {
            if t.id.isEmpty || t.payment != nil || t.notPlanned || t.to != nil { continue }
            guard let g = BankGuess.plannedFor(date: t.date, amount: t.amount, payee: t.payee, account: t.account, payments: payments,
                                               dues: dues, checking: checking, taken: taken, same: same) else { continue }
            taken.insert(g.key)
            found[t.id] = Link(id: t.id, payment: g.payment, due: g.due)
        }
        // As the ledger lists them, newest last: so the newest first.
        return ledger.reversed().compactMap { found[$0.id] }
    }

    /// Each money-out row and a money-in row on another account for the same
    /// amount, within three days, neither a transfer, linked, split or said
    /// apart; the nearest days first, each row in one pair; newest first.
    static func pairs(_ ledger: [BankImport.Kept]) -> [Pair] {
        let free = ledger.filter { !$0.id.isEmpty && $0.to == nil && $0.payment == nil && !$0.apart && !$0.isSplit }
        let outs = free.filter { $0.amount < 0 }, ins = free.filter { $0.amount > 0 }
        var all: [(out: BankImport.Kept, into: BankImport.Kept, gap: Int)] = []
        for o in outs {
            for i in ins where i.account != o.account && abs(i.amount + o.amount) < 0.005 {
                let gap = abs(dayNumber(i.date) - dayNumber(o.date))
                if gap <= BankImport.pairDays { all.append((o, i, gap)) }
            }
        }
        var used = Set<String>()
        var out: [(out: BankImport.Kept, into: BankImport.Kept)] = []
        for p in all.sorted(by: { ($0.gap, $0.out.date) < ($1.gap, $1.out.date) }) {
            if used.contains(p.out.id) || used.contains(p.into.id) { continue }
            used.insert(p.out.id)
            used.insert(p.into.id)
            out.append((p.out, p.into))
        }
        return out.sorted { $0.out.date > $1.out.date }.map { Pair(out: $0.out.id, into: $0.into.id) }
    }

    private static func dayNumber(_ s: String) -> Int {
        guard let d = LocalDay.parse(s) else { return 0 }
        return Int((d.timeIntervalSince1970 / 86_400).rounded())
    }
}
