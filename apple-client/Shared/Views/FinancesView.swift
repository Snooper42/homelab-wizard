import SwiftUI

/// The Finances plan, read-only on this device: accounts today, then each
/// pay period ahead with its payments and what's left. Amounts stay
/// hidden until Show Amounts, and none show at all while Hide amounts is on
/// at the computer.
struct FinancesView: View {
    @Bindable var finances: FinancesViewModel
    @State private var editing: FinanceAccount?

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
                if !view.budgets.isEmpty { budgets(view) }
                if !view.goals.isEmpty { goals(view) }
                if !view.loans.isEmpty { loans(view) }
                ForEach(view.periods.prefix(8)) { period in
                    PeriodSection(period: period, view: view, finances: finances)
                }
                Section {
                    EmptyView()
                } footer: {
                    Text(finances.canEdit
                         ? "Balances can be typed in here. Change the rest of the plan on the computer."
                         : "Read-only on this device. Change the plan on the computer.")
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
        .sheet(item: $editing) { account in
            BalanceEditor(account: account, finances: finances)
        }
        .sensoryFeedback(.success, trigger: finances.savedCount)
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

    private func budgets(_ view: FinancesPlanView) -> some View {
        Section("Budgets") {
            ForEach(view.budgets) { budget in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(budget.category)
                        Spacer()
                        Money(value: budget.spent, currency: view.plan.currency, finances: finances)
                        Text(verbatim: "/").foregroundStyle(.secondary)
                        Money(value: budget.amount, currency: view.plan.currency, finances: finances)
                    }
                    ProgressView(value: budget.share)
                        .tint(budget.isOver ? .red : budget.isAhead ? .orange : .green)
                    Text(budget.isOver ? "Over budget" : budget.isAhead ? "Ahead of an even pace" : (budget.per == "paycheck" ? "This pay period" : "This month"))
                        .font(.caption)
                        .foregroundStyle(budget.isOver ? .red : .secondary)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func goals(_ view: FinancesPlanView) -> some View {
        Section("Goals") {
            ForEach(view.goals) { goal in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(goal.name)
                        Spacer()
                        Money(value: goal.saved, currency: view.plan.currency, finances: finances)
                        Text(verbatim: "/").foregroundStyle(.secondary)
                        Money(value: goal.target, currency: view.plan.currency, finances: finances)
                    }
                    ProgressView(value: goal.share)
                        .tint(goal.isReached ? .green : .accentColor)
                    Group {
                        if goal.isReached {
                            Text("Reached")
                        } else if let date = goal.date {
                            Text("By \(date, format: .dateTime.month(.wide).year())")
                        } else if let reaches = goal.reaches {
                            Text("At this pace, \(reaches, format: .dateTime.month(.wide).year())")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    if goal.needsMonth > 0, !goal.isReached {
                        HStack(spacing: 4) {
                            Text("Needs").font(.caption).foregroundStyle(.secondary)
                            Money(value: goal.needsMonth, currency: view.plan.currency, finances: finances).font(.caption)
                            Text("a month").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func loans(_ view: FinancesPlanView) -> some View {
        Section("Loans") {
            ForEach(view.loans) { loan in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(finances.accountName(loan.account) ?? "Loan")
                        Spacer()
                        Money(value: loan.balance, currency: view.plan.currency, finances: finances)
                    }
                    if loan.never {
                        Label("The payment doesn't keep up with the interest. At this pace it's never paid off.", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.red)
                    } else if let paidOff = loan.paidOff {
                        Text("Paid off \(paidOff, format: .dateTime.month(.wide).year())\(loan.rate > 0 ? " · \(loan.rate.formatted(.number.precision(.fractionLength(0...2))))%" : "")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if loan.balance <= 0 {
                        Text("Paid off").font(.caption).foregroundStyle(.green)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func accounts(_ view: FinancesPlanView) -> some View {
        let sorted = view.plan.accounts.sorted {
            ($0.kindOrder, $0.name.localizedLowercase) < ($1.kindOrder, $1.name.localizedLowercase)
        }
        return Section {
            ForEach(sorted) { account in
                if finances.canEdit {
                    Button {
                        editing = account
                    } label: {
                        accountRow(account, view)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Update its balance")
                } else {
                    accountRow(account, view)
                }
            }
            LabeledContent("Net worth") {
                Money(value: view.netWorth, currency: view.plan.currency, finances: finances)
                    .fontWeight(.semibold)
            }
        } header: {
            Text("Accounts Today")
        } footer: {
            VStack(alignment: .leading, spacing: 4) {
                if finances.canEdit {
                    Text("Tap an account to type in its balance.")
                }
                if view.plan.accounts.contains(where: { $0.currency != nil && $0.currency != "" }) {
                    Text("Net worth counts each account in the plan's currency as it's typed, without exchange rates.")
                }
            }
        }
    }

    private func accountRow(_ account: FinanceAccount, _ view: FinancesPlanView) -> some View {
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
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
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

/// Types in one account's balance, as the computer's Edit screen does.
private struct BalanceEditor: View {
    let account: FinanceAccount
    let finances: FinancesViewModel
    @State private var text = ""
    @Environment(\.dismiss) private var dismiss

    private var value: Double? { FinancePlanEdit.parseAmount(text) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Balance", text: $text)
                        #if os(iOS)
                        .keyboardType(.numbersAndPunctuation)
                        #endif
                        .font(.title2.monospacedDigit())
                        .privacySensitive()
                        .onSubmit(save)
                } header: {
                    Text(account.name)
                } footer: {
                    Text(account.isOwed
                         ? "What it owes today, as the bank shows it, including what's pending."
                         : "What's in it today, as the bank shows it.")
                }
                if let error = finances.saveError {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.red)
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle("Update Balance")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if finances.isSaving {
                        ProgressView()
                    } else {
                        Button("Save", action: save).disabled(value == nil)
                    }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 380, minHeight: 240)
        #endif
        .onAppear {
            // Filled in only when amounts are already showing here.
            if finances.amountsShown, !finances.amountsHiddenByPlan,
               let current = finances.plan?.start[account.id] {
                text = current.formatted(.number.precision(.fractionLength(0...2)).grouping(.never))
            }
        }
    }

    private func save() {
        guard let value else { return }
        Task {
            if await finances.setBalance(of: account, to: value) { dismiss() }
        }
    }
}

/// What happened, newest first, by month, with a search.
struct TransactionsView: View {
    @Bindable var finances: FinancesViewModel
    @State private var search = ""

    private struct MonthGroup: Identifiable {
        let month: Date
        var items: [FinanceTransaction]
        var id: Date { month }
    }

    private var months: [MonthGroup] {
        guard let ledger = finances.ledger else { return [] }
        let calendar = Calendar.current
        var out: [MonthGroup] = []
        for t in ledger.newestFirst where t.matches(search) {
            let month = t.date.flatMap { calendar.dateInterval(of: .month, for: $0)?.start } ?? .distantPast
            if out.last?.month == month {
                out[out.count - 1].items.append(t)
            } else {
                out.append(MonthGroup(month: month, items: [t]))
            }
        }
        return out
    }

    var body: some View {
        List {
            ForEach(months) { group in
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
