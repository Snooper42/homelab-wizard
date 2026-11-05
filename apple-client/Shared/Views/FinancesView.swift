import SwiftUI

/// The Finances plan, read-only on this device: accounts today, then each
/// pay period ahead with its payments and what's left. Amounts stay
/// hidden until Show Amounts, and none show at all while Hide amounts is on
/// at the computer.
struct FinancesView: View {
    @Bindable var finances: FinancesViewModel

    var body: some View {
        Form {
            if let view = finances.plan {
                accounts(view)
                Section {
                    NavigationLink {
                        TransactionsView(finances: finances)
                    } label: {
                        Label("Transactions", systemImage: "list.bullet.rectangle")
                    }
                }
                ForEach(view.periods.prefix(8)) { period in
                    PeriodSection(period: period, view: view, finances: finances)
                }
                Section {
                    EmptyView()
                } footer: {
                    Text(view.readOnly || finances.level < .edit
                         ? "Read-only on this device. Change the plan on the computer."
                         : "Change the plan on the computer. Editing from here isn't built yet.")
                }
            } else if let error = finances.planError {
                Section { Text(error).foregroundStyle(.secondary) }
            }
        }
        .formStyle(.grouped)
        .overlay {
            if finances.plan == nil, finances.planError == nil {
                ProgressView("Reading the plan…")
            }
        }
        .task { await finances.loadPlan() }
        .refreshable { await finances.loadPlan() }
        .navigationTitle("Finances")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if !finances.amountsHiddenByPlan {
                    Button {
                        finances.amountsShown.toggle()
                    } label: {
                        Label(finances.amountsShown ? "Hide Amounts" : "Show Amounts",
                              systemImage: finances.amountsShown ? "eye.slash" : "eye")
                    }
                }
            }
        }
    }

    private func accounts(_ view: FinancesPlanView) -> some View {
        let sorted = view.plan.accounts.sorted {
            ($0.kindOrder, $0.name.localizedLowercase) < ($1.kindOrder, $1.name.localizedLowercase)
        }
        return Section {
            ForEach(sorted) { account in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(account.name)
                        Text([account.kindTitle, account.institution].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Money(value: view.start[account.id] ?? 0, currency: account.currency ?? view.plan.currency, finances: finances)
                        if account.isOwed {
                            Text("owed").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
            LabeledContent("Net worth") {
                Money(value: view.netWorth, currency: view.plan.currency, finances: finances)
                    .fontWeight(.semibold)
            }
        } header: {
            Text("Accounts Today")
        } footer: {
            if view.plan.accounts.contains(where: { $0.currency != nil && $0.currency != "" }) {
                Text("Net worth counts each account in the plan's currency as it's typed, without exchange rates.")
            }
        }
    }
}

private struct PeriodSection: View {
    let period: FinancePeriod
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        Section {
            LabeledContent("Comes in") { Money(value: period.moneyIn, currency: view.plan.currency, finances: finances) }
            LabeledContent("Goes out") { Money(value: period.out, currency: view.plan.currency, finances: finances) }
            if period.saved > 0 {
                LabeledContent("Of that, saved") { Money(value: period.saved, currency: view.plan.currency, finances: finances) }
            }
            LabeledContent("Left in checking") {
                Money(value: period.left, currency: view.plan.currency, finances: finances)
                    .fontWeight(.semibold)
            }
            if view.plan.cushion > 0, period.left < view.plan.cushion {
                Label("Below the cushion you set", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
            }
            ForEach(period.rows) { row in
                RowLine(row: row, view: view, finances: finances)
            }
        } header: {
            Text(title)
        }
    }

    private var title: String {
        let day = Date.FormatStyle().weekday(.abbreviated).month(.abbreviated).day()
        if period.now {
            if let last = period.last { return "Now, until \(last.formatted(day))" }
            return "Now"
        }
        guard let pay = period.pay, let date = pay.date else {
            return period.start.map { $0.formatted(day) } ?? "Later"
        }
        let who = pay.people.compactMap { view.person($0) }.filter { !$0.isEmpty }
        return who.isEmpty ? "Payday \(date.formatted(day))" : "Payday \(date.formatted(day)) · \(who.joined(separator: ", "))"
    }
}

private struct RowLine: View {
    let row: FinanceRow
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(view.payment(row.payment)?.name ?? "Payment")
                    if row.late {
                        Text("Late").font(.caption2.bold()).foregroundStyle(.red)
                    }
                    if row.saved {
                        Image(systemName: "leaf.fill").font(.caption2).foregroundStyle(.green)
                            .accessibilityLabel("Saved")
                    }
                }
                if let date = row.date {
                    Text(date, format: .dateTime.weekday(.abbreviated).month().day())
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            HStack(spacing: 2) {
                if row.estimate { Text(verbatim: "≈").foregroundStyle(.secondary).accessibilityLabel("About") }
                Money(value: row.into ? row.amount : -row.amount, currency: view.plan.currency, finances: finances)
                    .foregroundStyle(row.into ? .green : .primary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// What happened, newest first, by month, with a search.
struct TransactionsView: View {
    @Bindable var finances: FinancesViewModel
    @State private var search = ""

    private var months: [(month: Date, items: [FinanceTransaction])] {
        guard let ledger = finances.ledger else { return [] }
        let calendar = Calendar.current
        var out: [(month: Date, items: [FinanceTransaction])] = []
        for t in ledger.newestFirst where t.matches(search) {
            let month = t.date.flatMap { calendar.dateInterval(of: .month, for: $0)?.start } ?? .distantPast
            if out.last?.month == month {
                out[out.count - 1].items.append(t)
            } else {
                out.append((month, [t]))
            }
        }
        return out
    }

    var body: some View {
        List {
            ForEach(months, id: \.month) { group in
                Section(group.month == .distantPast ? "No date" : group.month.formatted(.dateTime.month(.wide).year())) {
                    ForEach(group.items) { t in
                        TransactionRow(transaction: t, finances: finances)
                    }
                }
            }
        }
        .overlay {
            if finances.ledger == nil {
                if let error = finances.ledgerError {
                    ContentUnavailableView("Couldn't Read the Transactions", systemImage: "list.bullet.rectangle", description: Text(error))
                } else {
                    ProgressView("Reading the transactions…")
                }
            } else if months.isEmpty {
                if search.isEmpty {
                    ContentUnavailableView("No Transactions", systemImage: "list.bullet.rectangle")
                } else {
                    ContentUnavailableView.search(text: search)
                }
            }
        }
        .searchable(text: $search, prompt: "Payee, category, note or tag")
        .task { await finances.loadLedger() }
        .refreshable { await finances.loadLedger() }
        .navigationTitle("Transactions")
    }
}

private struct TransactionRow: View {
    let transaction: FinanceTransaction
    let finances: FinancesViewModel

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(transaction.payee.isEmpty ? "Transaction" : transaction.payee)
                    if transaction.hasReceipt {
                        Image(systemName: "paperclip").font(.caption2).foregroundStyle(.secondary)
                            .accessibilityLabel("Receipt kept")
                    }
                }
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Money(value: transaction.amount, currency: finances.currency, finances: finances)
                .foregroundStyle(transaction.amount > 0 ? .green : .primary)
        }
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        var parts: [String] = []
        if let date = transaction.date { parts.append(date.formatted(.dateTime.month(.abbreviated).day())) }
        if let to = transaction.to, !to.isEmpty {
            parts.append("\(finances.accountName(transaction.account) ?? "Account") → \(finances.accountName(to) ?? "Account")")
        } else if let account = finances.accountName(transaction.account) {
            parts.append(account)
        }
        if !transaction.category.isEmpty { parts.append(transaction.category) }
        return parts.joined(separator: " · ")
    }
}

/// An amount, or "••••" while amounts are hidden.
private struct Money: View {
    let value: Double
    let currency: String
    let finances: FinancesViewModel

    var body: some View {
        if finances.amountsHiddenByPlan || !finances.amountsShown {
            Text(verbatim: "••••")
                .foregroundStyle(.secondary)
                .accessibilityLabel("Amount hidden")
        } else {
            Text(value, format: .currency(code: currency))
                .monospacedDigit()
                .privacySensitive()
        }
    }
}
