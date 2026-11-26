import Charts
import SwiftUI

/// Analytics on Status: Processor, Memory and Drives, the apps' use over time, and what each app uses, heaviest first.
/// The usage card is read again every 15 seconds while it's open; Day, Week and Month are the computer's history.
struct AnalyticsPage: View {
    let model: DashboardViewModel
    @State private var all = false
    @State private var period: UsageSpan = .now
    @Environment(AppActionsViewModel.self) private var actions

    var body: some View {
        let apps = model.liveEvents.status?.apps ?? []
        let now = UsageNow.from(usage: model.cards.json("usage"), storage: model.cards.json("storage"), apps: apps)
        let samples = model.cards.usageSamples
        let span = UsageNow.span(samples)
        let machine = model.cards.machine
        let kept = actions.computerAnswers("UsageHistory")
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if kept {
                    Picker("Over", selection: $period) {
                        ForEach(UsageSpan.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                } else {
                    Text(verbatim: span)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12, alignment: .top)], spacing: 12) {
                    processor(now, samples: samples)
                    memory(now, samples: samples)
                    drives(machine, appsData: now.appsData)
                }
                timeline(timelineSamples(samples), span: period == .now ? span : period.heading, kept: kept)
                uses(now, apps: apps)
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .themedCanvas()
        .navigationTitle("Analytics")
        .task {
            while !Task.isCancelled {
                await model.cards.readUsage()
                try? await Task.sleep(for: .seconds(15))
            }
        }
        // Day, Week or Month: read when picked, and again each time.
        .task(id: period) {
            guard let days = period.days else { return }
            await model.cards.readUsageHistory(days: days)
        }
    }

    /// The timeline's readings: the minutes since it opened, or the computer's kept ones, thinned.
    private func timelineSamples(_ now: [UsageSample]) -> [UsageSample] {
        guard let days = period.days else { return now }
        return model.cards.usageHistory[days]?.thinned() ?? []
    }

    // MARK: The three cards

    private func processor(_ now: UsageNow, samples: [UsageSample]) -> some View {
        OverviewCard(title: "Processor", figure: now.read ? UsageNow.percent(now.processor) + "%" : "—",
                     unit: now.read ? "of a core" : "") {
            if !now.read {
                Text("Not read yet")
            } else if let busiest = now.busiest {
                who(busiest, words: "uses the most · \(UsageNow.percent(busiest.processor))%")
            } else {
                Text("Every app idle")
            }
        } footer: {
            Spark(values: samples.map(\.processor))
        }
    }

    private func memory(_ now: UsageNow, samples: [UsageSample]) -> some View {
        OverviewCard(title: "Memory", figure: now.read ? UsageNow.memory(now.memory) : "—", unit: now.read ? "in use" : "") {
            if let heaviest = now.heaviest {
                who(heaviest, words: "uses the most · \(UsageNow.memory(heaviest.memory))")
            } else {
                Text("Not read yet")
            }
        } footer: {
            Spark(values: samples.map { Double($0.memory) })
        }
    }

    private func drives(_ m: MachineFacts?, appsData: Int64?) -> some View {
        OverviewCard(title: "Drives", trailing: m.map { UsageNow.disk($0.total) } ?? "",
                     figure: m.map { UsageNow.disk($0.free) } ?? "—", unit: m == nil ? "" : "free",
                     tone: m?.low == true ? Theme.danger : nil) {
            if let appsData {
                Text(verbatim: "The apps' data \(UsageNow.disk(appsData))")
            } else if let m {
                Text(verbatim: "\(UsageNow.disk(m.total - m.free)) used")
            } else {
                Text("Not read yet")
            }
        } footer: {
            if let m {
                ProgressView(value: m.usedShare)
                    .tint(Theme.accent)
                    .accessibilityLabel("Drive used")
            }
        }
    }

    /// An app's logo and name, and what it uses.
    private func who(_ row: UsageNow.Row, words: String) -> some View {
        HStack(spacing: 6) {
            if let app = model.app(id: row.id) {
                AppIconView(app: app, size: 20, stateBadge: false)
            }
            Text(verbatim: "\(row.name) \(words)")
                .lineLimit(2)
        }
    }

    // MARK: Over time

