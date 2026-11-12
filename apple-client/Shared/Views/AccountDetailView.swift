import SwiftUI

/// An account's own page (the owner, Nov 12: tapping an account opened the
/// form to type its balance in): what it holds today (a card or a loan,
/// owes), its balance at the end of each of the last 30 or 90 days or a
/// year, worked through its transactions as the computer's page does
/// (AccountBalance), and its latest transactions. Update Balance is a
/// button here, on a phone allowed to change Finances.
struct AccountDetailView: View {
    let account: FinanceAccount
    let finances: FinancesViewModel
    @State private var days = 90
    @State private var picked: Date?
    @State private var updating = false

    var body: some View {
        ScrollView {
            if let view = finances.plan {
                VStack(spacing: 18) {
                    header
                    balanceCard(view)
                    latestCard(view)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .navigationTitle(account.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .refreshable { await finances.loadPlan(); await finances.loadLedger() }
        .task { if finances.ledger == nil { await finances.loadLedger() } }
        .toolbar {
            if finances.canEdit {
                ToolbarItem(placement: .primaryAction) {
                    Button("Update Balance") { updating = true }
                }
            }
        }
        .sheet(isPresented: $updating) { BalanceEditor(account: account, finances: finances) }
    }

    private var header: some View {
        HStack(spacing: 14) {
            LogoCircle(account: account, size: 56)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: account.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(2)
                Text(verbatim: account.kindTitle)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 8)
    }

    private func balanceCard(_ view: FinancesPlanView) -> some View {
        let series = AccountBalance.series(account, finances.ledger?.transactions ?? [], today: Date(), days: days)
        let shown = finances.amountsShown && !finances.amountsHiddenByPlan
        return VStack(alignment: .leading, spacing: 10) {
            Text(account.isOwed ? "Owed Today" : "Balance Today")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.secondaryInk)
            Money(value: abs(view.start[account.id] ?? account.balance ?? 0), currency: account.currency ?? view.plan.currency, finances: finances)
                .font(.system(size: 34, weight: .heavy))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if shown, series.count >= 2 {
                TrendChart(series: series, picked: $picked)
                    .frame(height: 140)
                Picker("How far back", selection: $days) {
                    Text("30 Days").tag(30)
                    Text("90 Days").tag(90)
                    Text("A Year").tag(365)
                }
                .pickerStyle(.segmented)
            } else if !AccountBalance.runs(account) {
                Text(account.kind == "home" || account.kind == "car" || account.kind == "collectible"
                     ? "Its worth is what's typed in; no transaction moves it."
                     : "Type its balance in to see it day by day.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
    }

    private func latestCard(_ view: FinancesPlanView) -> some View {
        let mine = Array(AccountBalance.mine(account, finances.ledger?.transactions ?? []).prefix(8))
        return VStack(alignment: .leading, spacing: 4) {
            Text("Latest Transactions")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.ink)
                .padding(.bottom, 6)
            if mine.isEmpty {
                Text("No transactions in or out of it yet.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            } else {
                ForEach(Array(mine.enumerated()), id: \.element.id) { i, t in
                    if i > 0 { Divider().padding(.leading, 54) }
                    WalletTransactionRow(transaction: t, finances: finances, isNew: false)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
    }
}
