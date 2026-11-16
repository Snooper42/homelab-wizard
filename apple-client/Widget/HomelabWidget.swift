import SwiftUI
import WidgetKit

// The Home Screen (iPhone, iPad) and desktop (Mac) widget: "All well" or
// how many apps need a look, and when that was read. It reads only the line
// the unlocked app left in the shared App Group (WidgetSummaryStore); it has
// no token and asks the network nothing. Off until turned on in the app
// (Settings › This Device). Built only with HOMELAB_WIDGET=1.

struct HealthEntry: TimelineEntry, Sendable {
    let date: Date
    let summary: WidgetSummary?
    let enabled: Bool
}

struct HealthProvider: TimelineProvider {
    func placeholder(in context: Context) -> HealthEntry {
        HealthEntry(date: Date(), summary: WidgetSummary(needALook: 0, at: Date()), enabled: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (HealthEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : current())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HealthEntry>) -> Void) {
        // The app asks for a redraw when the line changes; this only keeps
        // "read 2 hours ago" honest in between.
        completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(30 * 60))))
    }

    private func current() -> HealthEntry {
        HealthEntry(date: Date(), summary: WidgetSummaryStore.load(), enabled: WidgetSummaryStore.isEnabled)
    }
}

struct HealthWidgetView: View {
    let entry: HealthEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        case .accessoryInline: inline
        default: tile
        }
    }

    private var symbol: String {
        guard let summary = entry.summary, entry.enabled else { return "server.rack" }
        return summary.needALook == 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
    }

    /// On the Lock Screen, round: a tick, or how many need a look.
    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let summary = entry.summary, entry.enabled, summary.needALook > 0 {
                VStack(spacing: 0) {
                    Image(systemName: "exclamationmark.triangle.fill").font(.caption2)
                    Text(summary.needALook, format: .number).font(.title3.weight(.bold))
                }
                .privacySensitive()
            } else {
                Image(systemName: symbol).font(.title2.weight(.semibold)).privacySensitive()
            }
        }
        .widgetAccentable()
        .containerBackground(for: .widget) { Color.clear }
    }

    /// On the Lock Screen, a line or two.
    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label("Homelab", systemImage: "server.rack")
                .font(.caption2.weight(.semibold))
                .widgetAccentable()
            if let summary = entry.summary, entry.enabled {
                Group {
                    Text(summary.words).font(.headline)
                    (Text(summary.at, style: .relative) + Text(" ago")).font(.caption2)
                }
                .privacySensitive()
            } else {
                Text(entry.enabled ? "Open Homelab" : "Turn on in Homelab").font(.caption)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { Color.clear }
    }

    /// Above the clock, in a few words.
    private var inline: some View {
        Label(entry.enabled ? (entry.summary?.words ?? "Open Homelab") : "Homelab", systemImage: symbol)
            .privacySensitive()
            .containerBackground(for: .widget) { Color.clear }
    }

    private var tile: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "server.rack")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 22, height: 22)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                Text("Homelab")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            if !entry.enabled {
                Text("Turn on in Homelab › Settings › This Device.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if let summary = entry.summary {
                // Hidden while the device is locked (StandBy, a locked Mac's desktop).
                Group {
                    Label(summary.words, systemImage: summary.needALook == 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .font(.headline)
                        .foregroundStyle(summary.needALook == 0 ? Theme.success : Theme.warning)
                    (Text("Read ") + Text(summary.at, style: .relative) + Text(" ago"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .privacySensitive()
            } else {
                Text("Open Homelab to read it.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { Theme.surface }
    }
}

struct HealthWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HomelabHealth", provider: HealthProvider()) { entry in
            HealthWidgetView(entry: entry)
        }
        .configurationDisplayName("Homelab")
        .description("All well, or how many apps need a look. No app names.")
        #if os(iOS)
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
        #else
        .supportedFamilies([.systemSmall])
        #endif
    }
}

// The money widget (the owner's pick, Nov 16: words only): how Finances
// stands until the next payday and when the next bill comes, never an
// amount. It reads only the words the unlocked app left (MoneyLineStore).

struct MoneyEntry: TimelineEntry, Sendable {
    let date: Date
    let line: MoneyLine?
    let enabled: Bool
}

struct MoneyProvider: TimelineProvider {
    func placeholder(in context: Context) -> MoneyEntry {
        MoneyEntry(date: Date(), line: MoneyLine(title: "On track until Nov 19", warns: false, next: "Next bill tomorrow", at: Date()), enabled: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (MoneyEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : current())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MoneyEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(30 * 60))))
    }

    private func current() -> MoneyEntry {
        MoneyEntry(date: Date(), line: MoneyLineStore.load(), enabled: MoneyLineStore.isEnabled)
    }
}

struct MoneyWidgetView: View {
    let entry: MoneyEntry
    @Environment(\.widgetFamily) private var family

