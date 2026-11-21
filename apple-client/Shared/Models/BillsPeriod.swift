import Foundation

/// A pay period on Bills as the computer's (widgets/Paycheck.tsx, the
/// owner's yes, Nov 21, on the canvas's *Idea: Bills*): whose paycheck
/// starts it, checking on payday once its own payments are out, every
/// account after it with what changed, and how each bill is paid.
enum BillsPeriod {
    /// "Alex's paycheck", "Alex and Sam's paycheck" (Paycheck.tsx's `names`).
    static func payWords(_ pay: FinancePayday, people: [FinancePerson]) -> String {
        let names = pay.people.map { id in people.first { $0.id == id }?.name ?? id }
        return "\(names.joined(separator: " and "))'s paycheck"
    }

    /// Checking at the end of payday, once that day's own payments are out
    /// (a savings transfer, a card paid off), before the bills after it;
    /// nil for the first period (now), or a day not read ahead.
    static func onPayday(_ period: FinancePeriod, in view: FinancesPlanView) -> Double? {
        guard !period.now, let day = period.pay?.dateText else { return nil }
        return view.dayBalances[day]
    }

    /// How a bill is paid, under its name (Paycheck.tsx's `via`): from
    /// someone outside the household; on a card, or from another account,
    /// for one that isn't checking's; else its kind ("Utilities").
    static func via(_ row: FinanceRow, in view: FinancesPlanView) -> String {
        let x = view.payment(row.payment)
        if let payer = x?.payer, !payer.isEmpty { return "from \(payer)" }
        if row.outside || row.into {
            let source = view.plan.accounts.first { $0.id == x?.from }
            return (source?.kind == "card" ? "on " : "from ") + (source?.name ?? "another account")
        }
        return FinanceFlow.kindName(x?.kind ?? "other")
    }

    /// One account after a period: what it holds (or, for cards, what they
    /// owe together) and how much that changed since the period before.
    struct Tile: Identifiable, Equatable, Sendable {
        let id: String
        let name: String
        let after: Double
        let change: Double
        /// Cards: `after` is what they owe.
        let owes: Bool
    }

    /// The accounts after the period at `index`, as the computer's tiles:
    /// checking, savings, investments and retirement each on their own, the
    /// cards together, the collectibles together; a loan, home or car is Net
    /// worth's. The period before the first is today.
    static func tiles(_ index: Int, in view: FinancesPlanView) -> [Tile] {
        guard view.periods.indices.contains(index) else { return [] }
        let period = view.periods[index]
        let before = index > 0 ? view.periods[index - 1] : nil
        func at(_ a: FinanceAccount, _ p: FinancePeriod?) -> Double {
            p?.accounts[a.id] ?? view.start[a.id] ?? a.balance ?? 0
        }
        let accounts = view.plan.accounts
        var out: [Tile] = accounts.filter { ["checking", "savings", "investment", "retirement"].contains($0.kind) }.map { a in
            Tile(id: a.id, name: a.name, after: at(a, period), change: at(a, period) - at(a, before), owes: false)
        }
        let cards = accounts.filter { $0.kind == "card" }
        if !cards.isEmpty {
            let after = cards.reduce(0.0) { $0 + at($1, period) }, was = cards.reduce(0.0) { $0 + at($1, before) }
            out.append(Tile(id: "cards", name: cards.count == 1 ? cards[0].name : "Cards", after: after, change: after - was, owes: true))
        }
        let held = accounts.filter { $0.kind == "collectible" }
        if !held.isEmpty {
            let after = held.reduce(0.0) { $0 + at($1, period) }, was = held.reduce(0.0) { $0 + at($1, before) }
            out.append(Tile(id: "collectibles", name: "Collectibles", after: after, change: after - was, owes: false))
        }
        return out
    }
}
