import Charts
import PhotosUI
import SwiftUI

/// Finances' home, as cards: what's left after this paycheck's bills, the
/// accounts as a row of small cards, net worth and this month's cash flow
/// side by side, what's left to spend and the next bill side by side, the latest
/// transactions, the bills coming, and the rest of Finances one tap away.
/// Amounts stay hidden until Show Amounts, and none show at all while Hide
/// amounts is on at the computer.
struct FinancesView: View {
    @Bindable var finances: FinancesViewModel
    /// The floating +'s Add Transaction.
    @State private var adding = false

    var body: some View {
        ScrollView {
            if finances.privacy == .locked {
                // A member's private Finances, locked: nothing of hers is on this device until they open.
                VStack(spacing: 18) {
                    PrivateLockedView(finances: finances)
                    if let shared = finances.shared, !shared.isEmpty {
                        HouseholdCard(shared: shared, finances: finances)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 28)
            } else if let view = finances.plan {
                VStack(spacing: 18) {
                    if finances.privacy == .open { PrivateOpenBanner(finances: finances) }
                    if let asOf = finances.offlineAsOf {
                        if finances.canEditAway { AwayBanner(asOf: asOf, finances: finances) } else { OfflineBanner(asOf: asOf) }
                    }
                    // Changes made away: sent once home, or why they still wait.
                    if let sent = finances.awaySent {
                        AwaySentCard(sent: sent.sent, dropped: sent.dropped) { finances.dismissAwaySent() }
                    } else if finances.offlineAsOf == nil, finances.awayCount > 0, let why = finances.awaySendError {
                        Label(why, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(Theme.warning)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if view.plan.accounts.isEmpty, finances.canEditPlan {
                        FirstAccountCard(finances: finances)
                    }
                    if let now = view.checkingNow {
                        CheckingHero(now: now, view: view, finances: finances)
                    } else {
                        AccountsRow(view: view, finances: finances)
                    }
                    // Worth a look: the Dashboard's prompts, only when one needs you (not on private Finances).
                    if !finances.isPrivate { WorthALookCard(finances: finances) }
                    // A member's phone: what the owner shares of the household's, first.
                    if finances.isMember, let shared = finances.shared, !shared.isEmpty {
                        HouseholdCard(shared: shared, finances: finances)
                    }
                    // Net worth and Cash flow side by side, as the redesign's picture; the full line is on Accounts.
                    NetWorthFullCard(view: view, finances: finances)
                    CashFlowFullCard(view: view, finances: finances)
                    // Spending this month against last, as a line.
                    SpendingPaceCard(view: view, finances: finances)
                    // This paycheck's bills, then the latest transactions and the budgets worth a look.
                    PaycheckBillsCards(view: view, finances: finances)
                    RecentTransactionsCard(view: view, finances: finances)
                    BudgetsCard(view: view, finances: finances)
                    MoreFinancesCard(view: view, finances: finances)
                    if finances.canMakePrivate { PrivateOfferCard(finances: finances) }
                    if finances.privacy == .open, finances.canEdit { PrivateOffButton(finances: finances) }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 88)  // Room under the last card for the floating +.
            } else if let error = finances.planError {
                ContentUnavailableView("Couldn't Read Finances", systemImage: "banknote", description: Text(verbatim: error))
                    .padding(.top, 80)
            } else if finances.canSeePlan {
                // The cards' shapes while the plan is read, not a spinner.
                SkeletonCards()
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .transition(.opacity)
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .animation(.smooth(duration: 0.3), value: finances.plan == nil)
        .animation(.smooth(duration: 0.3), value: finances.privacy)
        .overlay {
            if !finances.canSeePlan {
                ContentUnavailableView("Finances Aren't on This Device", systemImage: "banknote",
                                       description: Text("On the computer, Settings › Phones, let this device see Finances."))
            }
        }
        // Again once the device's level is known: right after unlock it may not be yet.
        .task(id: finances.canSeePlan) {
            await finances.loadPlan()
            await finances.loadShared()
        }
        // Offline: try the Homelab again now and then, and read the newest
        // by itself once it answers (home again, or the tunnel).
        .task(id: finances.offlineAsOf) {
            guard finances.offlineAsOf != nil else { return }
            while !Task.isCancelled, finances.offlineAsOf != nil {
                try? await Task.sleep(for: .seconds(30))
                if Task.isCancelled { return }
                await finances.loadPlan()
                if finances.offlineAsOf == nil {
                    await finances.loadLedger()
                    await finances.loadShared()
                }
            }
        }
        // Her private Finances away: try the Homelab again now and then, and send what waits.
        .task(id: finances.privateAwaySince != nil || finances.privateWaiting > 0) {
            while !Task.isCancelled, finances.privateAwaySince != nil || finances.privateWaiting > 0 {
                try? await Task.sleep(for: .seconds(30))
                if Task.isCancelled { return }
                await finances.privateComeHome()
            }
        }
        // The money widget's words, in words only, each time Finances is read (only once it's turned on).
        .onChange(of: finances.plan, initial: true) { _, view in
            guard let view, MoneyLineStore.isEnabled,
                  let line = MoneyLine.words(LeftUntil(view), nextBill: Self.upcomingBills(view, limit: 1).first?.date,
                                             today: view.today ?? Date())
            else { return }
            if MoneyLineStore.save(line) { WidgetSummaryStore.reloadWidget() }
        }
        // The latest transactions, once there's a plan to show them with.
        .task(id: finances.plan == nil) {
            if finances.plan != nil, finances.ledger == nil { await finances.loadLedger() }
        }
        .refreshable {
            await finances.loadPlan()
            await finances.loadLedger()
            await finances.loadShared()
        }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .animation(.smooth, value: finances.amountsShown)
        .modifier(AwayClashSheet(finances: finances))
        // A floating + to add a transaction, where this device may.
        .overlay(alignment: .bottomTrailing) {
            if finances.plan != nil, finances.canAddTransactions {
                Button {
                    finances.clearSaveError()
                    adding = true
                } label: {
                    Image(systemName: "plus")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 58, height: 58)
                        .background(Theme.accentFill, in: Circle())
                        .shadow(color: Theme.accentFill.opacity(0.4), radius: 12, y: 6)
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel("Add Transaction")
                .padding(.trailing, 18)
                .padding(.bottom, 14)
            }
        }
        .sheet(isPresented: $adding) {
            AddTransactionView(finances: finances)
        }
        .navigationTitle(finances.isMember ? "My Finances" : "Finances")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if !finances.amountsHiddenByPlan {
                    Button {
                        finances.amountsShown.toggle()
                    } label: {
                        Label(finances.amountsShown ? "Hide Amounts" : "Show Amounts",
                              systemImage: finances.amountsShown ? "eye.slash" : "eye")
                    }
                    .sensoryFeedback(.selection, trigger: finances.amountsShown)
                }
            }
            // Export, as the computer's (F18): the year ahead as a spreadsheet and the plan, even look-only, while amounts show.
            ToolbarItem(placement: .secondaryAction) {
                let files = finances.exportFiles()
                if !files.isEmpty {
                    Menu {
                        ForEach(files) { file in
                            ShareLink(item: file, preview: SharePreview(file.title)) {
                                Label(file.title, systemImage: file.printable ? "printer" : file.name.hasSuffix(".csv") ? "tablecells" : "doc.text")
                            }
                        }
                    } label: {
                        Label("Export", systemImage: "square.and.arrow.up")
                    }
                }
            }
            if finances.privacy == .open {
                ToolbarItem(placement: .secondaryAction) {
                    Button {
                        finances.lockPrivate()
                    } label: {
                        Label("Lock My Finances", systemImage: "lock")
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
        guard let row = upcomingBills(view, limit: 1).first, let name = view.paymentTitle(row.payment) else { return nil }
        if row.dateText == view.todayText { return "\(name) today" }
        guard let date = row.date else { return name }
        return "\(name) on \(date.formatted(.dateTime.weekday(.wide)))"
    }

    /// The bills still to come, soonest first: not money moved between the
    /// household's own accounts, nor money coming in, nor a payment the
    /// plan no longer has.
    nonisolated static func upcomingBills(_ view: FinancesPlanView, limit: Int) -> [FinanceRow] {
        var out: [FinanceRow] = []
        let today = view.todayText
        for period in view.periods {
            for row in period.rows where !row.outside && !row.into && row.amount > 0 && (row.dateText ?? "") >= today {
                guard view.paymentTitle(row.payment) != nil else { continue }
                out.append(row)
                if out.count >= limit { return out }
            }
        }
        return out
    }
}

/// An amount as a card's text: "••••" while amounts are hidden.
@MainActor
func amountText(_ value: Double, _ currency: String, _ finances: FinancesViewModel, whole: Bool = false) -> String {
    if finances.amountsHiddenByPlan || !finances.amountsShown { return "••••" }
    let style = FloatingPointFormatStyle<Double>.Currency(code: currency)
    return whole ? value.formatted(style.precision(.fractionLength(0))) : value.formatted(style)
}

/// A card's heading: its name, and a link or a note on the right.
struct CardHeading<Trailing: View>: View {
    let title: LocalizedStringKey
    /// A small symbol before the title.
    var icon: String? = nil
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            if let icon {
                Image(systemName: icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
                    .accessibilityHidden(true)
            }
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Spacer(minLength: 8)
            trailing()
                .font(.subheadline.weight(.semibold))
        }
    }
}

extension CardHeading where Trailing == EmptyView {
    init(_ title: LocalizedStringKey) { self.init(title: title) { EmptyView() } }
}

/// A card's title with its small symbol before it, as CardHeading draws one.
private struct CardTitleLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            configuration.icon
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.secondaryInk)
            configuration.title
        }
    }
}

/// A card's round ↗: opens what's behind the card.
private struct OpenButton: View {
    var label: LocalizedStringKey = "Open"

    var body: some View {
        Image(systemName: "arrow.up.right")
            .font(.footnote.weight(.bold))
            .foregroundStyle(Theme.secondaryInk)
            .frame(width: 32, height: 32)
            .background(Theme.separator, in: Circle())
            .accessibilityLabel(Text(label))
    }
}

/// Finances' top, as the redesign's phone picture: what's
/// left after this paycheck's bills, then the accounts as a row of cards.
private struct CheckingHero: View {
    let now: FinanceWorking
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        VStack(spacing: 10) {
            // What's left first: the number people open Finances for, as the redesign's
            // card: the figure, its chart through the period, and Now, Payday and Bills under it.
            if let lead = FinanceLead(view), let left = LeftUntil(view) {
                FinanceLeadCard(lead: lead, left: left, now: now, view: view, finances: finances)
                    .padding(.bottom, 8)
            }
            // How checking adds up is the first card's Now; here each account opens its own page.
            AccountsRow(view: view, finances: finances)
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

/// The accounts as small cards in a row, as the redesign's phone picture
/// : checking first, each with its bank's logo, its
/// balance (what a card owes as less than nothing) and its name; a swipe for
/// the rest. Each opens its account's page.
private struct AccountsRow: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    static let size = CGSize(width: 156, height: 104)

    var body: some View {
        let cards = AccountStrip.cards(view)
        if !cards.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(cards) { card in
                        NavigationLink {
                            AccountDetailView(account: card.account, finances: finances)
                        } label: {
                            tile(card)
                        }
                        .buttonStyle(PressableButtonStyle())
                        .accessibilityHint("Opens its page")
                    }
                }
                // Room for the cards' shadow, which the row would otherwise cut.
                .padding(.vertical, 6)
            }
            // The row runs to the screen's edge as it slides, as in the picture.
            .scrollClipDisabled()
            // Small cards: their words stay on them at any text size.
            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        }
    }

    private func tile(_ card: AccountStrip.Card) -> some View {
        let style = WalletStyle(kind: card.account.kind)
        let ink: Color = style.hasDarkText ? Color(light: 0x1C1C1E, dark: 0x1C1C1E) : .white
        let quiet: Color = style.hasDarkText ? Color(light: 0x5E5E66, dark: 0x5E5E66) : .white.opacity(0.9)
        let amount = amountText(card.amount, card.account.currency ?? view.plan.currency, finances)
        return VStack(alignment: .leading, spacing: 1) {
            LogoCircle(account: card.account, size: 26)
            Spacer(minLength: 4)
            Text(verbatim: amount)
                .font(.title3.weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
            Text(verbatim: card.account.name)
                .font(.footnote.weight(.medium))
                .foregroundStyle(quiet)
                .lineLimit(1)
        }
        .foregroundStyle(ink)
        .padding(14)
        .frame(width: Self.size.width, height: Self.size.height, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(colors: style.colours, startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: Design.shadow.opacity(0.14), radius: 6, y: 4)
        }
        .environment(\.colorScheme, style.hasDarkText ? .light : .dark)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(card.account.name), \(amount)"))
    }
}

/// Finances' first card as the redesign's phone picture and the computer's Dashboard: Left after
/// this paycheck's bills, the figure with its cents smaller, in checking on the period's last day after its bills, a chip
/// against the period before, checking each day as steps with a dot at each bill and the cushion dashed, then Now,
/// Payday and Bills. The card opens Bills, paycheck by paycheck; Now and Payday open how each adds up.
private struct FinanceLeadCard: View {
    let lead: FinanceLead
    let left: LeftUntil
    let now: FinanceWorking
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @Environment(\.dynamicTypeSize) private var typeSize

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        let currency = view.plan.currency
        let cushion = view.plan.cushion
        let figure = FinanceLead.splitCents(amountText(lead.left, currency, finances))
        let warning = left.warning(cushion: amountText(cushion, currency, finances, whole: true),
                                   short: amountText(abs(left.low?.amount ?? 0), currency, finances, whole: true))
        VStack(alignment: .leading, spacing: 12) {
            NavigationLink {
                FinanceBillsPage(finances: finances)
            } label: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Left after this paycheck's bills")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    HStack(alignment: .firstTextBaseline) {
                        (Text(verbatim: figure.whole).font(.largeTitle.weight(.semibold))
                            + Text(verbatim: figure.cents).font(.title2.weight(.semibold)).foregroundColor(Theme.secondaryInk))
                            .monospacedDigit()
                            .foregroundStyle(!shown ? Theme.secondaryInk : lead.left < 0 ? Theme.danger : Theme.ink)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                        Spacer(minLength: 8)
                        if let change = lead.change, shown, abs(change) >= 0.005 {
                            chip(change, currency)
                        }
                    }
                    Text(verbatim: lead.label())
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .tracking(0.6)
                        .foregroundStyle(Theme.secondaryInk)
                    if let warning {
                        Label(warning, systemImage: "exclamationmark.triangle.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(left.low?.short == true ? Theme.danger : Theme.warning)
                    }
                    if lead.days.count >= 2 {
                        chart(cushion: cushion)
                            .frame(height: 120)
                            .padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Bills, paycheck by paycheck")
            let layout = typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(spacing: 8))
                : AnyLayout(HStackLayout(spacing: 8))
            layout {
                NavigationLink {
                    CheckingWorkingView(working: now, view: view, finances: finances, title: "Checking now",
                                        start: "Checking, typed in \(CheckingHero.long(now.from))", end: "Checking now", note: nil)
                } label: {
                    tile("Now", amountText(now.result, currency, finances, whole: true), tone: now.result < 0 ? Theme.danger : Theme.ink)
                }
                .buttonStyle(PressableButtonStyle())
                if let pay = view.afterPay {
                    NavigationLink {
                        CheckingWorkingView(working: pay, view: view, finances: finances, title: "On payday, \(CheckingHero.short(pay.date))",
                                            start: "Checking now", end: "Once the paycheck is in, \(CheckingHero.long(pay.date))", note: nil)
                    } label: {
                        tile("Payday", amountText(pay.result, currency, finances, whole: true), tone: pay.result < 0 ? Theme.danger : Theme.ink)
                    }
                    .buttonStyle(PressableButtonStyle())
                }
                tile(lead.bills == 0 ? "Bills" : "Bills · \(lead.bills)", amountText(-lead.owed, currency, finances, whole: true),
                     tone: lead.owed > 0.005 && shown ? Theme.danger : Theme.ink)
            }
        }
        .padding(18)
        .card()
    }

