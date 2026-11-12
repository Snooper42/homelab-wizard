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
                    if account.kind == "loan" {
                        LoanSection(account: account, view: view, finances: finances)
                    }
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

/// A loan on its page (the computer's Loan.tsx): what it costs each month,
/// months left and when it's paid off; then the payments linked to it, one
/// paid over the plan's asked about (Count It, or Not This One), and the same
/// payee's next ones offered to link. Each change asks Face ID.
private struct LoanSection: View {
    let account: FinanceAccount
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @State private var picking = false

    var body: some View {
        let links = LoanLinks(loan: account.id, plan: view.plan, transactions: finances.ledger?.transactions ?? [])
        let payoff = view.loans.first { $0.account == account.id }
        let monthly = links.payments.compactMap(\.amount).reduce(0, +)
        VStack(alignment: .leading, spacing: 12) {
            Text("The Loan")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.ink)
            HStack(alignment: .top, spacing: 18) {
                fact("Each Month") { Money(value: monthly, currency: view.plan.currency, finances: finances) }
                if let payoff, payoff.months > 0 { fact("Months Left") { Text(verbatim: "\(payoff.months)") } }
                if let payoff, let date = payoff.paidOff, !payoff.never {
                    fact("Paid Off") { Text(date, format: .dateTime.month(.abbreviated).year()) }
                }
            }
            Divider()
            HStack(alignment: .firstTextBaseline) {
                Text("Payments Linked to It")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                if finances.canAddTransactions, links.linkTo != nil {
                    Button("Link a Payment") { picking = true }
                        .font(.subheadline.weight(.semibold))
                }
            }
            if links.payments.isEmpty {
                Text("No payment in the plan goes to this loan: add one on the computer, then link what pays it.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
            }
            ForEach(links.offers) { t in
                VStack(alignment: .leading, spacing: 6) {
                    WalletTransactionRow(transaction: t, finances: finances, isNew: false)
                    if finances.canAddTransactions, let to = links.linkTo {
                        HStack {
                            Text("Looks like it: the same payee").font(.caption).foregroundStyle(Theme.secondaryInk)
                            Spacer()
                            Button("Not This One") { Task { _ = await finances.notThisOne(t) } }
                            Button("Link") { Task { _ = await finances.link(t, to: to) } }.fontWeight(.semibold)
                        }
                        .font(.footnote)
                        .disabled(finances.isSaving)
                    }
                }
            }
            if links.linked.isEmpty && !links.payments.isEmpty {
                Text("None linked yet.").font(.subheadline).foregroundStyle(Theme.secondaryInk)
            }
            ForEach(links.linked) { t in
                let over = links.over(t)
                VStack(alignment: .leading, spacing: 6) {
                    WalletTransactionRow(transaction: t, finances: finances, isNew: false)
                    if over > 0 && !t.extra {
                        HStack {
                            Text(verbatim: "\(over.formatted(.currency(code: view.plan.currency))) more than its payment: count all of it?")
                                .font(.caption)
                                .foregroundStyle(Theme.warning)
                            Spacer()
                            if finances.canAddTransactions {
                                Button("Not This One") { Task { _ = await finances.notThisOne(t) } }
                                Button("Count It") { Task { _ = await finances.countInFull(t) } }.fontWeight(.semibold)
                            }
                        }
                        .font(.footnote)
                        .disabled(finances.isSaving)
                    } else {
                        Text(t.extra ? "Counted in full" : "Counted")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.success)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 24)
        .sheet(isPresented: $picking) { LinkPaymentView(account: account, view: view, finances: finances) }
    }

    private func fact<V: View>(_ title: LocalizedStringKey, @ViewBuilder _ value: () -> V) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(Theme.secondaryInk)
            value().font(.headline).foregroundStyle(Theme.ink)
        }
    }
}

/// Link a Payment: money out linked to nothing yet, newest first; one tapped
/// counts as paying the loan's planned payment.
private struct LinkPaymentView: View {
    let account: FinanceAccount
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let links = LoanLinks(loan: account.id, plan: view.plan, transactions: finances.ledger?.transactions ?? [])
        let free = (finances.ledger?.transactions ?? [])
            .filter { $0.payment == nil && !$0.notPlanned && $0.to == nil && $0.amount < 0 }
            .sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
            .prefix(20)
        NavigationStack {
            List {
                if free.isEmpty { Text("Nothing to link.").foregroundStyle(Theme.secondaryInk) }
                ForEach(Array(free)) { t in
                    Button {
                        Task {
                            if let to = links.linkTo, await finances.link(t, to: to) { dismiss() }
                        }
                    } label: {
                        WalletTransactionRow(transaction: t, finances: finances, isNew: false)
                    }
                    .disabled(finances.isSaving)
                }
            }
            .navigationTitle("Link a Payment")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}
