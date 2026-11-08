import Charts
import PhotosUI
import SwiftUI

/// Finances' home, as the owner chose it: checking now and after the next
/// paycheck, net worth with its line, then a list as Settings has one, each
/// part of Finances one tap away (Transactions, Budgets, Bills,
/// Investments, Accounts, Goals, Loans). Amounts stay hidden until Show
/// Amounts, and none show at all while Hide amounts is on at the computer.
struct FinancesView: View {
    @Bindable var finances: FinancesViewModel

    var body: some View {
        Form {
            if let view = finances.plan {
                if let now = view.checkingNow { CheckingSection(now: now, view: view, finances: finances) }
                NetWorthSection(view: view, finances: finances)
                Section {
                    NavigationLink {
                        TransactionsView(finances: finances)
                    } label: {
                        FinanceLinkLabel(title: "Transactions", systemImage: "list.bullet", tint: Theme.accent)
                    }
                    if !view.budgets.isEmpty {
                        NavigationLink {
                            FinanceBudgetsPage(finances: finances)
                        } label: {
                            FinanceLinkLabel(title: "Budgets", systemImage: "chart.pie.fill", tint: Color(light: 0xC2410C, dark: 0xE8590C)) {
                                HStack(spacing: 3) {
                                    Money(value: view.budgets.reduce(0) { $0 + max($1.left, 0) }, currency: view.plan.currency, finances: finances)
                                    Text("left")
                                }
                            }
                        }
                    }
                    if !view.periods.isEmpty || !view.since.isEmpty {
                        NavigationLink {
                            FinanceBillsPage(finances: finances)
                        } label: {
                            FinanceLinkLabel(title: "Bills", systemImage: "calendar", tint: Theme.danger) {
                                if let next = Self.nextBill(view) {
                                    Text(verbatim: next)
                                }
                            }
                        }
                    }
                    if let investments = view.investments {
                        NavigationLink {
                            FinanceInvestmentsPage(finances: finances)
                        } label: {
                            FinanceLinkLabel(title: "Investments", systemImage: "chart.line.uptrend.xyaxis", tint: Theme.success) {
                                Money(value: investments.total, currency: view.plan.currency, finances: finances)
                            }
                        }
                    }
                    NavigationLink {
                        FinanceAccountsPage(finances: finances)
                    } label: {
                        FinanceLinkLabel(title: "Accounts", systemImage: "building.columns.fill", tint: Theme.info) {
                            Text("\(view.plan.accounts.count)")
                        }
                    }
                    if !view.goals.isEmpty {
                        NavigationLink {
                            FinanceGoalsPage(finances: finances)
                        } label: {
                            FinanceLinkLabel(title: "Goals", systemImage: "flag.fill", tint: Color(light: 0x0F766E, dark: 0x14B8A6)) {
                                Text("\(view.goals.count)")
                            }
                        }
                    }
                    if !view.loans.isEmpty {
                        NavigationLink {
                            FinanceLoansPage(finances: finances)
                        } label: {
                            FinanceLinkLabel(title: "Loans", systemImage: "arrow.uturn.backward", tint: Color(light: 0x6E6E73, dark: 0x8E8E93)) {
                                Text("\(view.loans.count)")
                            }
                        }
                    }
                } footer: {
                    Text(finances.canEdit
                         ? "Balances, the cushion, budgets, goals and what a payment costs can be changed on their pages, and transactions added. Change the rest of the plan on the computer."
                         : "Read-only on this device. Change the plan on the computer.")
                }
            } else if let error = finances.planError {
                Section { Text(error).foregroundStyle(.secondary) }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
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

    /// The next bill to come out, and when: "Netflix on Friday". Not money
    /// moved between the household's own accounts, nor money coming in.
    nonisolated static func nextBill(_ view: FinancesPlanView) -> String? {
        let today = view.todayText
        for period in view.periods {
            for row in period.rows where !row.outside && !row.into && row.amount > 0 && (row.dateText ?? "") >= today {
                guard let name = view.paymentTitle(row.payment) else { continue }
                if row.dateText == today { return "\(name) today" }
                guard let date = row.date else { return name }
                return "\(name) on \(date.formatted(.dateTime.weekday(.wide)))"
            }
        }
        return nil
    }
}

/// A row of Finances' home: its icon on a coloured tile, as in Settings, its name, and a few words.
private struct FinanceLinkLabel<Trailing: View>: View {
    let title: String
    let systemImage: String
    let tint: Color
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(tint, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .accessibilityHidden(true)
            Text(title)
            Spacer(minLength: 8)
            trailing()
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

extension FinanceLinkLabel where Trailing == EmptyView {
    init(title: String, systemImage: String, tint: Color) {
        self.init(title: title, systemImage: systemImage, tint: tint) { EmptyView() }
    }
}

/// Net worth today, how it moved this month, and its line over the last
/// three months, from each account's kept balances.
private struct NetWorthSection: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        let series = view.netWorthSeries(days: 92)
        Section {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Net worth")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if let month = view.netWorthThisMonth, abs(month) >= 0.5, finances.amountsShown, !finances.amountsHiddenByPlan {
                        Text("\(month >= 0 ? "+" : "−")\(abs(month), format: .currency(code: view.plan.currency).precision(.fractionLength(0))) this month")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(month >= 0 ? Theme.success : Theme.danger)
                    }
                }
                Money(value: view.netWorth, currency: view.plan.currency, finances: finances)
                    .font(.title2.weight(.bold))
                if series.count >= 2, finances.amountsShown, !finances.amountsHiddenByPlan {
                    Chart {
                        ForEach(series, id: \.date) { point in
                            AreaMark(x: .value("Day", point.date), y: .value("Net worth", point.value))
                                .foregroundStyle(LinearGradient(colors: [Theme.accent.opacity(0.25), Theme.accent.opacity(0)],
                                                                startPoint: .top, endPoint: .bottom))
                                .interpolationMethod(.monotone)
                            LineMark(x: .value("Day", point.date), y: .value("Net worth", point.value))
                                .foregroundStyle(Theme.accent)
                                .lineStyle(StrokeStyle(lineWidth: 2.2, lineCap: .round))
                                .interpolationMethod(.monotone)
                        }
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .chartYScale(domain: .automatic(includesZero: false))
                    .frame(height: 64)
                    .padding(.top, 4)
                    .accessibilityLabel("Net worth over the last three months")
                }
            }
            .padding(.vertical, 4)
        }
    }
}

// MARK: - Pages

/// Budgets: each this month or pay period, tap one to change its amount.
private struct FinanceBudgetsPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var editingBudget: FinanceBudget?