    @ViewBuilder
    private func chart(cushion: Double) -> some View {
        Chart {
            ForEach(lead.days) { day in
                AreaMark(x: .value("Day", day.date), y: .value("Checking", day.balance))
                    .interpolationMethod(.stepEnd)
                    .foregroundStyle(Theme.accent.opacity(0.12))
                LineMark(x: .value("Day", day.date), y: .value("Checking", day.balance))
                    .interpolationMethod(.stepEnd)
                    .foregroundStyle(Theme.accent)
                if day.bill {
                    PointMark(x: .value("Day", day.date), y: .value("Checking", day.balance))
                        .foregroundStyle(Theme.warning)
                        .symbolSize(30)
                }
            }
            if cushion > 0 {
                RuleMark(y: .value("Cushion", cushion))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .foregroundStyle(Theme.danger.opacity(0.6))
            }
        }
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: max(1, lead.days.count / 3))) { _ in
                AxisValueLabel(format: .dateTime.month(.abbreviated).day(), centered: false)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Checking each day of the period, a step at each bill")
    }

    private func chip(_ change: Double, _ currency: String) -> some View {
        let up = change >= 0
        return VStack(alignment: .trailing, spacing: 2) {
            Label((up ? "+" : "−") + amountText(abs(change), currency, finances), systemImage: up ? "arrow.up.right" : "arrow.down.right")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(up ? Theme.success : Theme.danger)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background((up ? Theme.success : Theme.danger).opacity(0.12), in: Capsule())
            Text("vs last paycheck")
                .font(.caption)
                .foregroundStyle(Theme.secondaryInk)
        }
        .accessibilityElement(children: .combine)
    }

    private func tile(_ title: String, _ value: String, tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(verbatim: title)
                .font(.caption2.weight(.semibold))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(Theme.secondaryInk)
            Text(verbatim: value)
                .font(.headline)
                .monospacedDigit()
                .foregroundStyle(tone)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.canvas, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// How far back net worth's line goes.
enum NetWorthRange: Int, CaseIterable, Identifiable, Sendable {
    case month = 31
    case threeMonths = 92
    case sixMonths = 183
    case year = 366
    /// Every balance kept.
    case all = 36_500

    var id: Int { rawValue }
    var label: String {
        switch self {
        case .month: "1M"
        case .threeMonths: "3M"
        case .sixMonths: "6M"
        case .year: "1Y"
        case .all: "All"
        }
    }
    var words: String {
        switch self {
        case .month: "1 month"
        case .threeMonths: "3 months"
        case .sixMonths: "6 months"
        case .year: "1 year"
        case .all: "all time"
        }
    }
}

/// Net worth today and how it moved, with its line from each account's
/// kept balances: a finger on the line reads the day under it.
private struct NetWorthCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel
    /// Opens Accounts; off on Accounts itself, where it's the page's top.
    var linked = true
    @State private var range: NetWorthRange = .threeMonths
    @State private var picked: Date?
    /// On Accounts: one group of accounts (Cash, Credit Cards, …) by its title; nil for net worth.
    @State private var group: String?

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        let shownGroup = linked ? nil : view.accountGroups.first { $0.title == group }
        let series = shownGroup.map { view.worthSeries(days: range.rawValue, of: $0.accounts) } ?? view.netWorthSeries(days: range.rawValue)
        let total = shownGroup.map { g in g.accounts.reduce(0) { $0 + view.worth(of: $1) } } ?? view.netWorth
        let point = TrendChart.point(in: series, at: picked)
        let change = AccountsLook.change(series)
        VStack(alignment: .leading, spacing: 0) {
            if !linked, view.accountGroups.count > 1 {
                groupChips
                    .padding(.top, 14)
            }
            Group {
                if linked {
                    NavigationLink {
                        FinanceAccountsPage(finances: finances)
                    } label: {
                        heading(point: point, change: change, total: total)
                    }
                    .buttonStyle(PressableButtonStyle())
                } else {
                    heading(point: point, change: change, total: total)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            // The line and its range sit outside the link, so a finger on the line reads it.
            if shown {
                VStack(spacing: 12) {
                    if series.count >= 2 {
                        TrendChart(series: series, picked: $picked)
                            .frame(height: 120)
                            .padding(.horizontal, 6)
                    }
                    RangePicker(range: $range)
                        .padding(.horizontal, 18)
                }
                .padding(.top, series.count >= 2 ? 10 : 14)
                .padding(.bottom, 16)
            } else {
                Spacer().frame(height: 18)
            }
        }
        .card()
        .animation(.smooth(duration: 0.35), value: range)
        .animation(.smooth(duration: 0.35), value: group)
    }

    /// Net worth, then each group of accounts, as chips (Cash, Credit cards).
    private var groupChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                groupChip("Net worth", on: group == nil) { group = nil }
                ForEach(view.accountGroups) { g in
                    groupChip(g.title, on: group == g.title) { group = g.title }
                }
            }
            .padding(.horizontal, 18)
        }
        .scrollClipDisabled()
    }

    private func groupChip(_ title: String, on: Bool, pick: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.snappy) { picked = nil; pick() }
        } label: {
            Text(verbatim: title)
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(on ? Theme.ink : Theme.secondaryInk)
                .padding(.horizontal, 12)
                .frame(minHeight: 30)
                .background(on ? Theme.canvas : .clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func heading(point: NetWorthPoint?, change: AccountsLook.Change?, total: Double) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(point.map { $0.date.formatted(.dateTime.month(.abbreviated).day().year()) } ?? (group ?? "Net worth"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
                Spacer()
                if linked {
                    Image(systemName: "chevron.right").accessibilityHidden(true)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
            }
            Text(verbatim: amountText(point?.value ?? total, view.plan.currency, finances))
                .font(.largeTitle.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(shown ? Theme.ink : Theme.secondaryInk)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if shown, let change, abs(change.amount) >= 0.5, point == nil {
                HStack(spacing: 4) {
                    Image(systemName: change.amount >= 0 ? "arrow.up" : "arrow.down")
                        .font(.caption.weight(.bold))
                    Text(verbatim: amountText(abs(change.amount), view.plan.currency, finances)
                         + (change.share.map { " (" + abs($0).formatted(.percent.precision(.fractionLength(1))) + ")" } ?? ""))
                    Text(verbatim: range.words)
                        .foregroundStyle(Theme.secondaryInk)
                        .fontWeight(.regular)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(change.amount >= 0 ? Theme.success : Theme.danger)
                .contentTransition(.numericText())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

/// Net worth as a full card: today's figure with its cents smaller, its change
/// over three months as a % chip, and its line with a scale, dotted green or red where it moved most. ↗ opens
/// Accounts, where the line has its ranges and each group.
private struct NetWorthFullCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        let series = view.netWorthSeries(days: NetWorthRange.threeMonths.rawValue)
        let change = AccountsLook.change(series)
        let currency = view.plan.currency
        VStack(alignment: .leading, spacing: 10) {
            CardHeading(title: "Net worth", icon: "chart.line.uptrend.xyaxis") {
                NavigationLink { FinanceAccountsPage(finances: finances) } label: { OpenButton(label: "Accounts") }
                    .buttonStyle(.plain)
            }
            HStack(alignment: .top) {
                FullCardFigure(text: amountText(view.netWorth, currency, finances), tint: Theme.ink, under: "Today")
                Spacer(minLength: 8)
                if shown, let change, abs(change.amount) >= 0.5 {
                    VStack(alignment: .trailing, spacing: 4) {
                        if let share = change.share {
                            FullCardChip(up: change.amount >= 0, words: abs(share).formatted(.percent.precision(.fractionLength(1))))
                        }
                        Text(verbatim: (change.amount >= 0 ? "+" : "−") + CompactMoney.text(abs(change.amount), currency: currency) + " · 3 months")
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryInk)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            if shown, series.count >= 2 {
                chart(series, currency: currency)
                    .frame(height: 170)
            }
        }
        .padding(16)
        .card()
    }

    private func chart(_ series: [NetWorthPoint], currency: String) -> some View {
        let low = series.map(\.value).min() ?? 0
        let high = series.map(\.value).max() ?? 0
        let span = max(high - low, 1)
        return Chart {
            ForEach(series, id: \.date) { p in
                AreaMark(x: .value("Day", p.date), yStart: .value("Low", low - span * 0.05), yEnd: .value("Net worth", p.value))
                    .foregroundStyle(LinearGradient(colors: [Theme.accent.opacity(0.32), Theme.accent.opacity(0.0)], startPoint: .top, endPoint: .bottom))
                LineMark(x: .value("Day", p.date), y: .value("Net worth", p.value))
                    .foregroundStyle(Theme.accent)
                    .lineStyle(StrokeStyle(lineWidth: 2.2))
            }
            ForEach(NetWorthJumps.top(series)) { jump in
                PointMark(x: .value("Day", jump.point.date), y: .value("Net worth", jump.point.value))
                    .foregroundStyle(jump.up ? Theme.success : Theme.danger)
                    .symbolSize(70)
            }
        }
        .chartYScale(domain: (low - span * 0.05)...(high + span * 0.05))
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                AxisValueLabel {
                    if let v = value.as(Double.self) { Text(verbatim: CompactMoney.text(v, currency: currency)) }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Net worth over three months")
    }
}

/// Cash flow as a full card: this month's in less out with its change against
/// last month by the same day, a bar of what was kept and what went out, Income · Expenses · Saved, and the last
/// six months as bars of what each kept, the savings rate dotted over them. ↗ opens Cash Flow. With no
/// transactions this month, no card.
private struct CashFlowFullCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        let today = view.today ?? Date()
        if let flow = CashFlowGlance.make(finances.countedTransactions, today: today) {
            let currency = view.plan.currency
            let kept = flow.kept
            let sign = !shown ? "" : kept >= 0.5 ? "+" : kept <= -0.5 ? "−" : ""
            let lastMonth = Calendar.current.date(byAdding: .month, value: -1, to: flow.month)?.formatted(.dateTime.month(.wide)) ?? "last month"
            VStack(alignment: .leading, spacing: 10) {
                CardHeading(title: "Cash flow", icon: "arrow.left.arrow.right") {
                    NavigationLink { FinanceCashFlowPage(finances: finances) } label: { OpenButton(label: "Cash Flow") }
                        .buttonStyle(.plain)
                }
                HStack(alignment: .top) {
                    FullCardFigure(text: sign + amountText(abs(kept), currency, finances), tint: !shown ? Theme.ink : kept >= 0 ? Theme.success : Theme.danger,
                                   under: flow.month.formatted(.dateTime.month(.wide)))
                    Spacer(minLength: 8)
                    if shown, let change = flow.change, abs(change) >= 0.0005 {
                        VStack(alignment: .trailing, spacing: 4) {
                            FullCardChip(up: change >= 0, words: abs(change).formatted(.percent.precision(.fractionLength(1))))
                            Text(verbatim: "vs \(lastMonth)").font(.caption).foregroundStyle(Theme.secondaryInk)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                if shown {
                    let share = flow.keptShare ?? 0
                    GeometryReader { geo in
                        HStack(spacing: 2) {
                            if share > 0 { Capsule().fill(Theme.success).frame(width: max(6, (geo.size.width - 2) * share)) }
                            if share < 1 { Capsule().fill(Theme.danger) }
                        }
                    }
                    .frame(height: 8)
                    .accessibilityHidden(true)
                }
                HStack(spacing: 8) {
                    tile("Income", amountText(flow.moneyIn, currency, finances, whole: true), tint: Theme.success)
                    tile("Expenses", amountText(flow.moneyOut, currency, finances, whole: true), tint: Theme.ink)
                    tile("Saved", shown ? (flow.keptShare.map { $0.formatted(.percent.precision(.fractionLength(0))) } ?? "—") : "••••", tint: Theme.success)
                }
                if shown {
                    let months = CashFlowHistory.make(CashFlow.months(finances.countedTransactions, ending: today, count: 6, categories: view.categories))
                    if months.count >= 2 {
                        HStack {
                            Text("Last 6 months")
                            Spacer()
                            Label("Savings rate", systemImage: "circle.dotted")
                        }
                        .font(.caption2.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.secondaryInk)
                        .padding(.top, 4)
                        history(months)
                            .frame(height: 120)
                    }
                }
            }
            .padding(16)
            .card()
        }
    }

    private func tile(_ title: LocalizedStringKey, _ value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(Theme.secondaryInk)
            Text(verbatim: value)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.separator))
        .accessibilityElement(children: .combine)
    }

    /// Each month's kept as a bar (this one brighter), the savings rate dotted over them on the bars' scale.
    private func history(_ months: [CashFlowHistory.Month]) -> some View {
        let top = max(months.map(\.kept).max() ?? 0, 1)
        let last = months.last?.month
        return Chart {
            ForEach(months) { m in
                BarMark(x: .value("Month", m.month, unit: .month), y: .value("Kept", m.kept), width: .ratio(0.55))
                    .foregroundStyle(m.month == last ? Theme.success : Theme.success.opacity(0.45))
                    .cornerRadius(5)
            }
            ForEach(months.filter { $0.rate != nil }) { m in
                LineMark(x: .value("Month", m.month, unit: .month), y: .value("Rate", (m.rate ?? 0) * top))
                    .foregroundStyle(Theme.warning)
                    .lineStyle(StrokeStyle(lineWidth: 1.6, dash: [2, 4]))
                PointMark(x: .value("Month", m.month, unit: .month), y: .value("Rate", (m.rate ?? 0) * top))
                    .foregroundStyle(Theme.warning)
                    .symbolSize(36)
                    .annotation(position: .top, spacing: 4) {
                        if m.month == last, let rate = m.rate {
                            Text(verbatim: rate.formatted(.percent.precision(.fractionLength(0))))
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(Theme.warning)
                        }
                    }
            }
        }
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks(values: .stride(by: .month)) { _ in
                AxisValueLabel(format: .dateTime.month(.abbreviated), centered: true)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("What each of the last six months kept, with its savings rate")
    }
}

/// A full card's figure: the cents smaller, and what it is under it.
private struct FullCardFigure: View {
    let text: String
    let tint: Color
    let under: String

    var body: some View {
        let figure = FinanceLead.splitCents(text)
        VStack(alignment: .leading, spacing: 2) {
            (Text(verbatim: figure.whole).font(.largeTitle.weight(.semibold))
             + Text(verbatim: figure.cents).font(.title2.weight(.semibold)).foregroundColor(Theme.secondaryInk))
                .monospacedDigit()
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(verbatim: under)
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
        }
    }
}

/// A full card's % chip: green and up, or red and down.
private struct FullCardChip: View {
    let up: Bool
    let words: String

    var body: some View {
        Label(words, systemImage: up ? "arrow.up.right" : "arrow.down.right")
            .font(.subheadline.weight(.bold))
            .foregroundStyle(up ? Theme.success : Theme.danger)
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background((up ? Theme.success : Theme.danger).opacity(0.14), in: Capsule())
    }
}

/// The latest transactions, as Wallet lists them; All opens them all.
private struct RecentTransactionsCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @Namespace private var zoom

    var body: some View {
        let latest = Array((finances.ledger?.newestFirst ?? []).prefix(4))
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center) {
                NavigationLink {
                    TransactionsView(finances: finances)
                } label: {
                    Label("Latest transactions", systemImage: "list.bullet")
                        .labelStyle(CardTitleLabelStyle())
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if finances.newTransactionCount > 0 {
                    // New ones go to the inbox.
                    NavigationLink {
                        ReviewInboxPage(finances: finances)
                    } label: {
                        HStack(spacing: 4) {
                            Text("\(finances.newTransactionCount) to review")
                            Image(systemName: "chevron.right").accessibilityHidden(true).font(.caption.weight(.bold))
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Theme.accentFill, in: Capsule())
                    }
                    .buttonStyle(PressableButtonStyle())
                } else {
                    NavigationLink {
                        TransactionsView(finances: finances)
                    } label: {
                        OpenButton(label: "All transactions")
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.bottom, 6)
            if finances.ledger == nil {
                HStack {
                    Spacer()
                    if finances.ledgerError == nil { ProgressView() } else { Text("Couldn't read the transactions.").foregroundStyle(Theme.secondaryInk) }
                    Spacer()
                }
                .padding(.vertical, 16)
            } else if latest.isEmpty {
                Text("No transactions yet.")
                    .foregroundStyle(Theme.secondaryInk)
                    .padding(.vertical, 12)
            }
            ForEach(Array(latest.enumerated()), id: \.element.id) { i, t in
                if i > 0 { Divider().padding(.leading, 58) }
                NavigationLink {
                    TransactionDetailView(transaction: t, finances: finances)
                        .zoomTransition(id: t.id, in: zoom)
                } label: {
                    WalletTransactionRow(transaction: t, finances: finances, isNew: finances.isNew(t), showsAccount: true, showsDay: false)
                        .contentShape(Rectangle())
                        .zoomSource(id: t.id, in: zoom)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .card()
    }
}

/// Spending this month against last month: what's gone out so far, the
/// difference from last month by the same day in a chip, and both months as
/// lines, this one filled to today and last month's dashed. All opens
/// Spending. Nothing in either month, no card.
private struct SpendingPaceCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        if let pace = SpendingPace.make(finances.countedTransactions, today: view.today ?? Date()) {
            NavigationLink {
                FinanceSpendingPage(finances: finances)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    CardHeading(title: "Spending", icon: "cart") { OpenButton(label: "Spending") }
                    HStack(alignment: .top) {
                        let figure = FinanceLead.splitCents(amountText(pace.spent, view.plan.currency, finances))
                        VStack(alignment: .leading, spacing: 2) {
                            (Text(verbatim: figure.whole).font(.largeTitle.weight(.semibold))
                                + Text(verbatim: figure.cents).font(.title2.weight(.semibold)).foregroundColor(Theme.secondaryInk))
                                .monospacedDigit()
                                .foregroundStyle(Theme.ink)
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                            Text("This month")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.secondaryInk)
                        }
                        Spacer(minLength: 8)
                        if shown, let difference = pace.difference, abs(difference) >= 0.5 {
                            chip(difference, pace)
                        }
                    }
                    if shown {
                        chart(pace)
                            .frame(height: 120)
                            .padding(.top, 4)
                    }
                }
                .padding(16)
                .card()
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableButtonStyle())
        }
    }

    /// "↑ $177 more" in red or "↓ $212 less" in green, "vs Oct" under it: last month by the same day.
    private func chip(_ difference: Double, _ pace: SpendingPace) -> some View {
        let more = difference > 0
        let amount = amountText(abs(difference), view.plan.currency, finances, whole: true)
        let lastMonth = Calendar.current.date(byAdding: .month, value: -1, to: pace.month)?.formatted(.dateTime.month(.abbreviated)) ?? "last month"
        return VStack(alignment: .trailing, spacing: 2) {
            Label("\(amount) \(more ? "more" : "less")", systemImage: more ? "arrow.up.right" : "arrow.down.right")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(more ? Theme.danger : Theme.success)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background((more ? Theme.danger : Theme.success).opacity(0.12), in: Capsule())
            Text(verbatim: "vs \(lastMonth)")
                .font(.caption)
                .foregroundStyle(Theme.secondaryInk)
        }
        .accessibilityElement(children: .combine)
    }

    private func chart(_ pace: SpendingPace) -> some View {
        Chart {
            ForEach(pace.lastMonth) { p in
                LineMark(x: .value("Day", p.day), y: .value("Spent", p.total), series: .value("Month", "Last month"))
                    .foregroundStyle(Theme.secondaryInk.opacity(0.55))
                    .lineStyle(StrokeStyle(lineWidth: 2, dash: [4, 4]))
            }
            ForEach(pace.thisMonth) { p in
                AreaMark(x: .value("Day", p.day), y: .value("Spent", p.total))
                    .foregroundStyle(LinearGradient(colors: [Theme.accent.opacity(0.22), Theme.accent.opacity(0.02)], startPoint: .top, endPoint: .bottom))
                LineMark(x: .value("Day", p.day), y: .value("Spent", p.total), series: .value("Month", "This month"))
                    .foregroundStyle(Theme.accent)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
            }
            if let today = pace.thisMonth.last {
                PointMark(x: .value("Day", today.day), y: .value("Spent", today.total))
                    .foregroundStyle(Theme.accent)
                    .symbolSize(60)
            }
        }
        .chartXScale(domain: 1...pace.daysInMonth)
        .chartXAxis {
            AxisMarks(values: [1, 15, pace.daysInMonth]) { value in
                AxisValueLabel {
                    if let d = value.as(Int.self) {
                        Text(verbatim: d == 1 ? pace.month.formatted(.dateTime.month(.abbreviated).day()) : "\(d)")
                    }
                }
            }
        }
        .chartYAxis(.hidden)
        .accessibilityElement()
        .accessibilityLabel("Spending each day this month, against last month's")
    }
}

/// This paycheck's bills: what's still to come out of checking before payday,
/// with what's left to pay and how long until each, and what's been paid since the last payday, ticked.
/// Upcoming's heading opens Calendar; each row shows how often it comes.
private struct PaycheckBillsCards: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        if let bills = PaycheckBills.make(view, transactions: finances.countedTransactions, named: { view.paymentTitle($0) != nil }) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text("This paycheck")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    Text(verbatim: PaySpans.words(bills.days))
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
                .padding(.horizontal, 4)
                if !bills.upcoming.isEmpty {
                    group(title: "Upcoming", note: "\(amountText(bills.leftToPay, view.plan.currency, finances)) left to pay", link: true,
                          rows: Array(bills.upcoming.prefix(5)), paid: false)
                }
                if !bills.paid.isEmpty {
                    group(title: "Paid", note: "\(bills.paid.count) of \(bills.paid.count + bills.upcoming.count)", link: false,
                          rows: Array(bills.paid.prefix(5)), paid: true)
                }
            }
        }
    }

    private func group(title: LocalizedStringKey, note: String, link: Bool, rows: [PaycheckBills.Bill], paid: Bool) -> some View {
        VStack(spacing: 0) {
            NavigationLink {
                FinanceCalendarView(finances: finances)
            } label: {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.headline).foregroundStyle(Theme.ink)
                        Text(verbatim: note).font(.subheadline).foregroundStyle(Theme.secondaryInk)
                    }
                    Spacer()
                    if link { OpenButton(label: "Calendar") }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!link)
            ForEach(rows) { bill in
                Divider().overlay(Theme.separator)
                row(bill, paid: paid)
            }
        }
        .card()
    }

    private func row(_ bill: PaycheckBills.Bill, paid: Bool) -> some View {
        let payment = view.payment(bill.payment)
        return HStack(spacing: 12) {
            if let payment { LogoCircle(payment: payment, size: 38) }
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: view.paymentTitle(bill.payment) ?? "Payment")
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                if let words = payment?.schedule?.words {
                    Text(verbatim: words).font(.footnote).foregroundStyle(Theme.secondaryInk)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 1) {
                HStack(spacing: 6) {
                    if paid {
                        Image(systemName: "checkmark")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.success)
                            .frame(width: 18, height: 18)
                            .background(Theme.success.opacity(0.14), in: Circle())
                            .accessibilityLabel("Paid")
                    }
                    Text(verbatim: amountText(bill.amount, view.plan.currency, finances))
                        .font(.body.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                }
                Text(verbatim: paid ? (bill.date?.formatted(.dateTime.month(.abbreviated).day()) ?? "")
                                    : PaycheckBills.until(bill.date, today: view.today ?? Date()))
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }
}

/// The budgets worth a look, as the redesign's Budgets card: three at most
/// (`BudgetsGlance`), each with its mark, what's left or how far over, and its
/// bar (green, amber ahead of an even pace, red over). All opens Budgets,
/// where what's left to spend in all is at the top. No budgets, no card.
private struct BudgetsCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        let shown = BudgetsGlance.top(view.budgets)
        if !shown.isEmpty {
            NavigationLink {
                FinanceBudgetsPage(finances: finances)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    CardHeading(title: "Budgets", icon: "chart.pie") { OpenButton(label: "Budgets") }
                        .padding(.bottom, 6)
                    ForEach(Array(shown.enumerated()), id: \.element.id) { i, budget in
                        if i > 0 { Divider().padding(.leading, 40) }
                        row(budget)
                    }
                }
                .padding(16)
                .card()
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableButtonStyle())
        }
    }

    private func row(_ budget: FinanceBudget) -> some View {
        let tint = budget.isOver ? Theme.danger : budget.isAhead ? Theme.warning : Theme.success
        return VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 10) {
                LogoCircle(category: budget.category, categories: view.categories, size: 28)
                Text(verbatim: budget.category)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text(verbatim: "\(amountText(abs(budget.left), view.plan.currency, finances, whole: true)) \(budget.isOver ? "over" : "left")")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(budget.isOver ? Theme.danger : budget.isAhead ? Theme.warning : Theme.secondaryInk)
            }
            ProgressView(value: budget.share)
                .tint(tint)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}

