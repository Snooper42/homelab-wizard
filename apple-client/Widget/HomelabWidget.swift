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

@main
struct HomelabWidgetBundle: WidgetBundle {
    var body: some Widget {
        HealthWidget()
    }
}