    private var line: MoneyLine? { entry.enabled ? entry.line : nil }

    var body: some View {
        switch family {
        case .accessoryRectangular: rectangular
        case .accessoryInline: inline
        default: tile
        }
    }

    private var symbol: String { line?.warns == true ? "exclamationmark.triangle.fill" : "dollarsign.circle" }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label("Money", systemImage: symbol)
                .font(.caption2.weight(.semibold))
                .widgetAccentable()
            if let line {
                Group {
                    Text(verbatim: line.title).font(.headline).lineLimit(2)
                    if let next = line.next { Text(verbatim: next).font(.caption2) }
                }
                .privacySensitive()
            } else {
                Text(entry.enabled ? "Open Finances" : "Turn on in Homelab").font(.caption)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { Color.clear }
    }

    private var inline: some View {
        Label(line?.title ?? "Homelab money", systemImage: symbol)
            .privacySensitive()
            .containerBackground(for: .widget) { Color.clear }
    }

    private var tile: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("MONEY")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer(minLength: 0)
            if !entry.enabled {
                Text("Turn on in Homelab › Settings › This Device.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if let line {
                Group {
                    Text(verbatim: line.title)
                        .font(.headline)
                        .foregroundStyle(line.warns ? Theme.warning : Theme.ink)
                        .lineLimit(3)
                        .minimumScaleFactor(0.8)
                    if let next = line.next {
                        Text(verbatim: next)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .privacySensitive()
            } else {
                Text("Open Finances to read it.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { Theme.surface }
    }
}

struct MoneyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HomelabMoney", provider: MoneyProvider()) { entry in
            MoneyWidgetView(entry: entry)
        }
        .configurationDisplayName("Homelab Money")
        .description("How Finances stands until payday, and when the next bill comes. In words, never an amount.")
        #if os(iOS)
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
        #else
        .supportedFamilies([.systemSmall])
        #endif
    }
}

// The medium widget (the owner's pick, Nov 16, on the canvas): the
// homelab's line and the money's words side by side, each half only if
// that one is turned on; the left opens Status, the right Finances. No app
// names, never an amount, as the small ones.

struct BothEntry: TimelineEntry, Sendable {
    let date: Date
    let health: HealthEntry
    let money: MoneyEntry
}

struct BothProvider: TimelineProvider {
    func placeholder(in context: Context) -> BothEntry {
        BothEntry(date: Date(), health: HealthProvider().placeholder(in: context), money: MoneyProvider().placeholder(in: context))
    }

    func getSnapshot(in context: Context, completion: @escaping (BothEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : current())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BothEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(30 * 60))))
    }

    private func current() -> BothEntry {
        let now = Date()
        return BothEntry(date: now,
                         health: HealthEntry(date: now, summary: WidgetSummaryStore.load(), enabled: WidgetSummaryStore.isEnabled),
                         money: MoneyEntry(date: now, line: MoneyLineStore.load(), enabled: MoneyLineStore.isEnabled))
    }
}

struct BothWidgetView: View {
    let entry: BothEntry

    var body: some View {
        HStack(spacing: 0) {
            Link(destination: URL(string: "homelab://status")!) { health }
            Divider().padding(.vertical, 4)
            Link(destination: URL(string: "homelab://finances")!) { money }
        }
        .containerBackground(for: .widget) { Theme.surface }
    }

    private func half<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer(minLength: 0)
            content()
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var health: some View {
        half("HOMELAB") {
            if !entry.health.enabled {
                Text("Turn on the widget in Homelab › Settings.").font(.caption).foregroundStyle(.secondary)
            } else if let summary = entry.health.summary {
                Group {
                    Label(summary.words, systemImage: summary.needALook == 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .font(.headline)
                        .foregroundStyle(summary.needALook == 0 ? Theme.success : Theme.warning)
                        .lineLimit(2)
                    (Text("Read ") + Text(summary.at, style: .relative) + Text(" ago"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .privacySensitive()
            } else {
                Text("Open Homelab to read it.").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var money: some View {
        half("MONEY") {
            if !entry.money.enabled {
                Text("Turn on the money widget in Homelab › Settings.").font(.caption).foregroundStyle(.secondary)
            } else if let line = entry.money.line {
                Group {
                    Text(verbatim: line.title)
                        .font(.headline)
                        .foregroundStyle(line.warns ? Theme.warning : Theme.ink)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                    if let next = line.next {
                        Text(verbatim: next).font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .privacySensitive()
            } else {
                Text("Open Finances to read it.").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

struct BothWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HomelabBoth", provider: BothProvider()) { entry in
            BothWidgetView(entry: entry)
        }
        .configurationDisplayName("Homelab and Money")
        .description("The homelab's line and the money's words side by side. No app names, never an amount.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct HomelabWidgetBundle: WidgetBundle {
    var body: some Widget {
        HealthWidget()
        MoneyWidget()
        BothWidget()
    }
}