/// The rest of Finances, a row each, as Settings lists its parts.
private struct MoreFinancesCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        VStack(spacing: 0) {
            row { MonthReviewPage(finances: finances) } label: {
                IconTileLabel(title: "Month in Review", systemImage: "sparkles.rectangle.stack.fill", tint: Color(light: 0xD9467A, dark: 0xF472B6))
            }
            row { FinanceSpendingPage(finances: finances) } label: {
                IconTileLabel(title: "Spending", systemImage: "chart.pie.fill", tint: Color(light: 0x0F9D8A, dark: 0x2EC4B0))
            }
            row { FinanceCashFlowPage(finances: finances) } label: {
                IconTileLabel(title: "Cash Flow", systemImage: "chart.bar.fill", tint: Color(light: 0x2563EB, dark: 0x60A5FA))
            }
            if !view.budgets.isEmpty {
                row { FinanceBudgetsPage(finances: finances) } label: {
                    IconTileLabel(title: "Budgets", systemImage: "gauge.with.dots.needle.67percent", tint: Color(light: 0xC2410C, dark: 0xF07B3F))
                }
            }
            if !view.periods.isEmpty || !view.since.isEmpty {
                row { FinanceBillsPage(finances: finances) } label: {
                    IconTileLabel(title: "Bills", systemImage: "calendar", tint: Theme.danger)
                }
            }
            if !view.periods.isEmpty || !view.since.isEmpty {
                row { FinanceCalendarView(finances: finances) } label: {
                    IconTileLabel(title: "Calendar", systemImage: "calendar.day.timeline.left", tint: Color(light: 0x0E7490, dark: 0x22D3EE))
                }
            }
            if !view.plan.people.isEmpty {
                row { FinancePaychecksPage(finances: finances) } label: {
                    IconTileLabel(title: "Paychecks", systemImage: "banknote.fill", tint: Theme.success)
                }
            }
            if !view.recurring.isEmpty {
                row { FinanceRecurringPage(finances: finances) } label: {
                    IconTileLabel(title: "Recurring", systemImage: "repeat", tint: Color(light: 0x7C3AED, dark: 0xA78BFA)) {
                        Text(verbatim: "≈ \(amountText(view.recurringPerMonth, view.plan.currency, finances, whole: true))/mo")
                            .monospacedDigit()
                    }
                }
            }
            if view.investments != nil || finances.canEdit {
                row { FinanceInvestmentsPage(finances: finances) } label: {
                    IconTileLabel(title: "Investments", systemImage: "chart.line.uptrend.xyaxis", tint: Theme.success) {
                        if let investments = view.investments {
                            Text(verbatim: amountText(investments.total, view.plan.currency, finances, whole: true))
                                .monospacedDigit()
                        }
                    }
                }
            }
            // The Collection: the household's cards, worth what they are
            // (finance.Collected); a phone allowed to change Finances adds the first.
            if !view.plan.collection.isEmpty || finances.canEdit {
                row { FinanceCollectionPage(finances: finances) } label: {
                    IconTileLabel(title: "Collection", systemImage: "rectangle.stack.fill", tint: Color(light: 0xB45309, dark: 0xF59E0B)) {
                        Text(verbatim: amountText(view.plan.collection.reduce(0) { $0 + $1.worth }, view.plan.currency, finances, whole: true))
                            .monospacedDigit()
                    }
                }
            }
            row { FinanceAccountsPage(finances: finances) } label: {
                IconTileLabel(title: "Accounts", systemImage: "building.columns.fill", tint: Theme.info) {
                    Text("\(view.plan.accounts.count)")
                }
            }
            if !view.goals.isEmpty {
                row { FinanceGoalsPage(finances: finances) } label: {
                    IconTileLabel(title: "Goals", systemImage: "flag.fill", tint: Color(light: 0x0F766E, dark: 0x14B8A6)) {
                        Text("\(view.goals.count)")
                    }
                }
            }
            if !view.loans.isEmpty {
                row { FinanceLoansPage(finances: finances) } label: {
                    IconTileLabel(title: "Loans", systemImage: "arrow.uturn.backward", tint: Color(light: 0x6E6E73, dark: 0x8E8E93)) {
                        Text("\(view.loans.count)")
                    }
                }
            }
        }
        .padding(.vertical, 6)
        .card()
    }

    private func row<Destination: View, Label: View>(@ViewBuilder _ destination: @escaping () -> Destination, @ViewBuilder label: () -> Label) -> some View {
        NavigationLink(destination: destination) {
            HStack(spacing: 8) {
                label()
                Image(systemName: "chevron.right").accessibilityHidden(true)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Pages

/// Budgets: each this month or pay period, tap one to change its amount.
private struct FinanceBudgetsPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var editingBudget: FinanceBudget?
    @State private var removing: FinanceBudget?
    @State private var adding = false

    var body: some View {
        Form {
            if let view = finances.plan {
                let total = BudgetsTotal(view.budgets, today: view.today)
                // This month, every account, moves between them left out: on Budgets, as on the computer.
                if let ledger = finances.ledger, !ledger.transactions.isEmpty {
                    Section {
                        ThisMonthCard(month: ThisMonth.make(ledger.transactions, today: view.today ?? Date()), finances: finances)
                    } header: {
                        Text("This Month")
                            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
                    }
                }
                if !view.budgets.isEmpty {
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(total.isOver ? "Over budget by" : "Left to spend")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(total.isOver ? Theme.danger : .secondary)
                            Money(value: abs(total.left), currency: view.plan.currency, finances: finances)
                                .font(.largeTitle.weight(.semibold))
                            BudgetBar(share: total.share, tint: total.isOver ? Theme.danger : Theme.accent)
                                .padding(.vertical, 2)
                            HStack(spacing: 4) {
                                Money(value: total.spent, currency: view.plan.currency, finances: finances)
                                Text("of")
                                Money(value: total.amount, currency: view.plan.currency, finances: finances)
                                Text("spent")
                                Spacer(minLength: 8)
                                if let perDay = total.perDay {
                                    Text("About")
                                    Money(value: perDay, currency: view.plan.currency, finances: finances)
                                    Text("a day")
                                }
                            }
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 6)
                        .accessibilityElement(children: .combine)
                    }
                }
                Section {
                    ForEach(view.budgets) { budget in
                        // As the computer's row: its transactions this month (a pay period's, every month).
                        NavigationLink {
                            TransactionsView(finances: finances, filter: budget.transactionsFilter())
                        } label: {
                            BudgetRow(budget: budget, view: view, finances: finances)
                        }
                        .swipeActions(edge: .trailing) {
                            if finances.canEditPlan {
                                Button(role: .destructive) { removing = budget } label: { Label("Remove", systemImage: "trash") }
                                Button {
                                    finances.clearSaveError()
                                    editingBudget = budget
                                } label: { Label("Change", systemImage: "pencil") }
                                    .tint(Theme.accent)
                            }
                        }
                        .contextMenu {
                            if finances.canEditPlan {
                                Button { finances.clearSaveError(); editingBudget = budget } label: { Label("Change Amount…", systemImage: "pencil") }
                                Button(role: .destructive) { removing = budget } label: { Label("Remove", systemImage: "trash") }
                            }
                        }
                    }
                    if view.budgets.isEmpty {
                        Text(finances.canEditPlan ? "No budgets yet: set how much a category may take a month or a pay period, and see what's left as you go."
                                                  : "No budgets yet.")
                            .foregroundStyle(Theme.secondaryInk)
                    }
                } footer: {
                    if !view.budgets.isEmpty {
                        Text(finances.canEditPlan
                             ? "The line on each bar is where an even pace would be today. Tap a budget for its transactions; swipe it to change the amount or remove it."
                             : "The line on each bar is where an even pace would be today. Tap a budget for its transactions.")
                    }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Budgets")
        .toolbar {
            if finances.canEditPlan {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        finances.clearSaveError()
                        adding = true
                    } label: { Label("Add a Budget", systemImage: "plus") }
                }
            }
        }
        .sheet(item: $editingBudget) { budget in
            AmountEditor(
                title: "Change Budget", heading: budget.category,
                footer: budget.per == "paycheck" ? "What it may take each pay period." : "What it may take each month.",
                finances: finances
            ) { amount in await finances.setBudget(budget, to: amount) }
        }
        .sheet(isPresented: $adding) {
            AddBudgetView(finances: finances)
        }
        .confirmationDialog(removing.map { "Remove the \($0.category) budget?" } ?? "", isPresented: Binding(
            get: { removing != nil }, set: { if !$0 { removing = nil } }
        ), titleVisibility: .visible, presenting: removing) { budget in
            Button("Remove", role: .destructive) { Task { _ = await finances.removeBudget(budget) } }
        } message: { _ in
            Text("Its transactions stay as they are; only the budget goes, on every device.")
        }
    }

}

/// One budget, as the computer's row: its category's mark, what's left (or
/// how far over) and what that allows a day, its period and what's spent of
/// it with what rolled over, and its bar with the line where an even pace is.
private struct BudgetRow: View {
    let budget: FinanceBudget
    let view: FinancesPlanView
    let finances: FinancesViewModel

    var body: some View {
        let tint = budget.isOver ? Theme.danger : budget.isAhead ? Theme.warning : Theme.success
        let currency = view.plan.currency
        HStack(alignment: .top, spacing: 12) {
            LogoCircle(category: budget.category, categories: view.categories, size: 36)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(verbatim: budget.category)
                        .font(.body.weight(.medium))
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 1) {
                        HStack(spacing: 3) {
                            Money(value: abs(budget.left), currency: currency, finances: finances)
                                .fontWeight(.semibold)
                            Text(budget.isOver ? "over" : "left")
                        }
                        .foregroundStyle(budget.isOver ? Theme.danger : budget.isAhead ? Theme.warning : Theme.ink)
                        if let day = budget.perDay(today: view.today) {
                            Text(verbatim: "\(amountText(day.amount, currency, finances)) \(day.days > 1 ? "a day" : "today")")
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryInk)
                        }
                    }
                }
                Text(verbatim: line(currency))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
                    .fixedSize(horizontal: false, vertical: true)
                BudgetBar(share: budget.share, tint: tint, pace: budget.paceShare)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityValue(budget.isOver ? "Over budget" : budget.isAhead ? "Ahead of an even pace" : "")
    }

    /// "This month, to Nov 30 · $412.00 of $600.00 (with $50.00 from last time)".
    private func line(_ currency: String) -> String {
        var words = "\(budget.periodWords) · \(amountText(budget.spent, currency, finances)) of \(amountText(budget.amount, currency, finances))"
        if abs(budget.rolled) >= 0.005 {
            words += " (\(budget.rolled > 0 ? "with" : "less") \(amountText(abs(budget.rolled), currency, finances)) from last time)"
        }
        return words
    }
}

/// Add a Budget (on the canvas's *Idea: Budgets*):
/// a category or a group, an amount, each month or each pay period, and
/// whether it rolls over, as the computer's Edit budgets adds one.
private struct AddBudgetView: View {
    let finances: FinancesViewModel
    @State private var category = ""
    @State private var text = ""
    @State private var perPaycheck = false
    @State private var rollover = false
    @Environment(\.dismiss) private var dismiss

    /// The plan's categories without a budget yet, A to Z.
    private var choices: [String] {
        let taken = Set((finances.plan?.budgets ?? []).map { $0.category.lowercased() })
        return (finances.plan?.categories ?? []).map(\.name)
            .filter { !taken.contains($0.lowercased()) }
            .sorted { $0.localizedLowercase < $1.localizedLowercase }
    }

    private var amount: Double? {
        guard let v = FinancePlanEdit.parseAmount(text), FinancePlanEdit.roundedToCents(v) > 0 else { return nil }
        return v
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Category", selection: $category) {
                        Text("Pick One").tag("")
                        ForEach(choices, id: \.self) { Text(verbatim: $0).tag($0) }
                    }
                } footer: {
                    Text("A budget for a group counts its own categories too (Food counts Groceries and Eating out).")
                }
                Section("Amount") {
                    TextField("Amount", text: $text)
                        #if os(iOS)
                        .keyboardType(.numbersAndPunctuation)
                        #endif
                        .font(.title2.monospacedDigit())
                        .privacySensitive()
                }
                Section {
                    Picker("Each", selection: $perPaycheck) {
                        Text("Month").tag(false)
                        Text("Pay Period").tag(true)
                    }
                    .pickerStyle(.segmented)
                    Toggle("Rolls Over", isOn: $rollover)
                } footer: {
                    Text(perPaycheck
                         ? "What's left at the end of a pay period goes on to the next one; spent over, the next one has less."
                         : "What's left at the end of a month goes on to the next one; spent over, the next one has less.")
                }
                if let error = finances.saveError {
                    Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.danger) }
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
            .navigationTitle("Add a Budget")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if finances.isSaving { ProgressView() } else { Button("Add", action: submit).disabled(category.isEmpty || amount == nil) }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 380, minHeight: 360)
        #endif
    }

    private func submit() {
        guard let amount, !category.isEmpty else { return }
        Task { if await finances.addBudget(category: category, amount: amount, perPaycheck: perPaycheck, rollover: rollover) { dismiss() } }
    }
}

/// A budget's bar: what's spent of it, rounded, on a soft track of its
/// colour; with `pace`, the line where an even pace would be today.
private struct BudgetBar: View {
    let share: Double
    let tint: Color
    var pace: Double? = nil

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(tint.opacity(0.16))
                Capsule().fill(tint)
                    .frame(width: max(8, geo.size.width * (share.isFinite ? min(max(share, 0), 1) : 0)))
                if let pace, pace.isFinite, pace > 0 {
                    Capsule()
                        .fill(Theme.ink)
                        .frame(width: 2, height: 14)
                        .offset(x: min(max(geo.size.width * pace - 1, 0), geo.size.width - 2))
                }
            }
        }
        .frame(height: 8)
        .animation(.spring(response: 0.5, dampingFraction: 0.85), value: share)
        .accessibilityHidden(true)
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
                ForEach(Array(view.periods.prefix(8).enumerated()), id: \.element.id) { index, period in
                    PeriodSection(period: period, index: index, view: view, finances: finances) { payment in
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
        .modifier(AddPaymentButton(finances: finances))
        // All of it, as the computer's form: not only what it costs.
        .sheet(item: $editingPayment) { payment in
            EditPaymentView(payment: payment, finances: finances)
        }
    }
}