    var body: some View {
        Form {
            if let view = finances.plan {
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
                } footer: {
                    if finances.canEdit { Text("Tap a budget to change its amount.") }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Budgets")
        .sheet(item: $editingBudget) { budget in
            AmountEditor(
                title: "Change Budget", heading: budget.category,
                footer: budget.per == "paycheck" ? "What it may take each pay period." : "What it may take each month.",
                finances: finances
            ) { amount in await finances.setBudget(budget, to: amount) }
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
                .tint(budget.isOver ? Theme.danger : budget.isAhead ? Theme.warning : Theme.success)
            Text(budget.isOver ? "Over budget" : budget.isAhead ? "Ahead of an even pace" : (budget.per == "paycheck" ? "This pay period" : "This month"))
                .font(.caption)
                .foregroundStyle(budget.isOver ? Theme.danger : .secondary)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Bills: what's taken as done since the balances were typed in, then each
/// pay period ahead with its payments; tap one to change what it costs.
private struct FinanceBillsPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var editingPayment: FinancePayment?

    var body: some View {
        Form {
            if let view = finances.plan {
                if !view.since.isEmpty { SinceSection(view: view, finances: finances) }
                ForEach(view.periods.prefix(8)) { period in
                    PeriodSection(period: period, view: view, finances: finances) { payment in
                        finances.clearSaveError()
                        editingPayment = payment
                    }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Bills")
        .sheet(item: $editingPayment) { payment in
            AmountEditor(
                title: "Change Payment", heading: payment.name,
                footer: payment.estimate == true
                    ? "About what it costs each time. Every one still to come changes."
                    : "What it costs each time. Every one still to come changes.",
                finances: finances
            ) { amount in await finances.setPayment(payment, to: amount) }
        }
    }
}

/// Investments, as Ghostfolio last read them on the computer.
private struct FinanceInvestmentsPage: View {
    @Bindable var finances: FinancesViewModel

    var body: some View {
        Form {
            if let view = finances.plan, let investments = view.investments {
                InvestmentsSection(investments: investments, view: view, finances: finances)
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .navigationTitle("Investments")
    }
}

/// Accounts today, net worth and the cushion; tap an account to type in its balance.
private struct FinanceAccountsPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var editing: FinanceAccount?
    @State private var editingCushion = false

    var body: some View {
        Form {
            if let view = finances.plan { accounts(view) }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Accounts")
        .sheet(item: $editing) { account in
            BalanceEditor(account: account, finances: finances)
        }
        .sheet(isPresented: $editingCushion) {
            AmountEditor(
                title: "Change Cushion", heading: "The least checking should hold",
                footer: "A pay period that leaves less is flagged. Type 0 to turn that off.",
                allowsZero: true,
                finances: finances
            ) { amount in await finances.setCushion(amount) }
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
            Text("Today")
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
        HStack(spacing: 12) {
            LogoCircle(account: account, size: 36)
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

/// Goals: what each needs, and by when; tap one to change its target.
private struct FinanceGoalsPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var editingGoal: FinanceGoal?

    var body: some View {
        Form {
            if let view = finances.plan {
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
                } footer: {
                    if finances.canEdit { Text("Tap a goal to change its target.") }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Goals")
        .sheet(item: $editingGoal) { goal in
            AmountEditor(
                title: "Change Goal", heading: goal.name,
                footer: "How much it needs in all. What's put by toward it stays as it is.",
                finances: finances
            ) { amount in await finances.setGoal(goal, target: amount) }
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
                .tint(goal.isReached ? Theme.success : .accentColor)
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
}

/// Loans: what each still owes, and when it's paid off at this pace.
private struct FinanceLoansPage: View {
    @Bindable var finances: FinancesViewModel

    var body: some View {
        Form {
            if let view = finances.plan {
                Section {
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
                                    .foregroundStyle(Theme.danger)
                            } else if let paidOff = loan.paidOff {
                                Text("Paid off \(paidOff, format: .dateTime.month(.wide).year())\(loan.rate > 0 ? " · \(loan.rate.formatted(.number.precision(.fractionLength(0...2))))%" : "")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            } else if loan.balance <= 0 {
                                Text("Paid off").font(.caption).foregroundStyle(Theme.success)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .navigationTitle("Loans")
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
                        Text(detail(past)).font(.caption).foregroundStyle(past.waiting ? Theme.warning : .secondary)
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
        if let payment = past.payment { return view.paymentTitle(payment) ?? "Payment" }
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
                    .foregroundStyle(Theme.warning)
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
                    Text(verbatim: view.paymentTitle(row.payment) ?? "Payment")
                    if row.late {
                        Text("Late").font(.caption2.bold()).foregroundStyle(Theme.danger)
                    }
                    if row.saved {
                        Image(systemName: "leaf.fill").font(.caption2).foregroundStyle(Theme.success)
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
                    .foregroundStyle(row.into ? Theme.success : .primary)
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
                    Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.danger) }
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
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
                        Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.danger)
                    }
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
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

    /// Which way, how much, and who.
    private var whatSection: some View {
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
    }

    /// Which account and category, the day, and a note.
    private var whereSection: some View {
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
    }

    /// A kept receipt and Delete, for one being changed; a photo to attach, for a new one.
    @ViewBuilder
    private var receiptSection: some View {
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
                    // Read here, on the main actor: PhotosPicker's label isn't.
                    let busy = attaching
                    PhotosPicker(selection: $photo, matching: .images) {
                        HStack {
                            Label("Attach a Photo of the Receipt", systemImage: "camera")
                            if busy {
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
    }

    var body: some View {
        NavigationStack {
            Form {
                whatSection
                whereSection
                receiptSection
                if let error = finances.saveError {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.danger)
                    }
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
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
        let layout = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout(spacing: 12))
        layout {
            // The payee's logo, as the computer's Finances shows it (Design.swift).
            if !large {
                LogoCircle(transaction: transaction, categories: finances.plan?.categories ?? [], size: 40)
            }
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
                .foregroundStyle(transaction.amount > 0 ? Theme.success : .primary)
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
    /// "+$40.00" and "-$12.00": a change rather than a balance.
    var signed = false

    var body: some View {
        if finances.amountsHiddenByPlan || !finances.amountsShown {
            Text(verbatim: "••••")
                .foregroundStyle(.secondary)
                .accessibilityLabel("Amount hidden")
        } else {
            Text(value, format: .currency(code: currency).sign(strategy: signed ? .always() : .automatic))
                .monospacedDigit()
                .privacySensitive()
        }
    }
}

/// The two figures the household checks against its own sums, as the
/// computer's Dashboard starts with them (main #482): checking now, and
/// checking once the next paycheck lands. Each opens how it adds up.
private struct CheckingSection: View {
    let now: FinanceWorking
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        Section {
            figure(now, caption: now.typedSameDay
                       ? "Now, as typed in today"
                       : "Now, typed in \(Self.short(now.from))",
                   start: "Checking, typed in \(Self.long(now.from))", end: "Checking now", note: nil)
            if let pay = view.afterPay {
                let whose = view.nextPay.map { view.names($0.people) } ?? ""
                let count = view.paydayPayments
                figure(pay, caption: "After \(whose.isEmpty ? "the next" : whose + "'s") paycheck, \(Self.short(pay.date))",
                       start: "Checking now", end: "Once the paycheck is in, \(Self.long(pay.date))",
                       note: count == 0 ? nil
                           : count == 1
                           ? "One payment due \(Self.short(pay.date)) comes out of this paycheck after it lands, so it isn't in this number."
                           : "\(count) payments due \(Self.short(pay.date)) come out of this paycheck after it lands, so they aren't in this number.")
            }
        } header: {
            Text("Checking")
        } footer: {
            Text("Tap one to see how it adds up, row by row.")
        }
    }

    private func figure(_ working: FinanceWorking, caption: String, start: String, end: String, note: String?) -> some View {
        NavigationLink {
            CheckingWorkingView(working: working, view: view, finances: finances, title: caption, start: start, end: end, note: note)
        } label: {
            LabeledContent {
                Money(value: working.result, currency: view.plan.currency, finances: finances)
                    .fontWeight(.semibold)
                    .foregroundStyle(working.result < 0 ? Theme.danger : Color.primary)
            } label: {
                Text(verbatim: caption)
            }
        }
    }

    /// "Nov 14", or "a day" when the computer sent none.
    static func short(_ date: Date?) -> String {
        date?.formatted(.dateTime.month(.abbreviated).day()) ?? "a day"
    }

    /// "Friday, November 14".
    static func long(_ date: Date?) -> String {
        date?.formatted(.dateTime.weekday(.wide).month(.wide).day()) ?? "a day"
    }
}

/// How a checking figure adds up: where it starts, each thing in and out
/// with checking after it, and where it ends. The computer's own steps.
private struct CheckingWorkingView: View {
    let working: FinanceWorking
    let view: FinancesPlanView
    let finances: FinancesViewModel
    let title: String
    let start: String
    let end: String
    let note: String?

    var body: some View {
        Form {
            Section {
                LabeledContent {
                    Money(value: working.start, currency: view.plan.currency, finances: finances)
                } label: {
                    Text(verbatim: start).fontWeight(.semibold)
                }
            }
            Section {
                if working.steps.isEmpty {
                    Text("Nothing in or out in between")
                        .foregroundStyle(.secondary)
                }
                ForEach(Array(working.steps.enumerated()), id: \.offset) { _, step in
                    stepRow(step)
                }
            }
            Section {
                LabeledContent {
                    Money(value: working.result, currency: view.plan.currency, finances: finances)
                        .fontWeight(.semibold)
                        .foregroundStyle(working.result < 0 ? Theme.danger : Color.primary)
                } label: {
                    Text(verbatim: end).fontWeight(.semibold)
                }
            } footer: {
                if let note { Text(verbatim: note) }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle("How It Adds Up")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    private func stepRow(_ step: FinanceStep) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: view.stepName(step))
                HStack(spacing: 4) {
                    Text(verbatim: CheckingSection.short(step.date))
                    if let id = step.transaction, !id.isEmpty {
                        Text("· in Transactions")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Money(value: step.amount, currency: view.plan.currency, finances: finances, signed: true)
                    .foregroundStyle(step.amount > 0 ? Theme.success : Color.primary)
                Money(value: step.after, currency: view.plan.currency, finances: finances)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// What the investment accounts hold, as Ghostfolio last read them on the
/// computer (main #489): kept in the plan, so it shows here. Read again on
/// the computer; the phone only shows it.
private struct InvestmentsSection: View {
    let investments: FinanceInvestments
    let view: FinancesPlanView
    let finances: FinancesViewModel

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        Section {
            LabeledContent {
                Money(value: investments.total, currency: view.plan.currency, finances: finances)
                    .fontWeight(.semibold)
            } label: {
                Text("Total value")
                Text("\(investments.holdingCount) \(investments.holdingCount == 1 ? "holding" : "holdings") in \(investments.accounts.count) \(investments.accounts.count == 1 ? "account" : "accounts")")
            }
            LabeledContent {
                Money(value: investments.paid, currency: view.plan.currency, finances: finances)
            } label: {
                Text("You paid")
                Text("What went in")
            }
            change("Gain", investments.gain, of: investments.paid, note: "on what you paid")
            change("This month", investments.month, of: investments.total - investments.month,
                   note: investments.since.map { "since \($0.formatted(.dateTime.month(.abbreviated).day()))" } ?? "")
            ForEach(Array(investments.lines.enumerated()), id: \.offset) { _, line in
                if let holding = line.holding {
                    NavigationLink {
                        HoldingView(holding: holding, account: line.account, view: view, finances: finances)
                    } label: {
                        row(line)
                    }
                } else {
                    row(line)
                }
            }
        } header: {
            Text("Investments")
        } footer: {
            Text(readWhen.map { "From Ghostfolio, \($0). It's read again on the computer, under Finances › Net worth." }
                 ?? "From Ghostfolio. It's read again on the computer, under Finances › Net worth.")
        }
    }

    private func currency(_ account: FinanceAccount) -> String {
        if let code = account.currency, !code.isEmpty { return code }
        return view.plan.currency
    }

    private func change(_ title: String, _ value: Double, of base: Double, note: String) -> some View {
        LabeledContent {
            Money(value: value, currency: view.plan.currency, finances: finances, signed: true)
                .foregroundStyle(value < 0 ? Theme.danger : value > 0 ? Theme.success : Color.primary)
        } label: {
            Text(verbatim: title)
            Text(verbatim: [shown ? FinanceInvestments.share(value, of: base) : nil, note]
                .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " "))
        }
    }

    private func row(_ line: FinanceInvestments.Line) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: line.holding?.symbol ?? "Cash").fontWeight(.semibold)
                Text(verbatim: line.holding.map { "\($0.title) · \(line.account.name)" } ?? "Not in a holding · \(line.account.name)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Money(value: line.holding?.value ?? line.cash, currency: currency(line.account), finances: finances)
                if let holding = line.holding {
                    HStack(spacing: 4) {
                        Money(value: holding.gain, currency: currency(line.account), finances: finances, signed: true)
                        if shown, let share = FinanceInvestments.share(holding.gain, of: holding.paid) {
                            Text(verbatim: share)
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(holding.gain < 0 ? Theme.danger : Theme.success)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// "read 7:02 AM today", "read yesterday at 7:02 AM", "read Nov 2".
    private var readWhen: String? {
        guard let at = view.plan.holdingsRead else { return nil }
        let calendar = Calendar.current
        let time = at.formatted(date: .omitted, time: .shortened)
        if calendar.isDateInToday(at) { return "read \(time) today" }
        if calendar.isDateInYesterday(at) { return "read yesterday at \(time)" }
        return "read \(at.formatted(.dateTime.month(.abbreviated).day()))"
    }
}

/// One holding: its shares, what went in, its worth, and its worth at each read.
private struct HoldingView: View {
    let holding: FinanceHolding
    let account: FinanceAccount
    let view: FinancesPlanView
    let finances: FinancesViewModel

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }
    private var currency: String {
        if let code = account.currency, !code.isEmpty { return code }
        return view.plan.currency
    }

    var body: some View {
        Form {
            Section {
                LabeledContent("Shares") {
                    if shown {
                        Text(holding.shares, format: .number.precision(.fractionLength(0...(holding.shares < 1 ? 4 : 3))))
                            .monospacedDigit()
                            .privacySensitive()
                    } else {
                        Text(verbatim: "•••").foregroundStyle(.secondary)
                    }
                }
                LabeledContent("You paid") { Money(value: holding.paid, currency: currency, finances: finances) }
                LabeledContent("Worth now") { Money(value: holding.value, currency: currency, finances: finances) }
                LabeledContent {
                    Money(value: holding.gain, currency: currency, finances: finances, signed: true)
                        .foregroundStyle(holding.gain < 0 ? Theme.danger : Theme.success)
                } label: {
                    Text("Gain")
                    if shown, let share = FinanceInvestments.share(holding.gain, of: holding.paid) {
                        Text(verbatim: share)
                    }
                }
            } header: {
                Text(verbatim: holding.title)
            } footer: {
                if shown, holding.shares > 0 {
                    Text("A share is worth \((holding.value / holding.shares).formatted(.currency(code: currency))) now; they cost \((holding.paid / holding.shares).formatted(.currency(code: currency))) each on average.")
                }
            }
            Section {
                let points = holding.history.filter { $0.date != nil }
                if points.count >= 2, shown {
                    Chart(Array(points.enumerated()), id: \.offset) { _, point in
                        LineMark(x: .value("Day", point.date ?? .distantPast), y: .value("Worth", point.amount))
                            .foregroundStyle(Theme.accent)
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .frame(height: 160)
                    .privacySensitive()
                    .accessibilityLabel("\(holding.symbol) at each read")
                }
                if points.isEmpty {
                    Text("Not read yet. Each read from now on adds its day here.")
                        .foregroundStyle(.secondary)
                } else if points.count == 1 {
                    Text("Read once so far. Each read from now on adds its day here.")
                        .foregroundStyle(.secondary)
                }
                ForEach(Array(points.suffix(30).reversed().enumerated()), id: \.offset) { _, point in
                    LabeledContent {
                        Money(value: point.amount, currency: currency, finances: finances)
                    } label: {
                        Text(point.date ?? .distantPast, format: .dateTime.weekday(.abbreviated).month().day().year())
                    }
                }
            } header: {
                Text("At Each Read")
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle(Text(verbatim: holding.symbol))
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}
