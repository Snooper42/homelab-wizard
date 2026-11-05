import PhotosUI
import SwiftUI

/// The Finances plan, read-only on this device: accounts today, then each
/// pay period ahead with its payments and what's left. Amounts stay
/// hidden until Show Amounts, and none show at all while Hide amounts is on
/// at the computer.
struct FinancesView: View {
    @Bindable var finances: FinancesViewModel
    @State private var editing: FinanceAccount?
    @State private var editingBudget: FinanceBudget?
    @State private var editingGoal: FinanceGoal?
    @State private var editingPayment: FinancePayment?
    @State private var editingCushion = false

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
                if !view.since.isEmpty { SinceSection(view: view, finances: finances) }
                if !view.budgets.isEmpty { budgets(view) }
                if !view.goals.isEmpty { goals(view) }
                if !view.loans.isEmpty { loans(view) }
                ForEach(view.periods.prefix(8)) { period in
                    PeriodSection(period: period, view: view, finances: finances) { payment in
                        finances.clearSaveError()
                        editingPayment = payment
                    }
                }
                Section {
                    EmptyView()
                } footer: {
                    Text(finances.canEdit
                         ? "Balances, the cushion, budgets, goals and what a payment costs can be changed here, and transactions added. Change the rest of the plan on the computer."
                         : "Read-only on this device. Change the plan on the computer.")
                }
            } else if let error = finances.planError {
                Section { Text(error).foregroundStyle(.secondary) }
            }
        }
        .formStyle(.grouped)
        .overlay {
            if !finances.canSeePlan {
                ContentUnavailableView("Finances Aren't on This Device", systemImage: "banknote",
                                       description: Text("On the computer, Settings › Phones, let this device see Finances."))
            } else if finances.plan == nil, finances.planError == nil {
                ProgressView("Reading the plan…")
            }
        }
        // Again once the device's level is known: right after unlock it may not be yet.
        .task(id: finances.canSeePlan) { await finances.loadPlan() }
        .refreshable { await finances.loadPlan() }
        .sheet(item: $editing) { account in
            BalanceEditor(account: account, finances: finances)
        }
        .sheet(item: $editingBudget) { budget in
            AmountEditor(
                title: "Change Budget", heading: budget.category,
                footer: budget.per == "paycheck" ? "What it may take each pay period." : "What it may take each month.",
                finances: finances
            ) { amount in await finances.setBudget(budget, to: amount) }
        }
        .sheet(item: $editingGoal) { goal in
            AmountEditor(
                title: "Change Goal", heading: goal.name,
                footer: "How much it needs in all. What's put by toward it stays as it is.",
                finances: finances
            ) { amount in await finances.setGoal(goal, target: amount) }
        }
        .sheet(isPresented: $editingCushion) {
            AmountEditor(
                title: "Change Cushion", heading: "The least checking should hold",
                footer: "A pay period that leaves less is flagged. Type 0 to turn that off.",
                allowsZero: true,
                finances: finances
            ) { amount in await finances.setCushion(amount) }
        }
        .sheet(item: $editingPayment) { payment in
            AmountEditor(
                title: "Change Payment", heading: payment.name,
                footer: payment.estimate == true
                    ? "About what it costs each time. Every one still to come changes."
                    : "What it costs each time. Every one still to come changes.",
                finances: finances
            ) { amount in await finances.setPayment(payment, to: amount) }
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
            if finances.canEdit {
                ToolbarItem(placement: .secondaryAction) {
                    let hidden = finances.amountsHiddenByPlan
                    Button {
                        Task { _ = await finances.setHideAmounts(!hidden) }
                    } label: {
                        Label(hidden ? "Show Amounts on Every Device" : "Hide Amounts on Every Device",
                              systemImage: hidden ? "eye" : "eye.slash.circle")
                    }
                    // As on the computer.
                    .keyboardShortcut("h", modifiers: [.command, .shift])
                    .disabled(finances.isSaving)
                }
            }
        }
    }

    private func budgets(_ view: FinancesPlanView) -> some View {
        Section {
            ForEach(view.budgets) { budget in
                if finances.canEdit {
                    Button {
                        finances.clearSaveError()
                        editingBudget = budget
                    } label: {
                        budgetRow(budget, view)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Change its amount")
                } else {
                    budgetRow(budget, view)
                }
            }
        } header: {
            Text("Budgets")
        } footer: {
            if finances.canEdit { Text("Tap a budget to change its amount.") }
        }
    }

    private func budgetRow(_ budget: FinanceBudget, _ view: FinancesPlanView) -> some View {
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
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func goals(_ view: FinancesPlanView) -> some View {
        Section {
            ForEach(view.goals) { goal in
                if finances.canEdit {
                    Button {
                        finances.clearSaveError()
                        editingGoal = goal
                    } label: {
                        goalRow(goal, view)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Change its target")
                } else {
                    goalRow(goal, view)
                }
            }
        } header: {
            Text("Goals")
        } footer: {
            if finances.canEdit { Text("Tap a goal to change its target.") }
        }
    }

    private func goalRow(_ goal: FinanceGoal, _ view: FinancesPlanView) -> some View {
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
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
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
            if finances.canEdit {
                Button {
                    finances.clearSaveError()
                    editingCushion = true
                } label: {
                    cushionRow(view)
                }
                .buttonStyle(.plain)
                .accessibilityHint("Change the least checking should hold")
            } else if view.plan.cushion > 0 {
                cushionRow(view)
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

    private func cushionRow(_ view: FinancesPlanView) -> some View {
        LabeledContent("Cushion") {
            if view.plan.cushion > 0 {
                Money(value: view.plan.cushion, currency: view.plan.currency, finances: finances)
            } else {
                Text("None")
            }
        }
        .contentShape(Rectangle())
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

/// Taken as done: paychecks and payments since the balances were typed in,
/// counted in them. One that hasn't happened yet can be marked so, and
/// then it comes today, as on the computer.
private struct SinceSection: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @State private var showAll = false

    var body: some View {
        let shown = showAll ? view.since : Array(view.since.prefix(5))
        Section {
            ForEach(shown) { past in
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name(past))
                        Text(detail(past)).font(.caption).foregroundStyle(past.waiting ? .orange : .secondary)
                    }
                    Spacer()
                    Money(value: past.moneyIn ? past.amount : -past.amount, currency: view.plan.currency, finances: finances)
                    if finances.canEdit {
                        Picker(name(past), selection: Binding(
                            get: { past.waiting },
                            set: { waiting in Task { _ = await finances.setWaiting(past, waiting: waiting) } }
                        )) {
                            Text("In").tag(false)
                            Text("Not yet").tag(true)
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                        .fixedSize()
                        .disabled(finances.isSaving)
                    }
                }
                .accessibilityElement(children: .contain)
            }
            if view.since.count > 5 {
                Button(showAll ? "Show Fewer" : "Show All \(view.since.count)") { showAll.toggle() }
            }
        } header: {
            Text("Taken as Done")
        } footer: {
            Text(finances.canEdit
                 ? "Counted in the balances you typed in. Mark any that hasn't happened yet: it comes today."
                 : "Counted in the balances that were typed in.")
        }
    }

    private func name(_ past: FinancePast) -> String {
        if let person = past.person { return "\(view.person(person) ?? "Someone")'s paycheck" }
        if let payment = past.payment { return view.payment(payment)?.name ?? "Payment" }
        return "Payment"
    }

    private func detail(_ past: FinancePast) -> String {
        let day = past.date?.formatted(.dateTime.weekday(.abbreviated).month().day()) ?? ""
        if past.waiting { return day + " · not yet: it comes today" }
        return day + (past.typed ? " · the day its balance was typed in" : " · since the balance was typed in")
    }
}

private struct PeriodSection: View {
    let period: FinancePeriod
    let view: FinancesPlanView
    let finances: FinancesViewModel
    let edit: (FinancePayment) -> Void

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
            // By position: the same payment can come twice on one day.
            ForEach(period.rows.indices, id: \.self) { i in
                let row = period.rows[i]
                if finances.canEdit, let payment = view.payment(row.payment), payment.canChangeAmount {
                    Button {
                        edit(payment)
                    } label: {
                        RowLine(row: row, view: view, finances: finances)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Change what it costs")
                } else {
                    RowLine(row: row, view: view, finances: finances)
                }
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
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // At the accessibility text sizes the amount goes under the name.
        let large = typeSize.isAccessibilitySize
        let layout = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout(spacing: 8))
        layout {
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
            if !large { Spacer() }
            HStack(spacing: 2) {
                if row.estimate { Text(verbatim: "≈").foregroundStyle(.secondary).accessibilityLabel("About") }
                Money(value: row.into ? row.amount : -row.amount, currency: view.plan.currency, finances: finances)
                    .foregroundStyle(row.into ? .green : .primary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Types in one amount (a budget's, a goal's target) and saves it.
private struct AmountEditor: View {
    let title: String
    let heading: String
    let footer: String
    /// Nothing (0) is a value here: the cushion, where it turns the warning off.
    var allowsZero = false
    let finances: FinancesViewModel
    let save: @MainActor (Double) async -> Bool
    @State private var text = ""
    @Environment(\.dismiss) private var dismiss

    private var value: Double? {
        guard let v = FinancePlanEdit.parseAmount(text) else { return nil }
        let cents = FinancePlanEdit.roundedToCents(v)
        guard allowsZero ? cents >= 0 : cents > 0 else { return nil }
        return v
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Amount", text: $text)
                        #if os(iOS)
                        .keyboardType(.numbersAndPunctuation)
                        #endif
                        .font(.title2.monospacedDigit())
                        .privacySensitive()
                        .onSubmit(submit)
                } header: {
                    Text(heading)
                } footer: {
                    Text(footer)
                }
                if let error = finances.saveError {
                    Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.red) }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if finances.isSaving { ProgressView() } else { Button("Save", action: submit).disabled(value == nil) }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 360, minHeight: 220)
        #endif
    }

    private func submit() {
        guard let value else { return }
        Task { if await save(value) { dismiss() } }
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
    @State private var adding = false
    @State private var receiptFor: FinanceTransaction?
    @State private var editingTransaction: FinanceTransaction?

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
                        if finances.canAddTransactions && LedgerEdit.canUpdate(t) {
                            Button {
                                finances.clearSaveError()
                                editingTransaction = t
                            } label: {
                                TransactionRow(transaction: t, finances: finances)
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint("Change or delete it")
                        } else if t.hasReceipt {
                            Button {
                                receiptFor = t
                            } label: {
                                TransactionRow(transaction: t, finances: finances)
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint("Shows the receipt")
                        } else {
                            TransactionRow(transaction: t, finances: finances)
                        }
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
        .task {
            await finances.loadLedger()
            // Accounts and categories for a new one come from the plan.
            if finances.plan == nil { await finances.loadPlan() }
        }
        .refreshable { await finances.loadLedger() }
        .navigationTitle("Transactions")
        .toolbar {
            if finances.canAddTransactions {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        finances.clearSaveError()
                        adding = true
                    } label: {
                        Label("Add Transaction", systemImage: "plus")
                    }
                    // ⌘N on iPad. On the Mac, ⌘N is New Window, so ⌥⌘N.
                    #if os(macOS)
                    .keyboardShortcut("n", modifiers: [.command, .option])
                    #else
                    .keyboardShortcut("n")
                    #endif
                }
            }
        }
        .sheet(isPresented: $adding) {
            AddTransactionView(finances: finances)
        }
        .sheet(item: $editingTransaction) { t in
            AddTransactionView(finances: finances, editing: t)
        }
        .sheet(item: $receiptFor) { t in
            if let name = t.receipt {
                ReceiptView(name: name, title: t.payee.isEmpty ? "Receipt" : t.payee, finances: finances)
            }
        }
        .sensoryFeedback(.success, trigger: finances.savedCount)
    }
}

/// Records money in or out of one account, as a person types it in.
private struct AddTransactionView: View {
    let finances: FinancesViewModel
    /// The transaction being changed, or nil for a new one.
    var editing: FinanceTransaction? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var draft = NewTransaction(date: Date(), account: "", isMoneyIn: false, amount: 0, payee: "", category: "", note: "")
    @State private var amountText = ""
    @State private var confirmingDelete = false
    @State private var showingReceipt = false
    @State private var photo: PhotosPickerItem?
    @State private var attaching = false

    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { ["checking", "savings", "card", "investment", "retirement", "loan", "other"].contains($0.kind) }
    }

    private var categories: [FinanceCategory] {
        (finances.plan?.categories ?? []).filter { ($0.income ?? false) == draft.isMoneyIn }
    }

    private var problem: String? {
        var t = draft
        t.amount = FinancePlanEdit.parseAmount(amountText) ?? 0
        return LedgerEdit.problem(with: t, accounts: Set(accounts.map(\.id)))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Direction", selection: $draft.isMoneyIn) {
                        Text("Money out").tag(false)
                        Text("Money in").tag(true)
                    }
                    .pickerStyle(.segmented)
                    TextField("Amount", text: $amountText)
                        #if os(iOS)
                        .keyboardType(.numbersAndPunctuation)
                        #endif
                        .font(.title2.monospacedDigit())
                        .privacySensitive()
                    TextField(draft.isMoneyIn ? "Who paid" : "Who was paid", text: $draft.payee)
                        .autocorrectionDisabled()
                }
                Section {
                    Picker("Account", selection: $draft.account) {
                        ForEach(accounts) { account in
                            Text(account.name).tag(account.id)
                        }
                    }
                    Picker("Category", selection: $draft.category) {
                        Text("None").tag("")
                        ForEach(categories) { category in
                            Text(category.parent.map { "\($0) › \(category.name)" } ?? category.name).tag(category.name)
                        }
                    }
                    DatePicker("Day", selection: $draft.date, in: ...Date().addingTimeInterval(60 * 60 * 24 * 366), displayedComponents: .date)
                    TextField("Note", text: $draft.note, axis: .vertical)
                        .lineLimit(1...4)
                }
                if let editing {
                    Section {
                        if let name = editing.receipt {
                            Button {
                                showingReceipt = true
                            } label: {
                                Label("Show the Receipt", systemImage: "paperclip")
                            }
                            .sheet(isPresented: $showingReceipt) {
                                ReceiptView(name: name, title: editing.payee.isEmpty ? "Receipt" : editing.payee, finances: finances)
                            }
                        }
                        Button(role: .destructive) {
                            confirmingDelete = true
                        } label: {
                            Label("Delete Transaction", systemImage: "trash")
                        }
                        .disabled(finances.isSaving)
                        .confirmationDialog("Delete this transaction?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                            Button("Delete", role: .destructive) {
                                Task { if await finances.delete(editing) { dismiss() } }
                            }
                        } message: {
                            Text("It's removed from the ledger on the computer too.")
                        }
                    }
                } else {
                    Section {
                        if draft.receipt != nil {
                            HStack {
                                Label("Receipt attached", systemImage: "paperclip")
                                Spacer()
                                Button("Remove", role: .destructive) {
                                    draft.receipt = nil
                                    photo = nil
                                }
                                .buttonStyle(.borderless)
                            }
                        } else {
                            PhotosPicker(selection: $photo, matching: .images) {
                                HStack {
                                    Label("Attach a Photo of the Receipt", systemImage: "camera")
                                    if attaching {
                                        Spacer()
                                        ProgressView().controlSize(.small)
                                    }
                                }
                            }
                            .disabled(attaching)
                        }
                    } footer: {
                        Text("The photo is shrunk and sent without its location or any other details the camera kept.")
                    }
                }
                if let error = finances.saveError {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.red)
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(editing == nil ? "Add Transaction" : "Change Transaction")
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
                        Button("Save", action: save).disabled(problem != nil)
                    }
                }
            }
            .onChange(of: photo) { _, item in
                guard let item else { return }
                attaching = true
                Task {
                    defer { attaching = false }
                    guard let data = try? await item.loadTransferable(type: Data.self) else {
                        return
                    }
                    draft.receipt = await finances.attachPhoto(data)
                }
            }
            .onChange(of: draft.isMoneyIn) { _, _ in
                // A category for money out isn't one for money in.
                if !categories.contains(where: { $0.name == draft.category }) { draft.category = "" }
            }
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 440)
        #endif
        .onAppear {
            if let editing, draft.payee.isEmpty {
                draft.date = editing.date ?? Date()
                draft.account = editing.account
                draft.isMoneyIn = editing.amount > 0
                draft.payee = editing.payee
                draft.category = editing.category
                draft.note = editing.note
                // The amount is filled in only when amounts are showing here.
                if finances.amountsShown, !finances.amountsHiddenByPlan {
                    amountText = abs(editing.amount).formatted(.number.precision(.fractionLength(0...2)).grouping(.never))
                }
            }
            if draft.account.isEmpty {
                let checking = finances.plan?.checking ?? ""
                draft.account = accounts.contains(where: { $0.id == checking }) ? checking : (accounts.first?.id ?? "")
            }
        }
    }

    private func save() {
        var t = draft
        guard let amount = FinancePlanEdit.parseAmount(amountText) else { return }
        t.amount = abs(amount)
        Task {
            let saved: Bool
            if let editing {
                saved = await finances.update(editing, with: t)
            } else {
                saved = await finances.add(t)
            }
            if saved { dismiss() }
        }
    }
}

private struct TransactionRow: View {
    let transaction: FinanceTransaction
    let finances: FinancesViewModel
    @Environment(\.dynamicTypeSize) private var typeSize

    /// At the accessibility text sizes the amount goes under the words, and
    /// the detail line may wrap.
    private var large: Bool { typeSize.isAccessibilitySize }

    var body: some View {
        let layout = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout(spacing: 8))
        layout {
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
                    .lineLimit(large ? 3 : 1)
            }
            if !large { Spacer() }
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
