import Foundation

/// The accounts as a row of small cards under Finances' first card, as the
/// redesign's phone picture (phone-finances.png): checking first, then the
/// others in the order the screen lists kinds, each with its balance. A home,
/// a car or a collection isn't an account you spend from, so it isn't here
/// (it's on Net worth).
enum AccountStrip {
    struct Card: Sendable, Equatable, Identifiable {
        let account: FinanceAccount
        /// What it holds; what a card or a loan owes, as less than nothing.
        let amount: Double
        var id: String { account.id }
    }

    /// The accounts the row and Transactions' switcher show, in the screen's order of kinds, then by name.
    static func listed(_ accounts: [FinanceAccount]) -> [FinanceAccount] {
        accounts
            .filter { !["home", "car", "collectible"].contains($0.kind) }
            .sorted { ($0.kindOrder, $0.name.localizedLowercase) < ($1.kindOrder, $1.name.localizedLowercase) }
    }

    /// Checking first, at the figure the first card's Now shows; the rest at their balance.
    static func cards(_ view: FinancesPlanView) -> [Card] {
        let listed = listed(view.plan.accounts)
        let ordered = listed.filter { $0.id == view.checking } + listed.filter { $0.id != view.checking }
        return ordered.map { account in
            let held = account.id == view.checking
                ? (view.checkingNow?.result ?? view.start[account.id] ?? account.balance ?? 0)
                : (view.start[account.id] ?? account.balance ?? 0)
            return Card(account: account, amount: account.isOwed ? -held : held)
        }
    }
}