/// New transactions to review, as a stack of cards: one at a time, its logo, amount
/// and payee, its other times at that payee one tap away, its category as chips (its own, its payee's, the most
/// used, and Other), and the day and account. Reviewed (or a swipe right) keeps the category picked and marks it;
/// Skip (or a swipe left) leaves it for later. The note and tags are on the transaction's page.
private struct ReviewInboxPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var skipped = Set<String>()
    /// The category picked on each card, by transaction id, until it's saved.
    @State private var picked: [String: String] = [:]
    @State private var categorizing: FinanceTransaction?
    @State private var drag: CGSize = .zero

    var body: some View {
        let all = (finances.ledger?.newestFirst ?? []).filter { finances.isNew($0) }
        let items = all.filter { !skipped.contains($0.id) }
        ScrollView {
            VStack(spacing: 22) {
                if let t = items.first {
                    ZStack(alignment: .bottom) {
                        // The ones behind it, as edges under the card.
                        if items.count > 2 { behind(inset: 24, drop: 20, opacity: 0.5) }
                        if items.count > 1 { behind(inset: 12, drop: 10, opacity: 0.8) }
                        card(t)
                            .offset(x: drag.width)
                            .rotationEffect(.degrees(Double(drag.width) / 24))
                            .gesture(DragGesture()
                                .onChanged { drag = $0.translation }
                                .onEnded { end in
                                    if end.translation.width > 110 { reviewed(t) } else if end.translation.width < -110 { skip(t) }
                                    withAnimation(.snappy) { drag = .zero }
                                })
                    }
                    .padding(.top, 8)
                    HStack(spacing: 10) {
                        Button { skip(t) } label: {
                            Text("Skip").frame(maxWidth: .infinity, minHeight: 50)
                        }
                        .buttonStyle(.plain)
                        .background(Theme.surface, in: Capsule())
                        .overlay(Capsule().strokeBorder(Theme.separator))
                        Button { reviewed(t) } label: {
                            Text("Reviewed").frame(maxWidth: .infinity, minHeight: 50)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.white)
                        .background(Theme.accentFill, in: Capsule())
                        .layoutPriority(1)
                    }
                    .font(.headline)
                } else if !skipped.isEmpty {
                    ContentUnavailableView {
                        Label("\(skipped.count) skipped", systemImage: "arrow.uturn.backward.circle")
                    } actions: {
                        Button("Go through them again") { withAnimation(.snappy) { skipped = [] } }
                    }
                    .padding(.top, 80)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
            .animation(.snappy, value: items.map(\.id))
        }
        .background(Theme.canvas.ignoresSafeArea())
        .overlay {
            if finances.ledger != nil, all.isEmpty {
                ContentUnavailableView("All Reviewed", systemImage: "checkmark.circle")
            } else if finances.ledger == nil {
                ProgressView()
            }
        }
        .navigationTitle(items.isEmpty ? "Review" : "\(items.count) left")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            if items.count > 1 {
                ToolbarItem(placement: .primaryAction) {
                    Button("All Reviewed") {
                        withAnimation(.snappy) { finances.markReviewed(items) }
                    }
                }
            }
        }
        .sheet(item: $categorizing) { t in
            CategoryPicker(transaction: t, finances: finances)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .task { if finances.ledger == nil { await finances.loadLedger() } }
    }

    private func behind(inset: CGFloat, drop: CGFloat, opacity: Double) -> some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Theme.separator))
            .frame(height: 40)
            .padding(.horizontal, inset)
            .offset(y: drop)
            .opacity(opacity)
    }

    private func card(_ t: FinanceTransaction) -> some View {
        let newestFirst = finances.ledger?.newestFirst ?? []
        let others = TransactionMatching.moreAt(t, in: newestFirst, limit: .max)
        let categories = finances.plan?.categories ?? []
        let choices = ReviewChoices.categories(for: t, others: others, all: newestFirst)
        let current = picked[t.id] ?? t.category
        let canChange = finances.canAddTransactions && LedgerEdit.canUpdate(t)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                LogoCircle(transaction: t, categories: categories, size: 52)
                Spacer()
                Money(value: t.amount, currency: finances.currency, finances: finances)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(t.amount > 0 ? Theme.success : Theme.ink)
            }
            Text(verbatim: TransactionDetailView.title(of: t, finances: finances))
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.ink)
                .padding(.top, 10)
            NavigationLink {
                TransactionDetailView(transaction: t, finances: finances)
            } label: {
                HStack(spacing: 3) {
                    Text(verbatim: others.isEmpty ? "Details" : "\(others.count + 1) transactions")
                    Image(systemName: "chevron.right").font(.caption.weight(.bold)).accessibilityHidden(true)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.accent)
            }
            .buttonStyle(.plain)
            .padding(.top, 3)
            if (t.to ?? "").isEmpty, !t.isSplit {
                label("Category")
                FlowChips {
                    ForEach(choices, id: \.self) { name in
                        chip(name, on: current.caseInsensitiveCompare(name) == .orderedSame, categories: categories) {
                            picked[t.id] = name
                        }
                        .disabled(!canChange)
                    }
                    if canChange {
                        Button {
                            finances.clearSaveError()
                            categorizing = t
                        } label: {
                            Label("Other", systemImage: "magnifyingglass")
                                .font(.subheadline.weight(.medium))
                                .padding(.horizontal, 11)
                                .frame(minHeight: 32)
                                .overlay(Capsule().strokeBorder(Theme.separator))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Theme.ink)
                    }
                }
            }
            label("Day")
            Text(verbatim: RowWords.line([t.date?.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()),
                                          finances.accountName(t.account)]))
                .font(.body)
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.separator))
        }
        .padding(18)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Theme.separator))
        .shadow(color: Design.shadow.opacity(0.07), radius: 14, y: 8)
    }

    private func label(_ words: LocalizedStringKey) -> some View {
        Text(words)
            .font(.caption.weight(.semibold))
            .textCase(.uppercase)
            .foregroundStyle(Theme.secondaryInk)
            .padding(.top, 16)
            .padding(.bottom, 8)
    }

    private func chip(_ name: String, on: Bool, categories: [FinanceCategory], pick: @escaping () -> Void) -> some View {
        let tint = Design.category(PayeeLogos.shared.categoryHue(name, in: categories))
        return Button(action: { withAnimation(.snappy) { pick() } }) {
            HStack(spacing: 6) {
                LogoCircle(category: name, categories: categories, size: 18)
                Text(verbatim: name)
            }
            .font(.subheadline.weight(on ? .semibold : .medium))
            .foregroundStyle(on ? (tint?.ink ?? Theme.accent) : Theme.ink)
            .padding(.horizontal, 11)
            .frame(minHeight: 32)
            .background(on ? (tint?.soft ?? Theme.accent.opacity(0.14)) : .clear, in: Capsule())
            .overlay(Capsule().strokeBorder(on ? .clear : Theme.separator))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func skip(_ t: FinanceTransaction) {
        withAnimation(.snappy) { _ = skipped.insert(t.id) }
    }

    private func reviewed(_ t: FinanceTransaction) {
        let category = picked[t.id]
        Task {
            if let category, category != t.category {
                guard await finances.setCategory(t, to: category) else { return }
            }
            withAnimation(.snappy) { finances.markReviewed([t]) }
        }
    }
}

/// Chips that wrap onto as many lines as they need.
private struct FlowChips: Layout {
    var spacing: CGFloat = 7

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width { y += line + spacing; x = 0; line = 0 }
            x += size.width + spacing
            line = max(line, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: min(widest, width), height: y + line)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, line: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX { y += line + spacing; x = bounds.minX; line = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            line = max(line, size.height)
        }
    }
}

/// A transaction's category, picked from the plan's own as buttons; the
/// transaction is marked reviewed when it's saved.
private struct CategoryPicker: View {
    /// One, or several selected together (one category for each).
    let transactions: [FinanceTransaction]
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss

    init(transaction: FinanceTransaction, finances: FinancesViewModel) {
        self.init(transactions: [transaction], finances: finances)
    }

    init(transactions: [FinanceTransaction], finances: FinancesViewModel) {
        self.transactions = transactions
        self.finances = finances
    }

    private var transaction: FinanceTransaction? { transactions.count == 1 ? transactions.first : nil }

    var body: some View {
        let categories = (finances.plan?.categories ?? []).filter { !($0.income ?? false) }
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let transaction {
                        HStack(spacing: 12) {
                            LogoCircle(transaction: transaction, categories: finances.plan?.categories ?? [], size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(verbatim: TransactionDetailView.title(of: transaction, finances: finances))
                                    .font(.headline)
                                Money(value: transaction.amount, currency: finances.currency, finances: finances)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    } else {
                        Text(verbatim: "\(transactions.count) transactions")
                            .font(.headline)
                    }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], alignment: .leading, spacing: 8) {
                        ForEach(categories) { c in
                            let picked = transaction.map { c.name.lowercased() == $0.category.lowercased() } ?? false
                            let tint = Design.category(PayeeLogos.shared.categoryHue(c.name, in: finances.plan?.categories ?? []))
                            Button {
                                Task {
                                    var saved = false
                                    if let transaction {
                                        saved = await finances.setCategory(transaction, to: c.name)
                                    } else {
                                        saved = await finances.setCategory(transactions, to: c.name)
                                    }
                                    if saved { dismiss() }
                                }
                            } label: {
                                HStack(spacing: 6) {
                                    Circle().fill(picked ? Color.white : (tint?.base ?? Theme.accent)).frame(width: 8, height: 8)
                                    Text(verbatim: c.name)
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.8)
                                }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(picked ? Color.white : (tint?.ink ?? Theme.accent))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 9)
                                .frame(maxWidth: .infinity)
                                .background(picked ? Theme.accentFill : (tint?.soft ?? Theme.accent.opacity(0.14)), in: Capsule())
                            }
                            .buttonStyle(PressableButtonStyle())
                            .disabled(finances.isSaving)
                        }
                    }
                    if let error = finances.saveError {
                        Label { Text(verbatim: error) } icon: { Image(systemName: "exclamationmark.triangle.fill") }
                            .font(.callout)
                            .foregroundStyle(Theme.danger)
                    }
                }
                .padding(20)
            }
            .navigationTitle("Category")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                if finances.isSaving {
                    ToolbarItem(placement: .primaryAction) { ProgressView() }
                }
            }
        }
    }
}

/// Spending, as Monarch shows it: a month's money out by category as a
/// ring, with how it compares with the month before; the last six months
/// as bars (tap one to see that month); and each category with its bar,
/// against its budget where it has one this month. A category opens its
/// transactions.
private struct FinanceSpendingPage: View {
    @Bindable var finances: FinancesViewModel
    @Environment(\.dynamicTypeSize) private var typeSize
    /// The month shown, its first day; nil for the plan's own month.
    @State private var picked: Date?

