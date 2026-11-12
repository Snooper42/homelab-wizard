import Charts
import SwiftUI

/// The cards under Status's app list, as the computer has them below its
/// table: money (by this device's level), the watchdog, protection,
/// storage, recent alerts, savings and the week. Sections, so they go into
/// Status's own list on every device.
struct StatusCards: View {
    let cards: CardsViewModel
    let finances: FinancesViewModel

    var body: some View {
        if finances.canSeeMoney {
            MoneySection(finances: finances)
        }
        ForEach(cards.shown) { card in
            CardSection(card: card)
        }
        if let error = cards.error {
            Section {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(Theme.warning)
            }
        } else if cards.shown.isEmpty, cards.isLoading {
            Section {
                ProgressView("Reading the cards…")
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

/// The line under a screen's heading, as the computer has one on each.
struct ScreenLead: View {
    let text: String

    var body: some View {
        Section {
            EmptyView()
        } header: {
            Text(verbatim: text)
                .font(.callout)
                .foregroundStyle(.secondary)
                .textCase(nil)
        }
    }
}

/// One card as a form section, with its own title and icon.
struct CardSection: View {
    let card: StatusCard

    var body: some View {
        Section {
            if let error = card.error {
                Text(error)
                    .foregroundStyle(.secondary)
            } else {
                switch card.data {
                case .watchdog(let summary): WatchdogCard(summary: summary)
                case .protection(let protection): ProtectionCard(protection: protection)
                case .alerts(let events): AlertsCard(events: events)
                case .savings(let points): SavingsCard(points: points)
                case .other, nil: Text("This card isn't shown on this device yet.").foregroundStyle(.secondary)
                }
            }
        } header: {
            Label(card.title, systemImage: card.systemImage)
        }
    }
}

extension StatusCard {
    var title: String {
        switch name {
        case "watchdog": "Watchdog"
        case "protection": "Protection"
        case "alerts": "Recent Alerts"
        case "savings": "Savings"
        default: name.capitalized
        }
    }

    var systemImage: String {
        switch name {
        case "watchdog": "stethoscope"
        case "protection": "shield.lefthalf.filled"
        case "alerts": "bell"
        case "savings": "dollarsign.circle"
        default: "rectangle.stack"
        }
    }
}

// MARK: - Money

/// The money card, as a wall screen shows it: the next payday, what's left
/// after it, and the next bills. Amounts stay hidden until tapped.
private struct MoneySection: View {
    @Bindable var finances: FinancesViewModel

    var body: some View {
        Section {
            if let money = finances.money {
                if let payday = money.payday {
                    LabeledContent("Next payday") {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(payday, format: .dateTime.weekday(.wide).month().day())
                            if !money.who.isEmpty {
                                Text(money.who.joined(separator: ", ")).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    LabeledContent("Left after its bills") {
                        amount(money.left, money)
                    }
                } else {
                    Text("No payday ahead in the plan.").foregroundStyle(.secondary)
                }
                // By position: two bills can share a name and a day.
                ForEach(money.bills.indices, id: \.self) { i in
                    let bill = money.bills[i]
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(bill.name)
                            if let date = bill.date {
                                Text(date, format: .dateTime.weekday(.abbreviated).month().day())
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        amount(bill.amount, money)
                    }
                    .accessibilityElement(children: .combine)
                }
                if money.hidden {
                    Label("Hide amounts is on, on the computer.", systemImage: "eye.slash")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            } else if let error = finances.error {
                Text(error).foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        } header: {
            HStack {
                Label("Money", systemImage: "banknote")
                Spacer()
                if let money = finances.money, !money.hidden {
                    Button(finances.amountsShown ? "Hide Amounts" : "Show Amounts") {
                        finances.amountsShown.toggle()
                    }
                    .font(.caption)
                    .buttonStyle(.borderless)
                }
            }
        }
    }

    @ViewBuilder
    private func amount(_ value: Double, _ money: MoneyCard) -> some View {
        if money.hidden || !finances.amountsShown {
            Text(verbatim: "••••")
                .foregroundStyle(.secondary)
                .accessibilityLabel("Amount hidden")
        } else {
            Text(value, format: .currency(code: money.currency))
                .monospacedDigit()
                .privacySensitive()
        }
    }
}

// MARK: - Watchdog

private struct WatchdogCard: View {
    @Environment(AppActionsViewModel.self) private var actions
    let summary: WatchdogSummary

    var body: some View {
        if let memory = summary.memory {
            MemoryPressureView(memory: memory)
        }
        if let lastRun = summary.lastRun {
            if summary.failing.isEmpty {
                Label(summary.checks == 1 ? "The check passes" : "All \(summary.checks) checks pass", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(Theme.success)
            } else {
                Label("\(summary.failing.count) failing", systemImage: "xmark.seal.fill")
                    .foregroundStyle(Theme.danger)
                    .font(.headline)
                ForEach(summary.failing) { failure in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(failure.name).fontWeight(.semibold)
                        Text(failure.problem)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                        // Snoozed on the computer (main #469): still checked, no alerts for now.
                        if let until = summary.snoozedUntil(failure.name) {
                            Label("No alerts about it until \(WatchdogSummary.wakeText(until))", systemImage: "bell.slash")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text("Since \(failure.since, format: .relative(presentation: .named))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                    // Snooze…, as on the computer, where this device may change things.
                    if actions.canSnooze {
                        SnoozeMenu(check: failure.name, snoozed: summary.snoozedUntil(failure.name) != nil)
                    }
                }
                if let error = actions.snoozeError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(Theme.danger)
                }
            }
            if summary.pending > 0 {
                Label("\(summary.pending) to check again on the next run", systemImage: "clock.arrow.circlepath")
                    .foregroundStyle(.secondary)
            }
            if let uptime = summary.weekUptime {
                LabeledContent("Up this week", value: uptime.formatted(.percent.precision(.fractionLength(0...1))))
            }
            LabeledContent("Last run") {
                Text(lastRun, format: .relative(presentation: .named))
            }
        } else {
            Text("The watchdog hasn't run yet.")
                .foregroundStyle(.secondary)
        }
    }
}

/// Snooze… on a failing check: no alerts about it for an hour or a day, for
/// a failure already known of; the watchdog goes on checking it. The card
/// is read again after, so it says until when.
struct SnoozeMenu: View {
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    let check: String
    let snoozed: Bool
    /// What to read again after, besides the cards (Every Alert's list).
    var then: (@MainActor () async -> Void)?

    var body: some View {
        Menu {
            ForEach(WatchdogSummary.snoozeChoices(snoozed: snoozed)) { choice in
                Button(choice.label) {
                    Task {
                        if await actions.snooze(check, hours: choice.hours) {
                            await dashboard.cards.load()
                            await then?()
                        }
                    }
                }
            }
        } label: {
            Label(snoozed ? "Snoozed" : "Snooze…", systemImage: "bell.slash")
                .font(.callout)
        }
        .disabled(actions.isBusy)
        .accessibilityLabel("Snooze the alerts about \(check)")
    }
}

/// Memory nearly full: the biggest apps, each with Stop for a device that
/// may make changes, as the computer's Watchdog card lists them.
private struct MemoryPressureView: View {
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    let memory: MemoryPressure

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Memory nearly full", systemImage: "memorychip.fill")
                .font(.headline)
                .foregroundStyle(Theme.danger)
            Text(summary)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        ForEach(memory.biggest.indices, id: \.self) { i in
            let big = memory.biggest[i]
            HStack {
                AppLogo(id: big.id, size: 22)
                Text(verbatim: big.name)
                Spacer(minLength: 8)
                Text(MemoryPressure.text(big.bytes))
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(.secondary)
                if let app = stoppable(big) {
                    Button("Stop") { actions.request(.stop, on: app) }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .disabled(actions.isBusy)
                        .accessibilityLabel("Stop \(big.name)")
                }
            }
        }
    }

    private var summary: String {
        var words = "The apps use \(memory.percent)% of the \(MemoryPressure.text(memory.total)) Docker has"
        if let since = memory.since {
            words += ", high since \(since.formatted(.relative(presentation: .named)))"
        }
        return words + ". Stop one you don't need now."
    }

    /// The app to stop, when the catalog knows it, it's running here, and
    /// this device may stop it.
    private func stoppable(_ big: MemoryPressure.AppMemory) -> AppStatus? {
        guard let id = big.id, !id.isEmpty, let app = dashboard.app(id: id),
              actions.available(for: app).contains(.stop) else { return nil }
        return app
    }
}

// MARK: - Protection

private struct ProtectionCard: View {
    let protection: Protection

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(
                protection.enforced ? "Blocking attackers" : "Not blocking yet",
                systemImage: protection.enforced ? "checkmark.shield.fill" : "exclamationmark.shield.fill"
            )
            .foregroundStyle(protection.enforced ? Theme.success : Theme.warning)
            if !protection.bouncer.isEmpty {
                Text(protection.bouncer)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        LabeledContent("Alerts this week", value: protection.week.formatted())
        LabeledContent("Banned now", value: protection.bannedNow.formatted())
        if protection.todayCount > 0 {
            DisclosureGroup {
                StoppedToday(protection: protection)
            } label: {
                LabeledContent("Stopped today", value: protection.todayCount.formatted())
            }
        }
        ForEach(protection.recent) { attack in
            AttackRow(attack: attack)
        }
    }
}

/// What CrowdSec stopped since midnight, as the proxy's page lists it
/// (main #430): each attack, then "and N more today".
struct StoppedToday: View {
    let protection: Protection

    var body: some View {
        // By position: one address can try the same thing twice in a second.
        ForEach(protection.today.indices, id: \.self) { i in
            AttackRow(attack: protection.today[i])
        }
        if protection.moreToday > 0 {
            Text(protection.moreToday == 1 ? "and 1 more today" : "and \(protection.moreToday) more today")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// One attack: where it came from, what it tried, when, and whether a ban holds.
struct AttackRow: View {
    let attack: Attack

    var body: some View {
        HStack(spacing: 10) {
            Text(attack.flag ?? "🌐")
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(attack.scenarioWords)
                Text([attack.ip, attack.network].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                Text(attack.when, format: .relative(presentation: .named))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if attack.banned {
                    Label("Banned", systemImage: "lock.fill")
                        .font(.caption2)
                        .foregroundStyle(Theme.danger)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Alerts

private struct AlertsCard: View {
    @Environment(AppActionsViewModel.self) private var actions
    /// Set by the Mac's and iPad's split view: Every Alert opens beside
    /// the list, in the app's place, as a link can't from a list that
    /// selects apps.
    @Environment(\.openAlertLog) private var openAlertLog
    let events: [AlertEvent]

    var body: some View {
        alerts
        // Every alert the computer kept, past ntfy's 12 hours, where it keeps them.
        if actions.computerAnswers("AlertLog") {
            if let openAlertLog {
                Button {
                    openAlertLog()
                } label: {
                    HStack {
                        Text("Every Alert")
                        Spacer()
                        Image(systemName: "chevron.forward")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                NavigationLink {
                    AlertLogView()
                } label: {
                    Text("Every Alert")
                }
            }
        }
    }

    @ViewBuilder private var alerts: some View {
        if events.isEmpty {
            Label("No alerts in the last 12 hours", systemImage: "bell.slash")
                .foregroundStyle(.secondary)
        } else {
            ForEach(events.prefix(8)) { event in
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        if event.isUrgent {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundStyle(Theme.danger)
                                .accessibilityLabel("Urgent")
                        }
                        Text(event.heading)
                            .fontWeight(.semibold)
                        Spacer(minLength: 0)
                        Text(event.time, format: .relative(presentation: .named))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(event.message)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

// MARK: - Savings

private struct SavingsCard: View {
    let points: [SavingsPoint]

    private struct Plotted: Identifiable {
        let day: Date
        let annual: Double
        var id: Date { day }
    }

    private var charted: [Plotted] {
        points.compactMap { p in p.day.map { Plotted(day: $0, annual: p.annual) } }
    }

    var body: some View {
        if let latest = points.last {
            LabeledContent("Replaces each year") {
                Text(latest.annual, format: .currency(code: "USD").precision(.fractionLength(0)))
                    .fontWeight(.semibold)
            }
            let saved = SavedSoFar.from(points)
            if !saved.since.isEmpty {
                DisclosureGroup {
                    ForEach(saved.months.prefix(12)) { month in
                        LabeledContent {
                            Text(month.amount, format: .currency(code: "USD").precision(.fractionLength(0)))
                        } label: {
                            Text(LocalDay.parseMonth(month.month)?.formatted(.dateTime.month(.wide).year()) ?? month.month)
                        }
                    }
                } label: {
                    LabeledContent {
                        Text(saved.total, format: .currency(code: "USD").precision(.fractionLength(0)))
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Saved so far")
                            if let since = LocalDay.parse(saved.since) {
                                Text("Since \(since.formatted(.dateTime.month(.abbreviated).day().year())), from what the apps replace each day")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            if charted.count > 1 {
                Chart(charted) { point in
                    AreaMark(x: .value("Day", point.day), y: .value("Per year", point.annual))
                        .foregroundStyle(Theme.success.opacity(0.15))
                    LineMark(x: .value("Day", point.day), y: .value("Per year", point.annual))
                        .foregroundStyle(Theme.success)
                }
                .chartYAxis {
                    AxisMarks { value in
                        AxisGridLine()
                        AxisValueLabel {
                            if let amount = value.as(Double.self) {
                                Text(amount, format: .currency(code: "USD").precision(.fractionLength(0)))
                            }
                        }
                    }
                }
                .frame(height: 120)
                .accessibilityLabel("Yearly savings over the last \(charted.count) days")
            }
        } else {
            Text("The nightly backup records this. Check back tomorrow.")
                .foregroundStyle(.secondary)
        }
    }
}

extension EnvironmentValues {
    /// Opens Every Alert beside the list (the Mac's and iPad's split view);
    /// nil on the iPhone, where it's a link on the Status tab's stack.
    @Entry var openAlertLog: (@MainActor @Sendable () -> Void)? = nil
}