    @ViewBuilder
    private func timeline(_ samples: [UsageSample], span: String, kept: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: span)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                if !kept {
                    Text("A week isn't kept yet")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            if samples.count > 2 {
                Text("Processor")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                Chart(samples) { s in
                    AreaMark(x: .value("Time", s.at), y: .value("Processor", s.processor))
                        .foregroundStyle(Theme.accent.opacity(0.15))
                    LineMark(x: .value("Time", s.at), y: .value("Processor", s.processor))
                        .foregroundStyle(Theme.accent)
                }
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
                        AxisGridLine()
                        AxisValueLabel { if let v = value.as(Double.self) { Text(verbatim: "\(Int(v.rounded()))%") } }
                    }
                }
                .frame(height: 110)
                .accessibilityLabel("Processor, \(span.lowercased())")
                Text("Memory")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                Chart(samples) { s in
                    AreaMark(x: .value("Time", s.at), y: .value("Memory", Double(s.memory)))
                        .foregroundStyle(Theme.info.opacity(0.15))
                    LineMark(x: .value("Time", s.at), y: .value("Memory", Double(s.memory)))
                        .foregroundStyle(Theme.info)
                }
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
                        AxisGridLine()
                        AxisValueLabel { if let v = value.as(Double.self) { Text(verbatim: UsageNow.memory(Int64(v))) } }
                    }
                }
                .frame(height: 110)
                .accessibilityLabel("Memory, \(span.lowercased())")
            } else if period != .now, let error = model.cards.usageHistoryError {
                Text(verbatim: error)
                    .font(.subheadline)
                    .foregroundStyle(Theme.danger)
            } else {
                Text(period == .now ? "Reading…" : "None yet")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    // MARK: Each app

    @ViewBuilder
    private func uses(_ now: UsageNow, apps: [AppStatus]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("What each app uses")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer()
                Text("Heaviest first")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            }
            if now.rows.isEmpty {
                Text("Not read yet")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            } else {
                let most = max(1, now.rows.first?.memory ?? 1)
                ForEach(all ? now.rows : Array(now.rows.prefix(8))) { row in
                    if let app = model.app(id: row.id) {
                        NavigationLink(value: StatusPlace.app(row.id)) {
                            UseRow(app: app, row: row, share: Double(row.memory) / Double(most))
                        }
                        .buttonStyle(.plain)
                    }
                    if row.id != (all ? now.rows : Array(now.rows.prefix(8))).last?.id { Divider() }
                }
                if now.rows.count > 8 {
                    Button(all ? "Show Fewer" : "Show All \(now.rows.count)") { withAnimation { all.toggle() } }
                        .font(.subheadline.weight(.semibold))
                        .padding(.top, 4)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }
}

/// One app's use: its logo and name over its memory as a bar, its processor and what its folder takes.
private struct UseRow: View {
    let app: AppStatus
    let row: UsageNow.Row
    let share: Double

    var body: some View {
        HStack(spacing: 12) {
            AppIconView(app: app, size: 32, stateBadge: false)
            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: row.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                HStack(spacing: 8) {
                    ProgressView(value: min(1, max(0.02, share)))
                        .tint(Theme.accent)
                        .frame(maxWidth: 90)
                    Text(verbatim: UsageNow.memory(row.memory))
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(verbatim: UsageNow.percent(row.processor) + "%")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text(verbatim: row.disk.map(UsageNow.disk) ?? "—")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.secondaryInk)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(row.name): \(UsageNow.memory(row.memory)) of memory, \(UsageNow.percent(row.processor))% processor" + (row.disk.map { ", \(UsageNow.disk($0)) on disk" } ?? "")))
    }
}

/// A small line of the samples, scaled to their peak, as the computer's cards draw it.
private struct Spark: View {
    let values: [Double]

    var body: some View {
        if values.count > 2 {
            Chart(Array(values.enumerated()), id: \.offset) { item in
                LineMark(x: .value("When", item.offset), y: .value("Value", item.element))
                    .foregroundStyle(Theme.accent)
                    .interpolationMethod(.monotone)
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: 36)
            .accessibilityHidden(true)
        } else {
            Color.clear.frame(height: 36)
        }
    }
}

/// Analytics' row on the Overview: its symbol, its name, and the processor and memory now.
struct AnalyticsRow: View {
    let model: DashboardViewModel

    var body: some View {
        let now = UsageNow.from(usage: model.cards.json("usage"), storage: nil, apps: [])
        HStack(spacing: 12) {
            Image(systemName: "chart.xyaxis.line")
                .font(.title3)
                .foregroundStyle(Theme.accent)
                .frame(width: 30)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("Analytics")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                if now.read {
                    Text(verbatim: "\(UsageNow.percent(now.processor))% of a core · \(UsageNow.memory(now.memory)) in use")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