    var body: some View {
        ScrollView {
            if let view = finances.plan, finances.ledger != nil {
                let calendar = Calendar.current
                let thisMonth = calendar.dateInterval(of: .month, for: view.today ?? Date())?.start ?? Date()
                let month = picked ?? thisMonth
                let categories = view.categories
                let counted = finances.countedTransactions
                let spent = Spending.byCategory(counted, in: month, categories: categories)
                let months = Spending.months(counted, ending: thisMonth, count: 6, categories: categories)
                    .filter { FinanceLedger.tracked($0.month, from: view.plan.trackFrom) }
                let total = spent.reduce(0) { $0 + $1.spent }
                let before = calendar.date(byAdding: .month, value: -1, to: month).map {
                    Spending.byCategory(counted, in: $0, categories: categories).reduce(0) { $0 + $1.spent }
                }
                VStack(spacing: 18) {
                    ring(spent, total: total, before: before, month: month, view: view)
                    bars(months, month: month, view: view)
                    if !spent.isEmpty {
                        list(spent, month: month, isThisMonth: month == thisMonth, view: view)
                    }
                    Text("Moves between your own accounts and money coming in aren’t counted; a refund counts against its category.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryInk)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
                .animation(.smooth(duration: 0.35), value: month)
            } else if finances.ledgerError != nil {
                ContentUnavailableView("Couldn't Read the Transactions", systemImage: "chart.pie", description: Text(verbatim: finances.ledgerError ?? ""))
                    .padding(.top, 80)
            } else {
                SkeletonCards(walletCard: false).padding(.horizontal, 16)
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .task {
            if finances.plan == nil { await finances.loadPlan() }
            if finances.ledger == nil { await finances.loadLedger() }
        }
        .refreshable { await finances.loadLedger() }
        .navigationTitle("Spending")
        .sensoryFeedback(.selection, trigger: picked)
    }

    private func tint(_ name: String, _ index: Int, _ view: FinancesPlanView) -> Color {
        if name == Spending.uncategorized { return Color(light: 0x8E8E93, dark: 0x8E8E93) }
        let hue = PayeeLogos.shared.categoryHue(name, in: view.categories)
        return Design.category(hue > 0 ? hue : index % 8 + 1)?.base ?? Theme.accent
    }

    private func ring(_ spent: [SpendingCategory], total: Double, before: Double?, month: Date, view: FinancesPlanView) -> some View {
        (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16)) : AnyLayout(HStackLayout(spacing: 16))) {
            ZStack {
                if spent.isEmpty {
                    Circle().stroke(Theme.canvas, lineWidth: 18).padding(9)
                } else {
                    Chart(Array(spent.enumerated()), id: \.element.id) { i, c in
                        SectorMark(angle: .value("Spent", c.spent), innerRadius: .ratio(0.72), angularInset: 1.5)
                            .cornerRadius(3)
                            .foregroundStyle(tint(c.name, i, view))
                    }
                    .chartLegend(.hidden)
                }
                VStack(spacing: 1) {
                    Text(month, format: .dateTime.month(.wide))
                        .font(.caption2)
                        .foregroundStyle(Theme.secondaryInk)
                    Text(verbatim: amountText(total, view.plan.currency, finances, whole: true))
                        .font(.title3.weight(.heavy))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .contentTransition(.numericText())
                    if let before, before > 0, finances.amountsShown, !finances.amountsHiddenByPlan {
                        let change = total - before
                        // Against what: the month before, in the words the month's review uses ("+$1,021 on Sep"),
                        // not a bare red number.
                        let last = Calendar.current.date(byAdding: .month, value: -1, to: month) ?? month
                        Text(verbatim: "\(change > 0 ? "+" : "−")\(amountText(abs(change), view.plan.currency, finances, whole: true)) on \(last.formatted(.dateTime.month(.abbreviated)))")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(change > 0 ? Theme.danger : Theme.success)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                }
                // Inside the hole: its third line is where the hole is narrowest.
                .padding(.horizontal, 28)
            }
            .frame(width: 144, height: 144)
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .accessibilityElement(children: .combine)
            VStack(alignment: .leading, spacing: 8) {
                if spent.isEmpty {
                    Text("Nothing spent this month yet.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
                ForEach(Array(spent.prefix(5).enumerated()), id: \.element.id) { i, c in
                    HStack(spacing: 6) {
                        Circle().fill(tint(c.name, i, view)).frame(width: 9, height: 9)
                        // Shrinks rather than cuts a long name at the largest sizes ("Subscri…", large-spending).
                        Text(verbatim: c.name)
                            .font(.subheadline)
                            .foregroundStyle(Theme.ink)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                        Spacer(minLength: 4)
                        Text(c.spent / max(total, 0.01), format: .percent.precision(.fractionLength(0)))
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(Theme.secondaryInk)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func bars(_ months: [SpendingMonth], month: Date, view: FinancesPlanView) -> some View {
        let shown = months.filter { $0.total > 0 }
        let average = shown.isEmpty ? 0 : shown.reduce(0) { $0 + $1.total } / Double(shown.count)
        return VStack(alignment: .leading, spacing: 12) {
            // The average under the heading at the largest text sizes: side by side, both were cut
            // ("Each" and "About…", large-spending).
            (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
                                          : AnyLayout(HStackLayout(alignment: .firstTextBaseline))) {
                CardHeading("Each Month")
                if !typeSize.isAccessibilitySize { Spacer() }
                if average > 0 {
                    Text(verbatim: "About \(amountText(average, view.plan.currency, finances, whole: true)) a month")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            HStack(alignment: .bottom, spacing: 10) {
                let high = max(months.map(\.total).max() ?? 0, 1)
                ForEach(months) { m in
                    let isPicked = m.month == month
                    Button {
                        withAnimation(.snappy) { picked = m.month }
                    } label: {
                        VStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .fill(isPicked ? Theme.accent : Theme.accent.opacity(0.22))
                                .frame(height: max(6, 96 * m.total / high))
                                .frame(maxWidth: 30)
                            Text(m.month, format: .dateTime.month(.abbreviated))
                                .font(.caption2.weight(isPicked ? .bold : .regular))
                                .foregroundStyle(isPicked ? Theme.ink : Theme.secondaryInk)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PressableButtonStyle())
                    .accessibilityLabel(Text(verbatim: "\(m.month.formatted(.dateTime.month(.wide))): \(amountText(m.total, view.plan.currency, finances, whole: true))"))
                    .accessibilityAddTraits(isPicked ? .isSelected : [])
                }
            }
            .frame(height: 122)
        }
        .padding(16)
        .card()
    }

    private func list(_ spent: [SpendingCategory], month: Date, isThisMonth: Bool, view: FinancesPlanView) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(spent.enumerated()), id: \.element.id) { i, c in
                if i > 0 { Divider().padding(.leading, 64) }
                let budget = isThisMonth ? view.budgets.first { $0.category.lowercased() == c.name.lowercased() } : nil
                let color = tint(c.name, i, view)
                NavigationLink {
                    SpendingCategoryPage(name: c.name, month: month, finances: finances)
                } label: {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(color.opacity(0.16))
                            .frame(width: 38, height: 38)
                            .overlay(Circle().fill(color).frame(width: 12, height: 12))
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(verbatim: c.name)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(Theme.ink)
                                    .lineLimit(1)
                                Spacer(minLength: 8)
                                Text(verbatim: amountText(c.spent, view.plan.currency, finances))
                                    .font(.body.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.ink)
                            }
                            if let budget, budget.amount > 0 {
                                BudgetBar(share: c.spent / budget.amount, tint: c.spent > budget.amount ? Theme.danger : color)
                                Text(verbatim: c.spent > budget.amount
                                     ? "Over by \(amountText(c.spent - budget.amount, view.plan.currency, finances, whole: true))"
                                     : "\(amountText(budget.amount - c.spent, view.plan.currency, finances, whole: true)) left of \(amountText(budget.amount, view.plan.currency, finances, whole: true))")
                                    .font(.caption)
                                    .foregroundStyle(c.spent > budget.amount ? Theme.danger : Theme.secondaryInk)
                            } else {
                                BudgetBar(share: c.spent / max(spent.first?.spent ?? 1, 0.01), tint: color)
                            }
                        }
                        Image(systemName: "chevron.right").accessibilityHidden(true)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
        .card()
    }
}

/// One category's transactions in a month, newest first, as Wallet lists them.
private struct SpendingCategoryPage: View {
    let name: String
    let month: Date
    let finances: FinancesViewModel
    @Namespace private var zoom

    var body: some View {
        let categories = finances.plan?.categories ?? []
        let items = Spending.transactions(finances.countedTransactions, in: name, month: month, categories: categories)
        List {
            Section {
                ForEach(items) { t in
                    NavigationLink {
                        TransactionDetailView(transaction: t, finances: finances)
                            .zoomTransition(id: t.id, in: zoom)
                    } label: {
                        WalletTransactionRow(transaction: t, finances: finances, isNew: finances.isNew(t))
                            .zoomSource(id: t.id, in: zoom)
                    }
                }
            } header: {
                Text(month, format: .dateTime.month(.wide).year())
            }
        }
        .themedCanvas()
        .navigationTitle(Text(verbatim: name))
        .overlay {
            if items.isEmpty { ContentUnavailableView("Nothing Here", systemImage: "tray") }
        }
    }
}

/// Recurring: every payment that repeats, as Monarch lists them: about
/// what the bills and subscriptions cost a month, then money coming in,
/// subscriptions, bills, card payments, and savings, each with its logo,
/// how often it comes, when next, and what it costs. Tap one to change
/// what it costs.
private struct FinanceRecurringPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var editing: FinancePayment?

    var body: some View {
        ScrollView {
            if let view = finances.plan {
                let items = view.recurring
                VStack(spacing: 18) {
                    summary(view, items)
                    if !view.recurringCalendar(in: view.today ?? Date()).isEmpty {
                        RecurringCalendarCard(view: view, finances: finances)
                    }
                    ForEach(RecurringItem.Sort.allCases, id: \.self) { sort in
                        let rows = items.filter { $0.sort == sort }
                        if !rows.isEmpty { group(sort, rows, view) }
                    }
                    if items.isEmpty {
                        Text("Nothing repeats yet.")
                            .foregroundStyle(Theme.secondaryInk)
                            .padding(18)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card()
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Recurring")
        .modifier(AddPaymentButton(finances: finances))
        .sheet(item: $editing) { payment in
            EditPaymentView(payment: payment, finances: finances)
        }
    }

    /// About what they cost a month, and how many there are of each sort.
    private func summary(_ view: FinancesPlanView, _ items: [RecurringItem]) -> some View {
        let subscriptions = items.filter { $0.sort == .subscriptions }
        let subsMonthly = subscriptions.reduce(0) { $0 + ($1.monthly ?? 0) }
        return VStack(alignment: .leading, spacing: 8) {
            Text("Bills and subscriptions, a month")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.secondaryInk)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(verbatim: "≈").foregroundStyle(Theme.secondaryInk)
                Text(verbatim: amountText(view.recurringPerMonth, view.plan.currency, finances, whole: true))
                    .font(.largeTitle.weight(.semibold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
            }
            HStack(spacing: 8) {
                chip("\(items.filter { $0.sort == .bills }.count) bills", Theme.danger)
                if !subscriptions.isEmpty {
                    chip("\(subscriptions.count) subscriptions · \(amountText(subsMonthly, view.plan.currency, finances, whole: true))/mo", Theme.accent)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func chip(_ words: String, _ tint: Color) -> some View {
        Text(verbatim: words)
            .font(.caption.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(tint.opacity(0.12), in: Capsule())
    }

    private func group(_ sort: RecurringItem.Sort, _ rows: [RecurringItem], _ view: FinancesPlanView) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: sort.title)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                let monthly = rows.reduce(0) { $0 + ($1.monthly ?? 0) }
                if monthly > 0 {
                    Text(verbatim: "≈ \(amountText(monthly, view.plan.currency, finances, whole: true))/mo")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .padding(.bottom, 6)
            ForEach(Array(rows.enumerated()), id: \.element.id) { i, item in
                if i > 0 { Divider().padding(.leading, 54) }
                // One of the plan's own payments; a card's payoff is changed on its account.
                if finances.canEditPlan, view.plan.payments.contains(where: { $0.id == item.payment.id }) {
                    Button {
                        finances.clearSaveError()
                        editing = item.payment
                    } label: {
                        row(item, view)
                    }
                    .buttonStyle(PressableButtonStyle())
                    .accessibilityHint("Change it")
                } else {
                    row(item, view)
                }
            }
        }
        .padding(16)
        .card()
    }

    private func row(_ item: RecurringItem, _ view: FinancesPlanView) -> some View {
        let p = item.payment
        let into = item.sort == .moneyIn
        return HStack(spacing: 12) {
            LogoCircle(payment: p, size: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: p.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Text(verbatim: [p.schedule?.words, p.schedule?.endWords(today: view.todayText), into ? p.payer.map { "from \($0)" } : nil]
                    .compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                if !(p.card ?? "").isEmpty {
                    Text("The whole balance")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                } else if let amount = p.amount {
                    HStack(spacing: 2) {
                        if p.estimate == true { Text(verbatim: "≈").foregroundStyle(Theme.secondaryInk).accessibilityLabel("About") }
                        Text(verbatim: (into ? "+" : "") + amountText(amount, view.plan.currency, finances))
                            .monospacedDigit()
                            .foregroundStyle(into ? Theme.success : Theme.ink)
                    }
                    .font(.body.weight(.semibold))
                }
                // When it comes next, under its amount.
                if let next = item.next, let today = view.today {
                    Text(verbatim: PaycheckBills.due(next, today: today))
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

}

/// Investments, as Ghostfolio last read them; where Finances may be
/// changed, Read Now reads Ghostfolio again and Add a Holding records a
/// buy or a sale there.
private struct FinanceInvestmentsPage: View {
    @Bindable var finances: FinancesViewModel
    @State private var adding = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                if let view = finances.plan, let investments = view.investments {
                    InvestmentsHero(investments: investments, view: view, finances: finances) {
                        if finances.canEdit { actions }
                    }
                    readNote
                    // No bar of each holding's share; the holdings separate, and a Watchlist.
                    HoldingsCard(investments: investments, view: view, finances: finances)
                    WatchlistCard(view: view, finances: finances)
                    Text(Self.readWhen(view).map { "From Ghostfolio, \($0)." } ?? "From Ghostfolio.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryInk)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                } else if finances.plan != nil {
                    VStack(alignment: .leading, spacing: 14) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(Theme.accent)
                        Text("Read what each of your investment accounts holds from Ghostfolio, the investment tracker on your homelab: each fund and share, what went in, and what it's worth now. Only ticker symbols leave the homelab, when Ghostfolio looks prices up.")
                            .foregroundStyle(Theme.secondaryInk)
                        if finances.canEdit { actions }
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                    readNote
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
        }
        .background(Theme.canvas.ignoresSafeArea())
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Investments")
        .sheet(isPresented: $adding) {
            AddHoldingView(finances: finances)
        }
    }

    /// Read Now and Add a Holding, as two capsules.
    private var actions: some View {
        HStack(spacing: 10) {
            Button {
                Task { await finances.readInvestments() }
            } label: {
                HStack(spacing: 6) {
                    if finances.isReadingInvestments {
                        ProgressView().controlSize(.small).tint(.white)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                    Text(finances.isReadingInvestments ? "Reading…" : "Read Now")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
                .background(Theme.accentFill, in: Capsule())
            }
            .buttonStyle(PressableButtonStyle())
            Button {
                adding = true
            } label: {
                Label("Add a Holding", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .background(Theme.accent.opacity(0.14), in: Capsule())
            }
            .buttonStyle(PressableButtonStyle())
        }
        .disabled(finances.isReadingInvestments || finances.isSaving)
    }

    /// What the last read said, a problem, or Ghostfolio's accounts matched to none here.
    @ViewBuilder
    private var readNote: some View {
        if finances.investmentsSaid != nil || finances.investmentsProblem != nil || !finances.investmentsUnmatched.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                if let said = finances.investmentsSaid {
                    Label { Text(verbatim: said) } icon: { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.success) }
                }
                if let problem = finances.investmentsProblem {
                    Label { Text(verbatim: problem) } icon: { Image(systemName: "exclamationmark.triangle.fill") }
                        .foregroundStyle(Theme.danger)
                }
                if !finances.investmentsUnmatched.isEmpty {
                    Text(verbatim: "In Ghostfolio but matched to no account here: \(finances.investmentsUnmatched.joined(separator: ", ")). Name an account here the same, or pick its Ghostfolio account on the computer.")
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .font(.callout)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card(radius: 18)
        }
    }

    /// "read 7:02 AM today", "read yesterday at 7:02 AM", "read Nov 2".
    static func readWhen(_ view: FinancesPlanView) -> String? {
        guard let at = view.plan.holdingsRead else { return nil }
        let calendar = Calendar.current
        let time = at.formatted(date: .omitted, time: .shortened)
        if calendar.isDateInToday(at) { return "read \(time) today" }
        if calendar.isDateInYesterday(at) { return "read yesterday at \(time)" }
        return "read \(at.formatted(.dateTime.month(.abbreviated).day()))"
    }
}

/// A line over time with a finger to read a day, and a range to pick:
/// net worth's and the investments'.
struct TrendChart: View {
    let series: [NetWorthPoint]
    @Binding var picked: Date?

    var body: some View {
        let values = series.map(\.value)
        let low = values.min() ?? 0
        let high = values.max() ?? 0
        let pad = max((high - low) * 0.15, abs(high) * 0.01, 1)
        let up = (series.last?.value ?? 0) >= (series.first?.value ?? 0)
        let tint = up ? Theme.accent : Theme.danger
        let point = TrendChart.point(in: series, at: picked)
        let kept = series.filter { !$0.estimated }
        // Worked back before the first balance (Track from): dashed, unfilled, meeting the kept line.
        let back = series.filter(\.estimated) + (kept.first.map { [$0] } ?? [])
        Chart {
            ForEach(kept, id: \.date) { p in
                AreaMark(x: .value("Day", p.date), yStart: .value("Low", low), yEnd: .value("Value", p.value))
                    .foregroundStyle(LinearGradient(colors: [tint.opacity(0.22), tint.opacity(0)], startPoint: .top, endPoint: .bottom))
                    .interpolationMethod(.monotone)
                LineMark(x: .value("Day", p.date), y: .value("Value", p.value), series: .value("Part", "kept"))
                    .foregroundStyle(tint)
                    .lineStyle(StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.monotone)
            }
            if back.count > 1 {
                ForEach(back, id: \.date) { p in
                    LineMark(x: .value("Day", p.date), y: .value("Value", p.value), series: .value("Part", "worked back"))
                        .foregroundStyle(tint.opacity(0.7))
                        .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, dash: [4, 4]))
                        .interpolationMethod(.monotone)
                }
            }
            if let point {
                RuleMark(x: .value("Day", point.date))
                    .foregroundStyle(Theme.secondaryInk.opacity(0.35))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                PointMark(x: .value("Day", point.date), y: .value("Value", point.value))
                    .foregroundStyle(tint)
                    .symbolSize(70)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: (low - pad)...(high + pad))
        .chartXSelection(value: $picked)
        .sensoryFeedback(.selection, trigger: point?.date)
    }

    /// The day nearest a finger, or nil.
    static func point(in series: [NetWorthPoint], at day: Date?) -> NetWorthPoint? {
        day.flatMap { day in series.min { abs($0.date.timeIntervalSince(day)) < abs($1.date.timeIntervalSince(day)) } }
    }
}

/// 1M, 3M, 1Y as a capsule switch that slides.
private struct RangePicker: View {
    @Binding var range: NetWorthRange
    @Namespace private var pill

    var body: some View {
        HStack(spacing: 4) {
            ForEach(NetWorthRange.allCases) { r in
                Button {
                    withAnimation(.snappy) { range = r }
                } label: {
                    Text(verbatim: r.label)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(range == r ? Theme.ink : Theme.secondaryInk)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background {
                            if range == r {
                                Capsule()
                                    .fill(Theme.surface)
                                    .shadow(color: Design.shadow.opacity(0.12), radius: 3, y: 1)
                                    .matchedGeometryEffect(id: "range", in: pill)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(range == r ? .isSelected : [])
            }
        }
        .padding(3)
        .background(Theme.canvas, in: Capsule())
        .sensoryFeedback(.selection, trigger: range)
    }
}

/// What the investments are worth, their gain, and their line over time.
private struct InvestmentsHero<Actions: View>: View {
    let investments: FinanceInvestments
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @ViewBuilder var actions: () -> Actions
    @State private var range: NetWorthRange = .threeMonths
    @State private var picked: Date?

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        let series = view.worthSeries(days: range.rawValue, of: investments.accounts.map(\.account))
        let point = TrendChart.point(in: series, at: picked)
        VStack(alignment: .leading, spacing: 6) {
            Text(point.map { $0.date.formatted(.dateTime.month(.abbreviated).day().year()) }
                 ?? "\(investments.holdingCount) \(investments.holdingCount == 1 ? "holding" : "holdings") in \(investments.accounts.count) \(investments.accounts.count == 1 ? "account" : "accounts")")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.secondaryInk)
            Text(verbatim: amountText(point?.value ?? investments.total, view.plan.currency, finances))
                .font(.largeTitle.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(shown ? Theme.ink : Theme.secondaryInk)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if shown, point == nil {
                // Side by side when they fit, else one under the other.
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) {
                        gainPill(investments.gain, of: investments.paid, words: "all time")
                        gainPill(investments.month, of: investments.total - investments.month, words: "this month")
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        gainPill(investments.gain, of: investments.paid, words: "all time")
                        gainPill(investments.month, of: investments.total - investments.month, words: "this month")
                    }
                }
            }
            if shown, series.count >= 2 {
                TrendChart(series: series, picked: $picked)
                    .frame(height: 130)
                    .padding(.horizontal, -12)
                    .padding(.top, 8)
                RangePicker(range: $range)
                    .padding(.top, 4)
            }
            actions()
                .padding(.top, 10)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
        .animation(.smooth(duration: 0.35), value: range)
    }

    private func gainPill(_ value: Double, of base: Double, words: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: value >= 0 ? "arrow.up.right" : "arrow.down.right")
                .font(.caption2.weight(.bold))
            Text(verbatim: [amountText(abs(value), view.plan.currency, finances, whole: true), FinanceInvestments.share(value, of: base)]
                .compactMap { $0 }.joined(separator: " · "))
                .lineLimit(1)
            Text(verbatim: words).fontWeight(.regular).opacity(0.75)
                .lineLimit(1)
        }
        .fixedSize()
        .font(.caption.weight(.semibold))
        .foregroundStyle(value < 0 ? Theme.danger : Theme.success)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background((value < 0 ? Theme.danger : Theme.success).opacity(0.12), in: Capsule())
    }
}

/// Each holding: a ticker badge in its colour, what it is and where, its
/// worth and its gain.
private struct HoldingsCard: View {
    let investments: FinanceInvestments
    let view: FinancesPlanView
    let finances: FinancesViewModel

    private var shown: Bool { finances.amountsShown && !finances.amountsHiddenByPlan }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            CardHeading("Holdings")
                .padding(.bottom, 6)
            ForEach(Array(investments.lines.enumerated()), id: \.offset) { i, line in
                if i > 0 { Divider().padding(.leading, 56) }
                if let holding = line.holding {
                    NavigationLink {
                        HoldingView(holding: holding, account: line.account, view: view, finances: finances)
                    } label: {
                        row(line)
                    }
                    .buttonStyle(.plain)
                } else {
                    row(line)
                }
            }
        }
        .padding(16)
        .card()
    }

    private func currency(_ account: FinanceAccount) -> String {
        if let code = account.currency, !code.isEmpty { return code }
        return view.plan.currency
    }

    private func row(_ line: FinanceInvestments.Line) -> some View {
        HStack(spacing: 12) {
            TickerBadge(symbol: line.holding?.symbol ?? "$")
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: line.holding?.symbol ?? "Cash")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                // Two lines, so a long fund's name doesn't cut off the account it's in
                // ("Vanguard Total International Stock ETF · Fidelity 40…").
                Text(verbatim: line.holding.map { "\($0.title) · \(line.account.name)" } ?? "Not in a holding · \(line.account.name)")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(2)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Money(value: line.holding?.value ?? line.cash, currency: currency(line.account), finances: finances)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                if let holding = line.holding, shown {
                    Text(verbatim: FinanceInvestments.share(holding.gain, of: holding.paid) ?? amountText(holding.gain, currency(line.account), finances, whole: true))
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(holding.gain < 0 ? Theme.danger : Theme.success)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background((holding.gain < 0 ? Theme.danger : Theme.success).opacity(0.12), in: Capsule())
                }
            }
            if line.holding != nil {
                Image(systemName: "chevron.right").accessibilityHidden(true)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// A ticker in a rounded square of a colour its letters pick, as a broker's app shows one.
private struct TickerBadge: View {
    let symbol: String

    var body: some View {
        let letters = String(symbol.prefix(symbol.count <= 4 ? 4 : 3)).uppercased()
        let hue = symbol.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xFFFF }
        let tint = Design.category(hue % 8 + 1)
        Text(verbatim: letters)
            .font(.system(size: letters.count >= 4 ? 11 : 13, weight: .heavy, design: .rounded))
            .foregroundStyle(tint?.ink ?? Theme.accent)
            .minimumScaleFactor(0.6)
            .lineLimit(1)
            .frame(width: 42, height: 42)
            .background(tint?.soft ?? Theme.accent.opacity(0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// Add a holding: a buy or a sale, in which account (or a new one, made in
/// Ghostfolio and the plan by one name), of what Ghostfolio finds for a
/// ticker or a name, how many shares, for how much, and on what day.
private struct AddHoldingView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var sold = false
    @State private var account = ""
    @State private var newName = ""
    @State private var query = ""
    @State private var found: [InvestmentSymbol] = []
    @State private var picked: InvestmentSymbol?
    @State private var searching = false
    @State private var searchNote: String?
    @State private var sharesText = ""
    @State private var totalText = ""
    @State private var date = Date()
    @State private var problem: String?
    @State private var saving = false

    /// The picker's choice for a new account (never an account's id).
    private static let newAccount = "\u{1}new"

    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { $0.kind == "investment" || $0.kind == "retirement" }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("This is", selection: $sold) {
                        Text("A buy").tag(false)
                        Text("A sale").tag(true)
                    }
                    .pickerStyle(.segmented)
                }
                Section("Account") {
                    Picker("Account", selection: $account) {
                        Text("Choose…").tag("")
                        ForEach(accounts) { a in
                            Text(verbatim: a.name).tag(a.id)
                        }
                        if !sold { Text("A new account…").tag(Self.newAccount) }
                    }
                    if account == Self.newAccount {
                        TextField("Its name, as in Ghostfolio", text: $newName)
                            .autocorrectionDisabled()
                    }
                }
                Section {
                    if let picked {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(verbatim: picked.symbol).font(.headline)
                                Text(verbatim: "\(picked.name) · \(picked.currency)").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Change") { self.picked = nil }
                        }
                    } else {
                        TextField("Ticker or name", text: $query)
                            .autocorrectionDisabled()
                            #if os(iOS)
                            .textInputAutocapitalization(.characters)
                            #endif
                            .onSubmit { Task { await search() } }
                        Button(searching ? "Looking…" : "Look It Up") { Task { await search() } }
                            .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || searching)
                        ForEach(found) { symbol in
                            Button {
                                picked = symbol
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(verbatim: symbol.symbol).font(.headline).foregroundStyle(Theme.ink)
                                    Text(verbatim: "\(symbol.name) · \(symbol.currency)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        if let searchNote {
                            Text(verbatim: searchNote).font(.callout).foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("What")
                } footer: {
                    Text("Only what you type here leaves the homelab, when Ghostfolio looks it up.")
                }
                Section {
                    TextField("Shares", text: $sharesText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                    TextField(sold ? "What you got for them all" : "What you paid for them all", text: $totalText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .privacySensitive()
                    DatePicker("Day", selection: $date, in: ...Date(), displayedComponents: .date)
                }
                if let problem {
                    Section {
                        Label {
                            Text(verbatim: problem)
                        } icon: {
                            Image(systemName: "exclamationmark.triangle")
                        }
                        .foregroundStyle(Theme.danger)
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(sold ? "Add a Sale" : "Add a Buy")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Add") { Task { await save() } }
                    }
                }
            }
            .onChange(of: sold) { _, isSale in
                if isSale, account == Self.newAccount { account = "" }
            }
        }
    }

    private func search() async {
        let text = query.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, !searching else { return }
        searching = true
        defer { searching = false }
        do {
            found = try await finances.findSymbols(text)
            searchNote = found.isEmpty ? "Ghostfolio found nothing for that." : nil
        } catch {
            found = []
            searchNote = APIError.from(error).errorDescription
        }
    }

    private func save() async {
        let add = InvestmentAdd(
            account: account.isEmpty || account == Self.newAccount ? nil : account,
            newName: account == Self.newAccount ? newName : nil,
            symbol: picked,
            shares: Self.number(sharesText) ?? 0,
            total: Self.number(totalText) ?? -1,
            date: date,
            sold: sold
        )
        saving = true
        problem = await finances.addInvestment(add)
        saving = false
        if problem == nil { dismiss() }
    }

    /// A number as typed here ("1,234.5"), or nil.
    static func number(_ text: String) -> Double? {
        let t = text.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return nil }
        return try? Double(t, format: .number)
    }
}

/// Accounts today, net worth and the cushion; tap an account to type in its balance.
/// Track From's sheet: a day (today at the latest), or every transaction.
private struct TrackFromSheet: View {
    @Bindable var finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date
    @State private var saving = false
    private let was: String?

    init(finances: FinancesViewModel, day: String?) {
        self.finances = finances
        was = day
        // None yet: Jan 1 of this year, where a household usually starts.
        _date = State(initialValue: LocalDay.parse(day) ?? LocalDay.parse(String(FinancePlanEdit.todayString().prefix(4)) + "-01-01") ?? Date())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Track from", selection: $date, in: ...Date(), displayedComponents: .date)
                } footer: {
                    Text("Spending, Cash Flow, Money Flow and Month in Review start here, on every device, and net worth goes back to it. Transactions before it stay in your list, under months marked Not counted.")
                }
                if was != nil {
                    Section {
                        Button("Count Every Transaction") { Task { await save(nil) } }
                            .disabled(saving)
                    }
                }
                if let error = finances.saveError {
                    Section {
                        Label {
                            Text(verbatim: error)
                        } icon: {
                            Image(systemName: "exclamationmark.triangle")
                        }
                        .foregroundStyle(Theme.danger)
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle("Track From")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Save") { Task { await save(FinancePlanEdit.todayString(date)) } }
                    }
                }
            }
        }
    }

    private func save(_ day: String?) async {
        saving = true
        defer { saving = false }
        if await finances.setTrackFrom(day) { dismiss() }
    }
}

private struct FinanceAccountsPage: View {
    @State private var adding = false
    @Bindable var finances: FinancesViewModel
    @State private var editingCushion = false
    @State private var trackingFrom = false

    var body: some View {
        ScrollView {
            if let view = finances.plan {
                VStack(spacing: 18) {
                    // Net worth with its line (1M to All, and each group), as Finances' home had it before its half card.
                    NetWorthCard(view: view, finances: finances, linked: false)
                    if finances.amountsShown, !finances.amountsHiddenByPlan, view.assets + view.liabilities > 0 { summary(view) }
                    ForEach(view.accountGroups) { group in
                        groupCard(group, view)
                    }
                    if finances.canEditPlan || view.plan.cushion > 0 { cushionCard(view) }
                    if finances.canEditPlan || view.plan.trackFrom != nil { trackFromCard(view) }
                    if view.plan.accounts.contains(where: { $0.currency != nil && $0.currency != "" }) {
                        Text("Net worth counts each account in the plan's currency as it's typed, without exchange rates.")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryInk)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .toolbar {
            if finances.canEditPlan {
                ToolbarItem(placement: .primaryAction) {
                    Button { adding = true } label: { Label("Add Account", systemImage: "plus") }
                }
            }
        }
        .sheet(isPresented: $adding) { AddAccountView(finances: finances) }
        .navigationTitle("Accounts")
        .sheet(isPresented: $trackingFrom) {
            TrackFromSheet(finances: finances, day: finances.plan?.plan.trackFrom)
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

    /// Net worth, and what's had against what's owed as one bar.
    private func summary(_ view: FinancesPlanView) -> some View {
        let shown = finances.amountsShown && !finances.amountsHiddenByPlan
        let assets = view.assets, owed = view.liabilities
        let share = assets + owed > 0 ? assets / (assets + owed) : 1
        // What's owned against what's owed; net worth itself is the card above.
        return VStack(alignment: .leading, spacing: 10) {
            if shown, assets + owed > 0 {
                GeometryReader { geo in
                    HStack(spacing: 3) {
                        Capsule().fill(Theme.success).frame(width: max(6, (geo.size.width - 3) * share))
                        Capsule().fill(Theme.danger.opacity(0.85))
                    }
                }
                .frame(height: 10)
                .accessibilityHidden(true)
                HStack {
                    legend("Assets", assets, Theme.success, view)
                    Spacer()
                    legend("Liabilities", owed, Theme.danger, view)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func legend(_ title: LocalizedStringKey, _ value: Double, _ tint: Color, _ view: FinancesPlanView) -> some View {
        HStack(spacing: 6) {
            Circle().fill(tint).frame(width: 8, height: 8)
            Text(title).foregroundStyle(Theme.secondaryInk)
            Text(verbatim: amountText(value, view.plan.currency, finances, whole: true))
                .monospacedDigit()
                .fontWeight(.semibold)
                .foregroundStyle(Theme.ink)
        }
        .font(.footnote)
        .accessibilityElement(children: .combine)
    }

    private func groupCard(_ group: AccountGroup, _ view: FinancesPlanView) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: group.title)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                Text(verbatim: amountText(group.total, view.plan.currency, finances, whole: true))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.secondaryInk)
            }
            .padding(.bottom, 6)
            ForEach(Array(group.accounts.enumerated()), id: \.element.id) { i, account in
                if i > 0 { Divider().padding(.leading, 54) }
                // Its own page, as on the computer: Update Balance is a button there.
                NavigationLink {
                    AccountDetailView(account: account, finances: finances)
                } label: {
                    accountRow(account, view)
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityHint("Opens its page")
            }
        }
        .padding(16)
        .card()
    }

    /// Track from: the day the charts and totals count from.
    private func trackFromCard(_ view: FinancesPlanView) -> some View {
        Button {
            finances.clearSaveError()
            trackingFrom = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Track From").foregroundStyle(Theme.ink)
                    Text("Where the charts and totals start")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryInk)
                }
                Spacer(minLength: 8)
                Text(verbatim: LocalDay.parse(view.plan.trackFrom)?.formatted(.dateTime.month(.abbreviated).day().year()) ?? "Everything")
                    .foregroundStyle(Theme.secondaryInk)
                if finances.canEditPlan {
                    Image(systemName: "chevron.right").accessibilityHidden(true)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(16)
            .card()
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!finances.canEditPlan)
        .accessibilityHint(finances.canEditPlan ? "Change the day the charts and totals start" : "")
    }

    private func cushionCard(_ view: FinancesPlanView) -> some View {
        Button {
            finances.clearSaveError()
            editingCushion = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Theme.info, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Cushion").foregroundStyle(Theme.ink)
                    Text("The least checking should hold")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryInk)
                }
                Spacer(minLength: 8)
                if view.plan.cushion > 0 {
                    Money(value: view.plan.cushion, currency: view.plan.currency, finances: finances)
                        .foregroundStyle(Theme.secondaryInk)
                } else {
                    Text("None").foregroundStyle(Theme.secondaryInk)
                }
                if finances.canEditPlan {
                    Image(systemName: "chevron.right").accessibilityHidden(true)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(16)
            .card()
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!finances.canEditPlan)
        .accessibilityHint(finances.canEditPlan ? "Change the least checking should hold" : "")
    }

    private func accountRow(_ account: FinanceAccount, _ view: FinancesPlanView) -> some View {
        HStack(spacing: 12) {
            LogoCircle(account: account, size: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: account.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Text(verbatim: [account.kindTitle, account.institution.map { PayeeLogos.shared.brandsByKey[$0]?.name ?? $0 }]
                    .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                // What a card or loan owes, as less than nothing (as on Finances' accounts row).
                Money(value: (account.isOwed ? -1 : 1) * (view.start[account.id] ?? 0), currency: account.currency ?? view.plan.currency, finances: finances)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                if let updated = AccountsLook.updated(account.updated, today: view.today) {
                    Text(verbatim: updated).font(.caption).foregroundStyle(Theme.secondaryInk)
                }
            }
        }
        .padding(.vertical, 6)
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
                        if finances.canEditPlan {
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
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .sensoryFeedback(.success, trigger: finances.savedCount)
        .navigationTitle("Goals")
        .modifier(AddGoalButton(finances: finances))
        .sheet(item: $editingGoal) { goal in
            AmountEditor(
                title: "Change Goal", heading: goal.name,
                footer: "How much it needs in all. What's put by toward it stays as it is.",
                finances: finances
            ) { amount in await finances.setGoal(goal, target: amount) }
        }
    }

    private func goalRow(_ goal: FinanceGoal, _ view: FinancesPlanView) -> some View {
        let tint = goal.isReached ? Theme.success : Theme.accent
        return HStack(spacing: 14) {
            ProgressRing(value: goal.share, lineWidth: 6, tint: tint, track: tint.opacity(0.16)) {
                Text(goal.share, format: .percent.precision(.fractionLength(0)))
                    .font(.caption2.weight(.bold))
                    .monospacedDigit()
            }
            .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: goal.name)
                    .font(.body.weight(.medium))
                HStack(spacing: 3) {
                    Money(value: goal.saved, currency: view.plan.currency, finances: finances)
                        .fontWeight(.semibold)
                    Text("of")
                        .foregroundStyle(.secondary)
                    Money(value: goal.target, currency: view.plan.currency, finances: finances)
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline)
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
                .foregroundStyle(goal.isReached ? Theme.success : .secondary)
                if goal.needsMonth > 0, !goal.isReached {
                    HStack(spacing: 4) {
                        Text("Needs")
                        Money(value: goal.needsMonth, currency: view.plan.currency, finances: finances)
                        Text("a month")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
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
                        // Its page: the papers' ring and every payment, where they're typed in.
                        NavigationLink { LoanPage(loan: loan, finances: finances) } label: {
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
                    if finances.canEditPlan {
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
            Text(finances.canEditPlan
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
    /// Its place among the periods: the accounts after it are set against the one before.
    let index: Int
    let view: FinancesPlanView
    let finances: FinancesViewModel
    let edit: (FinancePayment) -> Void

    var body: some View {
        Section {
            // In, out and left side by side, as one line of three figures.
            let low = view.plan.cushion > 0 && period.left < view.plan.cushion
            HStack(alignment: .top, spacing: 8) {
                figure("Comes in", period.moneyIn, tint: Theme.success)
                figure("Goes out", period.out, tint: Color.primary,
                       note: period.saved > 0 ? amountText(period.saved, view.plan.currency, finances, whole: true) + " saved" : nil)
                figure("Left", period.left, tint: period.left < 0 ? Theme.danger : low ? Theme.warning : Color.primary, bold: true,
                       // What the period itself came to, as the computer's Delta beside its title.
                       note: period.now ? nil : signedWhole(period.moneyIn - period.out) + " this period")
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)
            if low {
                Label("Below the cushion you set", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.warning)
            }
            if let payday = BillsPeriod.onPayday(period, in: view) {
                Text("On payday, once its own payments are out: \(Text(verbatim: amountText(payday, view.plan.currency, finances)).fontWeight(.semibold).foregroundStyle(payday < 0 ? Theme.danger : Theme.ink))")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
            }
            let tiles = BillsPeriod.tiles(index, in: view)
            if !tiles.isEmpty {
                AccountsAfter(tiles: tiles, currency: view.plan.currency, finances: finances)
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
            }
            // Whose paycheck starts it, as the computer's first row.
            if !period.now, let pay = period.pay {
                HStack(spacing: 12) {
                    LogoCircle(payee: BillsPeriod.payWords(pay, people: view.plan.people), size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(verbatim: BillsPeriod.payWords(pay, people: view.plan.people))
                        if let date = pay.date {
                            Text(date, format: .dateTime.weekday(.abbreviated).month().day())
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer(minLength: 8)
                    Money(value: pay.amount, currency: view.plan.currency, finances: finances, signed: true)
                        .foregroundStyle(Theme.success)
                }
                .accessibilityElement(children: .combine)
            }
            // By position: the same payment can come twice on one day.
            ForEach(period.rows.indices, id: \.self) { i in
                let row = period.rows[i]
                // One of the plan's own payments (a card's payoff is the card's, changed on its account).
                if finances.canEditPlan, let payment = view.payment(row.payment), view.plan.payments.contains(where: { $0.id == payment.id }) {
                    Button {
                        edit(payment)
                    } label: {
                        RowLine(row: row, view: view, finances: finances)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Change it")
                } else {
                    RowLine(row: row, view: view, finances: finances)
                }
            }
        } header: {
            Text(title)
        }
    }

    /// "+$1,685" or "-$40", whole, for the period's own change.
    private func signedWhole(_ value: Double) -> String {
        let text = amountText(abs(value), view.plan.currency, finances, whole: true)
        guard text != "••••" else { return text }
        return (value < 0 ? "-" : "+") + text
    }

    private func figure(_ title: LocalizedStringKey, _ value: Double, tint: Color, bold: Bool = false, note: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(verbatim: amountText(value, view.plan.currency, finances, whole: true))
                .font(.headline.weight(bold ? .heavy : .semibold))
                .monospacedDigit()
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let note {
                Text(verbatim: note)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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

/// Every account after a pay period, side by side, with what changed (the
/// computer's Accounts, paycheck by paycheck); it scrolls sideways.
private struct AccountsAfter: View {
    let tiles: [BillsPeriod.Tile]
    let currency: String
    let finances: FinancesViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("After This Pay Period")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryInk)
                .padding(.horizontal, 16)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(tiles) { tile in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(verbatim: tile.name)
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryInk)
                                .lineLimit(1)
                            Text(verbatim: amountText(tile.after, currency, finances, whole: true) + (tile.owes ? " owed" : ""))
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(Theme.ink)
                                .lineLimit(1)
                            if abs(tile.change) >= 0.5 {
                                // A card owing more is the bad way; any other account holding less is.
                                let worse = tile.owes ? tile.change > 0 : tile.change < 0
                                Text(verbatim: (tile.change < 0 ? "-" : "+") + amountText(abs(tile.change), currency, finances, whole: true))
                                    .font(.caption2)
                                    .foregroundStyle(worse ? Theme.danger : Theme.success)
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(minWidth: 104, alignment: .leading)
                        .background(Theme.canvas, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
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
        let layout = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout(spacing: 12))
        layout {
            if !large, let payment = view.payment(row.payment) {
                LogoCircle(payment: payment, size: 36)
            }
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
                // Its day, and how it's paid: its kind, on a card, from another account or someone else.
                if let date = row.date {
                    Text(verbatim: "\(date.formatted(.dateTime.weekday(.abbreviated).month().day())) · \(BillsPeriod.via(row, in: view))")
                        .font(.caption).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
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
struct BalanceEditor: View {
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

/// Transactions as Apple's Wallet shows a card's: the account's card on
/// top with your other accounts as small cards to switch to, then what
/// happened, newest first, by month, each with its payee's logo. One that
/// came in since you looked has a violet dot until it's reviewed. Tap one
/// for its page.
struct TransactionsView: View {
    @Bindable var finances: FinancesViewModel
    @State private var search = ""
    @State private var adding = false
    /// The account picked, by id; nil (or nil inside) for every account, as it opens.
    @State private var picked: String??
    /// Only the new ones.
    @State private var onlyNew = false
    /// Money in or out, a category, or the larger ones only.
    @State private var filter = TransactionFilter()
    /// Select (iPhone and iPad): transactions picked together, for one
    /// category, Move to…, or Delete.
    @State private var selecting = false
    @State private var selected = Set<String>()
    @State private var categorizingSelected = false
    @State private var confirmingDelete = false
    /// Import a File: a bank's CSV or OFX, read here.
    @State private var importing = false
    /// The rules imports follow (import 4 of 4).
    @State private var showingRules = false
    /// The column it's sorted by, kept on this device (the computer's column headers).
    @State private var sort = TransactionSort.kept()
    /// How many rows are drawn: 200, and 200 more with each Show More.
    @State private var drawn = TransactionSort.page
    @Namespace private var zoom

    /// Opened on every account, as the redesign's picture;
    /// from a budget, on its category and month.
    init(finances: FinancesViewModel, filter: TransactionFilter = TransactionFilter()) {
        _finances = Bindable(finances)
        _filter = State(initialValue: filter)
    }
    @Environment(\.dynamicTypeSize) private var typeSize

    /// The account shown, by id; nil for all of them.
    private var account: String? { picked ?? nil }

    /// The accounts in the switcher, in the screen's order: not a home, a
    /// car or a collectible, which have no transactions.
    nonisolated static func switcherAccounts(_ accounts: [FinanceAccount]) -> [FinanceAccount] {
        AccountStrip.listed(accounts)
    }

    /// What a new search, filter or account starts Show More again from.
    private struct DrawnFor: Equatable {
        let search: String
        let account: String?
        let onlyNew: Bool
        let filter: TransactionFilter
    }

    private var drawnFor: DrawnFor {
        DrawnFor(search: search, account: account, onlyNew: onlyNew, filter: filter)
    }

    /// Every transaction the search, account and filter keep, in the order picked.
    private var ordered: [FinanceTransaction] {
        guard let ledger = finances.ledger else { return [] }
        // A search looks in every account (the switcher is hidden while searching).
        let shown = search.isEmpty ? account : nil
        let categories = finances.plan?.categories ?? []
        let finding = TransactionSearch(search)
        // Each account's name once, not looked up row by row.
        let names = Dictionary((finances.plan?.plan.accounts ?? []).map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        let kept = ledger.newestFirst.filter { t in
            if let shown, t.account != shown, t.to != shown { return false }
            if onlyNew, !finances.isNew(t) { return false }
            if filter.isOn, !filter.keeps(t, categories: categories) { return false }
            // Last: it works out each row's words.
            return finding.finds(t, accountName: { names[$0] })
        }
        guard !sort.isNewestFirst else { return kept }
        return sort.sorted(kept,
                           payee: { TransactionDetailView.title(of: $0, finances: finances) },
                           accountName: { names[$0] ?? "Account" })
    }

    /// Date, payee, category, account or amount, and which way: the
    /// computer's column headers, kept on this device.
    private var sortMenu: some View {
        Menu {
            Section("Sort By") {
                Picker("Sort By", selection: Binding(get: { sort.by }, set: { setSort(sort.picking($0)) })) {
                    ForEach(TransactionSort.Column.allCases, id: \.self) { column in
                        Text(verbatim: column.title).tag(column)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
            Section {
                Picker("Order", selection: Binding(get: { sort.up }, set: { setSort(TransactionSort(by: sort.by, up: $0)) })) {
                    ForEach([sort.by.firstUp, !sort.by.firstUp], id: \.self) { up in
                        Text(verbatim: sort.by.way(up: up)).tag(up)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
        } label: {
            Label("Sort", systemImage: sort.isNewestFirst ? "arrow.up.arrow.down.circle" : "arrow.up.arrow.down.circle.fill")
        }
        .sensoryFeedback(.selection, trigger: sort)
    }

    private func setSort(_ next: TransactionSort) {
        next.keep()
        withAnimation(.snappy) { sort = next }
    }

    /// The picture's chips over the list: the month, the account and the category, each a menu.
    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(filter.days.map { PaySpans.words($0) } ?? filter.month.map { $0.formatted(.dateTime.month(.wide).year()) } ?? "Every month",
                     systemImage: "calendar", on: filter.month != nil || filter.days != nil) {
                    when("Every month", picked: filter.month == nil && filter.days == nil) { filter.month = nil; filter.days = nil }
                    if let view = finances.plan {
                        Section {
                            ForEach(PaySpans.make(view)) { span in
                                when("\(span.title) · \(PaySpans.words(span.days))", picked: filter.days == span.days) { filter.month = nil; filter.days = span.days }
                            }
                        }
                    }
                    Section {
                        ForEach(filterMonths, id: \.self) { month in
                            when(month.formatted(.dateTime.month(.wide).year()), picked: filter.days == nil && filter.month == month) { filter.days = nil; filter.month = month }
                        }
                    }
                }
                chip(account.flatMap { finances.accountName($0) } ?? "All accounts", systemImage: nil, on: account != nil) {
                    Picker("Account", selection: Binding(get: { account }, set: { id in withAnimation(.snappy) { picked = .some(id) } })) {
                        Text("All accounts").tag(String?.none)
                        ForEach(Self.switcherAccounts(finances.plan?.plan.accounts ?? [])) { a in
                            Text(verbatim: a.name).tag(String?.some(a.id))
                        }
                    }
                }
                chip(filter.category ?? "All categories", systemImage: nil, on: filter.category != nil) {
                    Picker("Category", selection: $filter.category.animation(.snappy)) {
                        Text("All categories").tag(String?.none)
                        ForEach(filterCategories, id: \.self) { name in
                            Text(verbatim: name).tag(String?.some(name))
                        }
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .scrollClipDisabled()
        .sensoryFeedback(.selection, trigger: picked)
    }

    /// A choice in the date chip's menu, ticked while it's the one shown.
    private func when(_ words: String, picked: Bool, pick: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.snappy) { pick() }
        } label: {
            if picked { Label(words, systemImage: "checkmark") } else { Text(verbatim: words) }
        }
    }

    private func chip<Options: View>(_ words: String, systemImage: String?, on: Bool, @ViewBuilder options: () -> Options) -> some View {
        Menu {
            options()
        } label: {
            HStack(spacing: 6) {
                if let systemImage { Image(systemName: systemImage).accessibilityHidden(true) }
                Text(verbatim: words).lineLimit(1)
                Image(systemName: "chevron.down").font(.caption.weight(.semibold)).accessibilityHidden(true)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(on ? Theme.accent : Theme.ink)
            .padding(.horizontal, 13)
            .frame(minHeight: 36)
            .background(on ? Theme.accent.opacity(0.14) : Theme.surface, in: Capsule())
        }
    }

    /// Under the strip, as the picture's: what looks like a bill or a transfer (sorted just below, where the
    /// ledger may be changed) and how many new ones have no category yet.
    private var reviewLine: String? {
        let all = finances.ledger?.transactions ?? []
        var bills = 0, transfers = 0
        if search.isEmpty, !filter.isOn, finances.canAddTransactions {
            // Counted as the sections below show them: only rows still in the ledger.
            let ids = Set(all.map(\.id))
            let review = finances.transactionReview()
            bills = review.links.filter { ids.contains($0.id) }.count
            transfers = review.pairs.filter { ids.contains($0.out) && ids.contains($0.into) }.count
        }
        return ReviewStrip.line(bills: bills, transfers: transfers, uncategorized: ReviewStrip.uncategorized(all.filter { finances.isNew($0) }))
    }

    /// New since you looked, as the picture's strip: Review opens them.
    private func reviewStrip(_ count: Int) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.accent)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: count == 1 ? "1 new to review" : "\(count) new to review")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                if let line = reviewLine {
                    Text(verbatim: line)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            Text("Review")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Theme.accentFill, in: Capsule())
        }
        .padding(.vertical, 4)
        // The whole strip opens the inbox, without a list row's chevron.
        .background {
            NavigationLink { ReviewInboxPage(finances: finances) } label: { EmptyView() }
                .opacity(0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    /// Money in or out, one tag, or only $100 or more.
    private var filterMenu: some View {
        Menu {
            Picker("Show", selection: $filter.flow.animation(.snappy)) {
                Text("Everything").tag(TransactionFilter.Flow.all)
                Text("Money Out").tag(TransactionFilter.Flow.moneyOut)
                Text("Money In").tag(TransactionFilter.Flow.moneyIn)
                Text("Between My Accounts").tag(TransactionFilter.Flow.betweenAccounts)
            }
            if !filterTags.isEmpty {
                Picker("Tag", selection: $filter.tag.animation(.snappy)) {
                    Text("Every Tag").tag(String?.none)
                    ForEach(filterTags, id: \.self) { tag in
                        Text(verbatim: tag).tag(String?.some(tag))
                    }
                }
                .pickerStyle(.menu)
            }
            Toggle("$100 or More", isOn: Binding(
                get: { filter.atLeast != nil },
                set: { on in withAnimation(.snappy) { filter.atLeast = on ? 100 : nil } }
            ))
        } label: {
            Label("Filter", systemImage: filter.isOn ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
        }
        .sensoryFeedback(.selection, trigger: filter)
    }

    /// The months the transactions fall in, newest first.
    private var filterMonths: [Date] {
        TransactionFilter.months(in: finances.ledger?.transactions ?? [])
    }

    /// Every tag on a transaction.
    private var filterTags: [String] {
        TransactionFilter.tags(in: finances.ledger?.transactions ?? [])
    }

    /// The categories the transactions have, by their top, as Spending counts them.
    private var filterCategories: [String] {
        guard let ledger = finances.ledger else { return [] }
        let categories = finances.plan?.categories ?? []
        let names = ledger.transactions.flatMap { t in t.splits.isEmpty ? [t.category] : t.splits.map(\.category) }
        // With the one picked, which a budget can set to a category inside a group.
        return Set(names.map { Spending.top($0, in: categories) } + [filter.category].compactMap { $0 })
            .sorted { $0.localizedLowercase < $1.localizedLowercase }
    }

    // Split in two so the compiler checks each in reasonable time (the screenshots build gave up on one).
    var body: some View {
        list
            .toolbar {
                if finances.canAddTransactions, !selecting {
                    ToolbarItem(placement: .secondaryAction) {
                        Button {
                            importing = true
                        } label: {
                            Label("Import a File…", systemImage: "square.and.arrow.down")
                        }
                    }
                }
                if finances.canChangeRules || !finances.rules.isEmpty, !selecting {
                    ToolbarItem(placement: .secondaryAction) {
                        Button {
                            showingRules = true
                        } label: {
                            Label(finances.rules.isEmpty ? "Rules" : "Rules (\(finances.rules.count))", systemImage: "list.bullet.rectangle")
                        }
                    }
                }
            }
            .sheet(isPresented: $importing) {
                ImportFileView(finances: finances)
            }
            .sheet(isPresented: $showingRules) {
                RulesView(finances: finances)
            }
            // ⇧⌘I in the Finances menu, and the palette's commands, while Transactions is in front.
            .focusedSceneValue(\.transactions, focus)
    }

    private var focus: TransactionsFocus? {
        guard finances.canAddTransactions else { return nil }
        return TransactionsFocus(importFile: { importing = true }, addTransaction: { finances.clearSaveError(); adding = true })
    }

    @ViewBuilder
    private var list: some View {
        let newCount = finances.newTransactionCount
        let all = ordered
        let rows = Array(all.prefix(drawn))
        let groups = sort.byDay ? TransactionDays.group(rows) : []
        let running = sort.isNewestFirst ? runningBalances(groups) : [:]
        List(selection: listSelection) {
            Section {
                chips
                    .listRowInsets(EdgeInsets(top: 2, leading: 0, bottom: 2, trailing: 0))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }
            if search.isEmpty, newCount > 0 {
                Section {
                    reviewStrip(newCount)
                        .listRowBackground(Theme.accent.opacity(0.12))
                }
            }
            // What looks like a planned payment or a transfer, to sort (as the computer's top of Transactions).
            if search.isEmpty, !filter.isOn, finances.canAddTransactions {
                TransactionReviewSections(finances: finances)
            }
            Section {
                // Under the heading, not over it.
                if finances.ledger == nil || all.isEmpty {
                    emptyState
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            } header: {
                latestHeader(newCount: newCount, all: all)
                    .textCase(nil)
            }
            ForEach(groups) { group in
                Section {
                    ForEach(group.items) { t in
                        row(t, balanceAfter: running[t.id], withYear: false)
                    }
                } header: {
                    // The picture's day heading: NOV 22, in small capitals, its total at the end.
                    HStack {
                        Text(verbatim: TransactionDays.title(group.day, trackFrom: finances.plan?.plan.trackFrom, today: finances.plan?.today ?? Date()))
                            .textCase(.uppercase)
                        Spacer()
                        let total = TransactionDays.total(group.items, account: search.isEmpty ? account : nil)
                        Text(verbatim: (total >= 0.005 ? "+" : total <= -0.005 ? "−" : "") + amountText(abs(total), finances.currency, finances))
                            .monospacedDigit()
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
                }
            }
            // By anything but the date: one list, each row with its day.
            if !sort.byDay, !rows.isEmpty {
                Section {
                    ForEach(rows) { t in
                        row(t, balanceAfter: nil, withYear: true)
                    }
                }
            }
            if all.count > rows.count {
                showMore(total: all.count)
            }
        }
        .themedCanvas()
        .compactSections()
        .searchable(text: $search, prompt: "Payee, category, amount, day")
        .task {
            await finances.loadLedger()
            // Accounts and categories for a new one come from the plan.
            if finances.plan == nil { await finances.loadPlan() }
        }
        .refreshable { await finances.loadLedger() }
        // A new search, filter or account starts again from the first 200.
        .onChange(of: drawnFor) { drawn = TransactionSort.page }
        .navigationTitle(selecting ? (selected.isEmpty ? "Select" : "\(selected.count) Selected") : "Transactions")
        #if os(iOS)
        .environment(\.editMode, .constant(selecting ? .active : .inactive))
        .toolbar {
            if finances.canAddTransactions, !(finances.ledger?.transactions.isEmpty ?? true) {
                ToolbarItem(placement: .topBarLeading) {
                    Button(selecting ? "Done" : "Select") {
                        withAnimation(.snappy) {
                            selecting.toggle()
                            selected = []
                        }
                    }
                }
            }
            if selecting {
                ToolbarItemGroup(placement: .bottomBar) {
                    Button("Category…") { categorizingSelected = true }
                        .disabled(selected.isEmpty)
                    Spacer()
                    Menu("Move To…") {
                        ForEach(finances.plan?.plan.accounts.filter { FinancePlanEdit.paymentFromKinds.contains($0.kind) } ?? []) { a in
                            Button(a.name) { Task { if await finances.move(selectedTransactions, to: a.id) { endSelecting() } } }
                        }
                    }
                    .disabled(selected.isEmpty)
                    Spacer()
                    Button("Delete", role: .destructive) { confirmingDelete = true }
                        .disabled(selected.isEmpty)
                }
            }
        }
        .sheet(isPresented: $categorizingSelected, onDismiss: { if finances.togetherDone != nil { endSelecting() } }) {
            CategoryPicker(transactions: selectedTransactions, finances: finances)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(selected.count == 1 ? "Delete 1 transaction?" : "Delete \(selected.count) transactions?",
                            isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { if await finances.delete(selectedTransactions) { endSelecting() } }
            }
        } message: {
            Text("They're taken out of your Finances on every device.")
        }
        .safeAreaInset(edge: .top) {
            if let done = finances.togetherDone, done.done < done.of {
                Label("\(done.of - done.done) of them are transfers or split, and are changed on the computer.",
                      systemImage: "info.circle")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
                    .padding(.horizontal)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.bar)
                    .onTapGesture { finances.dismissTogetherDone() }
                    .accessibilityAction(named: Text("Dismiss")) { finances.dismissTogetherDone() }
            }
        }
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                sortMenu
            }
            ToolbarItem(placement: .primaryAction) {
                filterMenu
            }
            if newCount > 0 {
                ToolbarItem(placement: .secondaryAction) {
                    Button {
                        finances.markReviewed(finances.ledger?.transactions.filter { finances.isNew($0) } ?? [])
                    } label: {
                        Label("Mark All Reviewed", systemImage: "checkmark.circle")
                    }
                }
            }
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
        .sensoryFeedback(.selection, trigger: account)
        .sensoryFeedback(.success, trigger: finances.savedCount)
    }

    /// Transactions' heading: the order it's in, a button beside it (Clear
    /// Filter, Newest First, or what's new), and under it, with a search or
    /// a filter, how many and what they come to together.
    private func latestHeader(newCount: Int, all: [FinanceTransaction]) -> some View {
        // At the largest text sizes the button goes under the heading: beside it,
        // "Latest Transactions" broke mid-word ("Trans- actions", large-transactions).
        VStack(alignment: .leading, spacing: 4) {
            // Newest first with nothing filtered, the picture's list has no heading: the line under it says it.
            if !sort.isNewestFirst || filter.isOn || onlyNew {
            (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 6))
                                          : AnyLayout(HStackLayout(alignment: .firstTextBaseline))) {
                Text(verbatim: sort.heading)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.ink)
                if !typeSize.isAccessibilitySize { Spacer() }
                if filter.isOn {
                    Button("Clear Filter") {
                        withAnimation(.snappy) { filter = TransactionFilter() }
                    }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                } else if !sort.isNewestFirst {
                    Button("Newest First") { setSort(.newestFirst) }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .controlSize(.small)
                        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
                } else if onlyNew {
                    Button("Show All") {
                        withAnimation(.snappy) { onlyNew.toggle() }
                    }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .dynamicTypeSize(...DynamicTypeSize.accessibility1)
                }
            }
            }
            // How many, what came in and what went out (the picture's line over the list), the figures in ink.
            if !all.isEmpty {
                let line = TransactionDays.line(all, account: search.isEmpty ? account : nil)
                let count = Text(verbatim: "\(line.count)").fontWeight(.semibold).foregroundStyle(Theme.ink)
                let moneyIn = Text(verbatim: "+" + amountText(line.moneyIn, finances.currency, finances, whole: true))
                    .fontWeight(.semibold).foregroundStyle(Theme.ink)
                let moneyOut = Text(verbatim: "−" + amountText(line.moneyOut, finances.currency, finances, whole: true))
                    .fontWeight(.semibold).foregroundStyle(Theme.ink)
                Text("\(count) \(line.count == 1 ? "transaction" : "transactions")   In \(moneyIn)   Out \(moneyOut)")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.secondaryInk)
            }
        }
    }

    /// A transaction's row, opening its page; swiped, Reviewed while it's new.
    private func row(_ t: FinanceTransaction, balanceAfter: Double?, withYear: Bool) -> some View {
        let isNew = finances.isNew(t)
        return NavigationLink {
            TransactionDetailView(transaction: t, finances: finances)
                .zoomTransition(id: t.id, in: zoom)
        } label: {
            WalletTransactionRow(transaction: t, finances: finances, isNew: isNew, balanceAfter: balanceAfter, withYear: withYear,
                                 showsAccount: account == nil, showsDay: !sort.byDay)
                .zoomSource(id: t.id, in: zoom)
        }
        .swipeActions(edge: .leading) {
            if isNew {
                Button {
                    finances.markReviewed([t])
                } label: {
                    Label("Reviewed", systemImage: "checkmark")
                }
                .tint(Theme.accent)
            }
        }
    }

    /// Show 200 More under a long list, and how many of how many are shown.
    private func showMore(total: Int) -> some View {
        Section {
            Button("Show \(TransactionSort.nextPage(drawn: drawn, of: total)) More") {
                withAnimation(.snappy) { drawn += TransactionSort.page }
            }
            .frame(maxWidth: .infinity)
        } footer: {
            Text(verbatim: sort.moreWords(drawn: drawn, of: total))
                .frame(maxWidth: .infinity)
        }
    }

    /// One account picked, the whole of it shown: what it held after each day,
    /// on the day's latest transaction (`AccountBalance.daily`).
    private func runningBalances(_ groups: [TransactionDays.Day]) -> [String: Double] {
        guard search.isEmpty, !onlyNew, !filter.isOn, let id = account,
              let a = finances.plan?.plan.accounts.first(where: { $0.id == id }),
              let all = finances.ledger?.transactions else { return [:] }
        return AccountBalance.daily(a, all, shown: groups.flatMap(\.items))
    }

    /// Select's list binding: on iPhone and iPad (the Mac has its own computer app's).
    private var listSelection: Binding<Set<String>>? {
        #if os(iOS)
        $selected
        #else
        nil
        #endif
    }

    /// The transactions picked, in the ledger's order.
    private var selectedTransactions: [FinanceTransaction] {
        (finances.ledger?.transactions ?? []).filter { selected.contains($0.id) }
    }

    private func endSelecting() {
        withAnimation(.snappy) {
            selecting = false
            selected = []
        }
    }

    /// While there's nothing to list: reading, couldn't read, or nothing found.
    @ViewBuilder
    private var emptyState: some View {
        if finances.ledger == nil {
            if let error = finances.ledgerError {
                ContentUnavailableView("Couldn't Read the Transactions", systemImage: "list.bullet.rectangle", description: Text(verbatim: error))
            } else {
                ProgressView("Reading the transactions…")
            }
        } else if !search.isEmpty {
            ContentUnavailableView.search(text: search)
        } else if onlyNew {
            ContentUnavailableView("Nothing New", systemImage: "checkmark.circle", description: Text("Every transaction is reviewed."))
        } else if let account, let name = finances.plan?.plan.accounts.first(where: { $0.id == account })?.name {
            ContentUnavailableView {
                Label("No Transactions", systemImage: "list.bullet.rectangle")
            } description: {
                Text(verbatim: "Nothing in \(name) yet.")
            } actions: {
                Button("Show All Accounts") {
                    withAnimation(.snappy) { picked = .some(nil) }
                }
            }
        } else {
            ContentUnavailableView("No Transactions", systemImage: "list.bullet.rectangle")
        }
    }

    /// "Today", "Yesterday", a weekday within the week, else "Nov 5".
    nonisolated static func dayWords(_ date: Date?, now: Date = Date(), calendar: Calendar = .current) -> String {
        guard let date else { return "" }
        if calendar.isDate(date, inSameDayAs: now) { return "Today" }
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: now), calendar.isDate(date, inSameDayAs: yesterday) { return "Yesterday" }
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 99
        if (2..<7).contains(days) { return date.formatted(.dateTime.weekday(.wide)) }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}

/// A transaction as Wallet lists one: its logo, payee, category, and day,
/// its amount on the right; a violet dot while it's new.
struct WalletTransactionRow: View {
    let transaction: FinanceTransaction
    let finances: FinancesViewModel
    let isNew: Bool
    /// Transactions' running balance, on the day's latest: what the account held after the day.
    var balanceAfter: Double? = nil
    /// In one list (sorted by other than the date): the day with its year
    /// when it isn't this year's.
    var withYear = false
    /// The account under the payee, as the redesign's rows (every account shown).
    var showsAccount = false
    /// The day under the payee; off where the list is a day at a time.
    var showsDay = true

    var body: some View {
        HStack(spacing: 12) {
            LogoCircle(transaction: transaction, categories: finances.plan?.categories ?? [], size: 42)
                // New since you looked: a violet dot on the logo, as an unread badge.
                .overlay(alignment: .topLeading) {
                    if isNew {
                        Circle()
                            .fill(Theme.accent)
                            .frame(width: 11, height: 11)
                            .overlay(Circle().stroke(Theme.surface, lineWidth: 2))
                            .offset(x: -2, y: -2)
                            .accessibilityHidden(true)
                    }
                }
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(verbatim: TransactionDetailView.title(of: transaction, finances: finances))
                        .fontWeight(isNew ? .semibold : .regular)
                        .lineLimit(1)
                    if transaction.hasReceipt {
                        Image(systemName: "paperclip").font(.caption2).foregroundStyle(.secondary)
                            .accessibilityLabel("Receipt kept")
                    }
                }
                // What it was, its account and the day: one line, or two when it needs them
                // (a transfer's other account and the day cut off as "From Chase Checki…").
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    if let dot {
                        Circle().fill(dot).frame(width: 7, height: 7).accessibilityHidden(true)
                    }
                    Text(verbatim: RowWords.line([subtitle, account, day]))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 1) {
                Money(value: transaction.amount, currency: finances.currency, finances: finances)
                    .fontWeight(isNew ? .semibold : .regular)
                    .foregroundStyle(transaction.amount > 0 ? Theme.success : .primary)
                if let balanceAfter {
                    Text(verbatim: amountText(balanceAfter, finances.currency, finances))
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.secondaryInk)
                        .accessibilityLabel(Text(verbatim: "\(amountText(balanceAfter, finances.currency, finances)) after the day"))
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(isNew ? "New" : "")
    }

    private var isTransfer: Bool { !(transaction.to ?? "").isEmpty }

    /// The category's colour, as on the computer's tags; none for a transfer or a split.
    private var dot: Color? {
        guard !isTransfer, !transaction.isSplit, !transaction.category.isEmpty else { return nil }
        return Design.category(PayeeLogos.shared.categoryHue(transaction.category, in: finances.plan?.categories ?? []))?.base
    }

    private var account: String? {
        guard showsAccount, !isTransfer else { return nil }
        return finances.accountName(transaction.account)
    }

    private var day: String? {
        guard showsDay else { return nil }
        return withYear ? TransactionSort.dayWords(transaction.date) : TransactionsView.dayWords(transaction.date)
    }

    private var subtitle: String? {
        if let to = transaction.to, !to.isEmpty {
            return TransferWords.line(payee: transaction.payee, from: finances.accountName(transaction.account) ?? "Account", to: finances.accountName(to) ?? "Account")
        }
        if transaction.isSplit { return "Split" }
        return transaction.category.isEmpty ? nil : transaction.category
    }
}

/// This month at the top of Transactions, as the computer's first card:
/// what came in, went out and was kept, and money out against last month's
/// by the same day.
private struct ThisMonthCard: View {
    let month: ThisMonth
    let finances: FinancesViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Nothing yet this month: said, not three zeros.
            if month.count == 0 {
                Text("Nothing yet this month.")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 12) { stats }
                    VStack(alignment: .leading, spacing: 8) { stats }
                }
            }
            if let comparison {
                comparison
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var stats: some View {
        stat(month.moneyIn, caption: "Money in", tint: Theme.success, signed: false)
        stat(month.moneyOut, caption: "Money out", tint: Theme.ink, signed: false)
        stat(month.kept, caption: "Kept · \(TransactionFilter.count(month.count))", tint: Theme.ink, signed: true)
    }

    private func stat(_ value: Double, caption: String, tint: Color, signed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: whole(value, signed: signed))
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(tint)
                .privacySensitive()
            Text(verbatim: caption)
                .font(.footnote)
                .foregroundStyle(Theme.secondaryInk)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    /// In whole units, as the computer's card; "+" before what's kept.
    private func whole(_ value: Double, signed: Bool) -> String {
        let text = amountText(value, finances.currency, finances, whole: true)
        return signed && value > 0 && text != "••••" ? "+" + text : text
    }

    /// "$212 less out vs Oct", as the Spending card's chip says it: against last month by the same day.
    private var comparison: Text? {
        guard let change = month.outChange, month.outBefore != nil, let day = month.lastMonthDay else { return nil }
        let monthText = day.formatted(.dateTime.month(.abbreviated))
        if change == 0 { return Text(verbatim: "The same out as \(monthText)") }
        let lead = Text(verbatim: "\(whole(abs(change), signed: false)) \(change > 0 ? "more" : "less")")
            .fontWeight(.semibold)
            .foregroundStyle(change > 0 ? Theme.danger : Theme.success)
        return Text("\(lead) out vs \(monthText)")
    }
}

/// One transaction, as Wallet shows one: its logo big, the payee, the
/// amount, the day; then what it paid and from which account; its
/// category, note, tags and receipt; and the other times at that payee.
private struct TransactionDetailView: View {
    let transaction: FinanceTransaction
    @Bindable var finances: FinancesViewModel
    @State private var editing = false
    @State private var showingReceipt = false
    @Environment(\.dismiss) private var dismiss

    /// As it is now in the ledger: changed or reviewed since it was opened.
    private var t: FinanceTransaction {
        finances.ledger?.transactions.first { $0.id == transaction.id } ?? transaction
    }

    private var stillThere: Bool {
        finances.ledger?.transactions.contains { $0.id == transaction.id } ?? true
    }

    var body: some View {
        let t = self.t
        let categories = finances.plan?.categories ?? []
        let category = t.isSplit ? (t.splitCategory ?? "") : t.category
        List {
            Section {
                VStack(spacing: 6) {
                    LogoCircle(transaction: t, categories: categories, size: 76)
                    Text(verbatim: Self.title(of: t, finances: finances))
                        .font(.title3.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .padding(.top, 6)
                    Money(value: t.amount > 0 ? t.amount : -t.amount, currency: finances.currency, finances: finances, signed: t.amount > 0)
                        .font(.system(size: 44, weight: .bold))
                        .foregroundStyle(t.amount > 0 ? Theme.success : Theme.ink)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    if let date = t.date {
                        Text(date, format: .dateTime.weekday(.wide).month(.wide).day())
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if finances.isNew(t) {
                        Button {
                            finances.markReviewed([t])
                        } label: {
                            // The icon in the button's white: in a list a Label's icon takes the accent,
                            // violet on the violet button, so it didn't show.
                            Label {
                                Text("Mark Reviewed")
                            } icon: {
                                Image(systemName: "checkmark").foregroundStyle(.white)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Theme.accentFill)
                        .buttonBorderShape(.capsule)
                        .padding(.top, 8)
                    }
                }
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
            }
            Section {
                if let id = t.payment, let name = finances.plan?.paymentTitle(id) {
                    LabeledContent("Paid") {
                        Label {
                            Text(verbatim: name)
                        } icon: {
                            Image(systemName: "checkmark.circle.fill")
                        }
                        .foregroundStyle(Theme.success)
                    }
                }
                LabeledContent("Account") {
                    if let to = t.to, !to.isEmpty {
                        Text(verbatim: "\(finances.accountName(t.account) ?? "Account") → \(finances.accountName(to) ?? "Account")")
                    } else {
                        Text(verbatim: finances.accountName(t.account) ?? "Account")
                    }
                }
                // One card of details, as Wallet keeps a transaction's.
                LabeledContent("Category") {
                    HStack(spacing: 6) {
                        if let tint = Design.category(PayeeLogos.shared.categoryHue(category, in: categories)) {
                            Circle().fill(tint.base).frame(width: 9, height: 9).accessibilityHidden(true)
                        }
                        Text(verbatim: t.isSplit ? "Split" : (category.isEmpty ? "None" : category))
                    }
                }
                // The bank's own wording, kept from an import, stays in the transaction but isn't shown.
                let note = PayeeLogos.shared.shownNote(t.note, payee: t.payee)
                if !note.isEmpty {
                    LabeledContent("Note") { Text(verbatim: note).multilineTextAlignment(.trailing) }
                }
                if !t.tags.isEmpty {
                    LabeledContent("Tags") { Text(verbatim: t.tags.joined(separator: ", ")) }
                }
                if t.hasReceipt {
                    Button {
                        showingReceipt = true
                    } label: {
                        Label("Receipt", systemImage: "doc.richtext")
                    }
                }
            }
            let more = TransactionMatching.moreAt(t, in: finances.ledger?.newestFirst ?? [])
            if !more.isEmpty {
                Section {
                    ForEach(more) { other in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                if let date = other.date {
                                    Text(date, format: .dateTime.month(.wide).day().year())
                                }
                                Text(verbatim: finances.accountName(other.account) ?? "Account")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Money(value: other.amount, currency: finances.currency, finances: finances)
                                .foregroundStyle(other.amount > 0 ? Theme.success : Color.primary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                } header: {
                    Text(verbatim: "More at \(Self.title(of: t, finances: finances))")
                }
            }
        }
        .themedCanvas()
        .navigationTitle("")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            if finances.canAddTransactions && LedgerEdit.canUpdate(t) {
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit") {
                        finances.clearSaveError()
                        editing = true
                    }
                }
            }
        }
        .sheet(isPresented: $editing) {
            AddTransactionView(finances: finances, editing: t)
        }
        .sheet(isPresented: $showingReceipt) {
            if let name = t.receipt {
                ReceiptView(name: name, title: t.payee.isEmpty ? "Receipt" : t.payee, finances: finances)
            }
        }
        // Deleted from its own Edit: back to the list.
        .onChange(of: stillThere) { _, there in
            if !there { dismiss() }
        }
    }

    /// What a transaction is, in words: its payee, or where a transfer went.
    /// A payee as the bank wrote it ("NETFLIX.COM", "STARBUCKS STORE 01234")
    /// is shown as a person would write it; one typed by a person as typed.
    static func title(of t: FinanceTransaction, finances: FinancesViewModel) -> String {
        if !t.payee.isEmpty {
            let logos = PayeeLogos.shared
            guard logos.bankWording(t.payee) else { return t.payee }
            let clean = logos.cleanPayee(t.payee)
            return clean.isEmpty ? t.payee : clean
        }
        if let to = t.to, !to.isEmpty { return "To \(finances.accountName(to) ?? "another account")" }
        return "Transaction"
    }
}

/// Which transactions go together on a transaction's page.
enum TransactionMatching {
    /// The other times at the same payee (its brand, or the same name as a
    /// person would write it), newest first, five at most (or `limit`); never transfers.
    static func moreAt(_ t: FinanceTransaction, in newestFirst: [FinanceTransaction], limit: Int = 5, logos: PayeeLogos = .shared) -> [FinanceTransaction] {
        guard !t.payee.isEmpty, (t.to ?? "").isEmpty else { return [] }
        let brand = logos.payeeBrand(institution: t.institution, payee: t.payee)
        let name = logos.cleanPayee(t.payee).lowercased()
        return Array(newestFirst.lazy.filter { other in
            guard other.id != t.id, (other.to ?? "").isEmpty, !other.payee.isEmpty else { return false }
            if let brand, logos.payeeBrand(institution: other.institution, payee: other.payee) == brand { return true }
            return logos.cleanPayee(other.payee).lowercased() == name
        }.prefix(limit))
    }
}

/// Records money in or out of one account, as a person types it in.
private struct AddTransactionView: View {
    let finances: FinancesViewModel
    /// The transaction being changed, or nil for a new one.
    var editing: FinanceTransaction? = nil
    /// The day a new one starts on (Finances › Calendar's day), or today.
    var startOn: Date? = nil
    @State private var tookDay = false
    @Environment(\.dismiss) private var dismiss
    @State private var draft = NewTransaction(date: Date(), account: "", isMoneyIn: false, amount: 0, payee: "", category: "", note: "")
    @State private var amountText = ""
    @State private var confirmingDelete = false
    @State private var showingReceipt = false
    @State private var photo: PhotosPickerItem?
    @State private var attaching = false
    /// Always do this for its old name (import 4 of 4): a rule every import follows.
    @State private var always = false
    /// For names starting with some words rather than that name only; nil: as its new name suggests.
    @State private var startsWith: Bool?
    @State private var startWords: String?
    @State private var changeAlreadyIn = true

    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { ["checking", "savings", "card", "investment", "retirement", "loan", "other"].contains($0.kind) }
    }

    private var oldPayee: String { editing?.payee.trimmingCharacters(in: .whitespaces) ?? "" }

    /// Offered once a transaction with a payee is renamed or given a category (not a transfer or a split one).
    private var canAlways: Bool {
        guard let editing, finances.canChangeRules, !oldPayee.isEmpty, editing.to == nil, !editing.isSplit else { return false }
        return draft.payee.trimmingCharacters(in: .whitespaces).lowercased() != oldPayee.lowercased() || !draft.category.isEmpty
    }
    private var startingNow: Bool { startsWith ?? PayeeRules.startsOld(draft.payee, old: oldPayee) }
    private var wordsNow: String {
        startWords ?? (PayeeRules.startsOld(draft.payee, old: oldPayee) ? draft.payee.trimmingCharacters(in: .whitespaces) : oldPayee)
    }
    private var ruleNow: BankImport.Rule? {
        PayeeRules.always(oldPayee: oldPayee, payee: draft.payee, category: draft.category, startingWith: startingNow ? wordsNow : nil)
    }

    /// Always do this for “its old name”, for that name or names starting so, and the ones already in.
    @ViewBuilder
    private var alwaysSection: some View {
        if canAlways {
            Section {
                Toggle(isOn: $always) {
                    Text(verbatim: "Always do this for \u{201C}\(oldPayee)\u{201D}")
                }
                if always {
                    Picker("For", selection: Binding(get: { startingNow }, set: { startsWith = $0 })) {
                        Text("That Name Only").tag(false)
                        Text("Names Starting With…").tag(true)
                    }
                    if startingNow {
                        TextField("Starting with", text: Binding(get: { wordsNow }, set: { startWords = $0 }))
                            .autocorrectionDisabled()
                    }
                    let n = ruleNow.map { finances.alreadyIn(for: $0, except: editing?.id) } ?? 0
                    if n > 0 {
                        Toggle(n == 1 ? "Change the 1 already in" : "Change the \(n) already in", isOn: $changeAlreadyIn)
                    }
                }
            } footer: {
                if always, let rule = ruleNow {
                    Text(verbatim: "Every import from now on comes in as \(PayeeRules.becomes(rule)).")
                } else if always {
                    Text("Type the words the names start with.")
                }
            }
        }
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
                alwaysSection
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
                        Button("Save", action: save).disabled(problem != nil || (always && canAlways && ruleNow == nil))
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
            if editing == nil, !tookDay, let startOn {
                draft.date = startOn
                tookDay = true
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
            if let editing, always, canAlways, let rule = ruleNow {
                saved = await finances.update(editing, with: t, always: rule, changeAlreadyIn: changeAlreadyIn)
            } else if let editing {
                saved = await finances.update(editing, with: t)
            } else {
                saved = await finances.add(t)
            }
            if saved { dismiss() }
        }
    }
}

/// An amount, or "••••" while amounts are hidden.
struct Money: View {
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
                    Text(verbatim: CheckingHero.short(step.date))
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
            if finances.canEdit {
                HoldingTradesSection(holding: holding, account: account, currency: currency, finances: finances)
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

// MARK: - Links (homelab://finances/<page>)

extension FinancesView {
    /// A page of Finances a link asked for, with the plan and the ledger
    /// read as the home would have.
    static func linkedPage(_ page: DeepLink.FinancePage, finances: FinancesViewModel) -> some View {
        LinkedFinancePage(page: page, finances: finances)
    }

    /// A transaction's page, as Transactions opens it (Finances › Calendar's recorded rows).
    static func transactionPage(_ t: FinanceTransaction, finances: FinancesViewModel) -> some View {
        TransactionDetailView(transaction: t, finances: finances)
    }

    /// Add a Transaction, starting on a day (Finances › Calendar).
    static func addTransaction(on day: Date, finances: FinancesViewModel) -> some View {
        AddTransactionView(finances: finances, startOn: day)
    }
}

private struct LinkedFinancePage: View {
    let page: DeepLink.FinancePage
    let finances: FinancesViewModel

    var body: some View {
        content
            .task {
                if finances.plan == nil { await finances.loadPlan() }
                if finances.ledger == nil { await finances.loadLedger() }
            }
    }

    @ViewBuilder
    private var content: some View {
        switch page {
        case .transactions: TransactionsView(finances: finances)
        case .budgets: FinanceBudgetsPage(finances: finances)
        case .bills: FinanceBillsPage(finances: finances)
        case .accounts: FinanceAccountsPage(finances: finances)
        case .investments: FinanceInvestmentsPage(finances: finances)
        case .goals: FinanceGoalsPage(finances: finances)
        case .recurring: FinanceRecurringPage(finances: finances)
        case .spending: FinanceSpendingPage(finances: finances)
        case .inbox: ReviewInboxPage(finances: finances)
        case .cashflow: FinanceCashFlowPage(finances: finances)
        case .review: MonthReviewPage(finances: finances)
        case .calendar: FinanceCalendarView(finances: finances)
        case .paychecks: FinancePaychecksPage(finances: finances)
        }
    }
}

#if SCREENSHOTS
// MARK: - Screenshots

extension FinancesView {
    /// The screenshots build only: a page of Finances in place of its home,
    /// by the name given with `-shot`.
    static func screenshotRoot(finances: FinancesViewModel) -> some View {
        ScreenshotPage(finances: finances)
    }
}

/// The page asked for, with the plan and the ledger read as the home would have.
private struct ScreenshotPage: View {
    let finances: FinancesViewModel

    var body: some View {
        page
            // Again once this device may see Finances: on the iPad the page opened before it could
            // (ipad-light-bills empty, ipad-light-transactions still reading).
            .task(id: finances.canSeePlan) {
                guard finances.canSeePlan else { return }
                if finances.plan == nil { await finances.loadPlan() }
                if finances.ledger == nil { await finances.loadLedger() }
            }
    }

    @ViewBuilder
    private var page: some View {
        switch ScreenshotMode.shot {
        case "transactions": TransactionsView(finances: finances)
        case "transaction": ScreenshotTransaction(finances: finances)
        case "budgets": FinanceBudgetsPage(finances: finances)
        case "bills": FinanceBillsPage(finances: finances)
        case "accounts": FinanceAccountsPage(finances: finances)
        case "investments": FinanceInvestmentsPage(finances: finances)
        case "goals": FinanceGoalsPage(finances: finances)
        case "recurring": FinanceRecurringPage(finances: finances)
        case "spending": FinanceSpendingPage(finances: finances)
        case "inbox": ReviewInboxPage(finances: finances)
        case "cashflow": FinanceCashFlowPage(finances: finances)
        case "review": MonthReviewPage(finances: finances)
        case "calendar": FinanceCalendarView(finances: finances)
        case "paychecks": FinancePaychecksPage(finances: finances)
        case "loading": ScrollView { SkeletonCards().padding(.horizontal, 16) }.background(Theme.canvas).navigationTitle("Finances")
        default: FinancesView(finances: finances)
        }
    }
}

/// A transaction's page, for the newest spending with a payee's logo. On the
/// iPhone it opens over Transactions as a tap does, with its back button (on
/// its own, light-transaction had none); on the iPad, beside Finances' home.
private struct ScreenshotTransaction: View {
    let finances: FinancesViewModel
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif
    @State private var opened = false

    private var shown: FinanceTransaction? {
        finances.ledger?.newestFirst.first(where: { $0.to == nil && $0.amount < 0 && !$0.payee.isEmpty })
    }

    private var overTransactions: Bool {
        #if os(iOS)
        return sizeClass == .compact
        #else
        return false
        #endif
    }

    var body: some View {
        Group {
            if overTransactions {
                TransactionsView(finances: finances)
                    .navigationDestination(isPresented: $opened) {
                        if let t = shown {
                            TransactionDetailView(transaction: t, finances: finances)
                        }
                    }
            } else if let t = shown {
                TransactionDetailView(transaction: t, finances: finances)
            } else {
                ProgressView()
            }
        }
        .task {
            if finances.plan == nil { await finances.loadPlan() }
            await finances.loadLedger()
            opened = shown != nil
        }
    }
}
#endif

/// Over Finances while the Homelab doesn't answer: when what's shown was
/// read, and that nothing changes until it answers again.
struct OfflineBanner: View {
    let asOf: Date

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "wifi.slash")
                .foregroundStyle(Theme.secondaryInk)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: OfflineFinances.asOf(asOf))
                    .font(.subheadline.weight(.semibold))
                Text(FinanceProjection.available
                     ? "The Homelab isn't answering, so this device works out today's Finances from the last ones it read. Nothing can be changed until it answers again."
                     : "The Homelab isn't answering, so these are the last Finances read on this device. Nothing can be changed until it answers again.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
