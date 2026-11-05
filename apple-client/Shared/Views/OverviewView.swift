import Charts
import SwiftUI

/// The cards beside Status: the watchdog, protection, recent alerts and
/// savings. On iPhone it's pushed from the dashboard. On Mac and iPad it's
/// the Overview item in the sidebar.
struct OverviewView: View {
    let cards: CardsViewModel
    let finances: FinancesViewModel

    var body: some View {
        Form {
            if finances.canSeeMoney {
                MoneySection(finances: finances)
            }
            ForEach(cards.shown) { card in
                CardSection(card: card)
            }
            if let error = cards.error {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            }
        }
        .formStyle(.grouped)
        .overlay {
            if cards.shown.isEmpty {
                if cards.isLoading {
                    ProgressView("Reading the cards…")
                } else if cards.error == nil {
                    ContentUnavailableView("No Cards", systemImage: "rectangle.stack")
                }
            }
        }
        .refreshable {
            async let money: Void = finances.load()
            await cards.load()
            await money
        }
        .task { await finances.load() }
        .navigationTitle("Overview")
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
                ForEach(money.bills) { bill in
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
    let summary: WatchdogSummary

    var body: some View {
        if let lastRun = summary.lastRun {
            if summary.failing.isEmpty {
                Label(summary.checks == 1 ? "The check passes" : "All \(summary.checks) checks pass", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
            } else {
                Label("\(summary.failing.count) failing", systemImage: "xmark.seal.fill")
                    .foregroundStyle(.red)
                    .font(.headline)
                ForEach(summary.failing) { failure in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(failure.name).fontWeight(.semibold)
                        Text(failure.problem)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                        Text("Since \(failure.since, format: .relative(presentation: .named))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
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

// MARK: - Protection

private struct ProtectionCard: View {
    let protection: Protection

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(
                protection.enforced ? "Blocking attackers" : "Not blocking yet",
                systemImage: protection.enforced ? "checkmark.shield.fill" : "exclamationmark.shield.fill"
            )
            .foregroundStyle(protection.enforced ? .green : .orange)
            if !protection.bouncer.isEmpty {
                Text(protection.bouncer)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        LabeledContent("Alerts this week", value: protection.week.formatted())
        LabeledContent("Banned now", value: protection.bannedNow.formatted())
        ForEach(protection.recent) { attack in
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
                            .foregroundStyle(.red)
                    }
                }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

// MARK: - Alerts

private struct AlertsCard: View {
    let events: [AlertEvent]

    var body: some View {
        if events.isEmpty {
            Label("No alerts in the last 12 hours", systemImage: "bell.slash")
                .foregroundStyle(.secondary)
        } else {
            ForEach(events.prefix(8)) { event in
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        if event.isUrgent {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundStyle(.red)
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
            if charted.count > 1 {
                Chart(charted) { point in
                    AreaMark(x: .value("Day", point.day), y: .value("Per year", point.annual))
                        .foregroundStyle(.green.opacity(0.15))
                    LineMark(x: .value("Day", point.day), y: .value("Per year", point.annual))
                        .foregroundStyle(.green)
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
