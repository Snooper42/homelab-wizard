import SwiftUI

struct AppRowView: View {
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(\.dynamicTypeSize) private var typeSize
    /// Follows the person's text size, up to a point: at the largest sizes
    /// the words need the room more than the icon does.
    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 32
    let app: AppStatus

    /// At the accessibility text sizes the badges go under the name, and the
    /// detail line may wrap, so nothing is cut off.
    private var large: Bool { typeSize.isAccessibilitySize }

    var body: some View {
        HStack(spacing: 12) {
            AppIconView(app: app, size: min(iconSize, 56))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(app.name)
                    if let note = dashboard.changeNote(for: app) {
                        Circle()
                            .fill(.tint)
                            .frame(width: 7, height: 7)
                            .accessibilityLabel(note)
                            .help(note)
                    }
                }
                if let pending = actions.pending[app.id] {
                    PendingActionLine(app: app, pending: pending)
                        .font(.caption)
                } else {
                    Text(app.detailLine)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(large ? 4 : 1)
                }
                if large {
                    HStack(spacing: 6) { badges }
                }
            }
            Spacer(minLength: 0)
            if !large { badges }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var badges: some View {
        if let uptime = dashboard.cards.watchdog?.uptimeLabel(for: app.id) {
            Text(uptime.replacingOccurrences(of: " this week", with: ""))
                .font(.caption2.monospacedDigit())
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.orange.opacity(0.15), in: Capsule())
                .foregroundStyle(.orange)
                .accessibilityLabel(uptime)
        }
        if let restarts = app.restarts, restarts > 0 {
            Label("\(restarts)", systemImage: "arrow.counterclockwise")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .labelStyle(.titleAndIcon)
                .accessibilityLabel("\(restarts) restarts")
        }
    }
}

/// The app's own icon with its state as a badge, or the state symbol
/// alone while there's no icon.
struct AppIconView: View {
    @Environment(IconStore.self) private var icons
    let app: AppStatus
    let size: CGFloat

    var body: some View {
        if let icon = icons.icon(for: app) {
            Image(decorative: icon.image, scale: 1)
                .resizable()
                .interpolation(.high)
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
                .overlay(alignment: .bottomTrailing) {
                    AppStateIcon(app: app)
                        .font(.system(size: size * 0.42))
                        .background(Circle().fill(.background).padding(1))
                        .offset(x: size * 0.12, y: size * 0.12)
                }
                .accessibilityHidden(true)
        } else {
            AppStateIcon(app: app)
                .font(.system(size: size * 0.75))
                .frame(width: size, height: size)
        }
    }
}

struct AppStateIcon: View {
    let app: AppStatus

    var body: some View {
        Image(systemName: app.symbolName)
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(app.tint)
            .accessibilityHidden(true)
    }
}

struct ConnectionBadge: View {
    let state: LiveEventManager.ConnectionState

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(state.label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Connection: \(state.label)")
    }

    private var color: Color {
        switch state {
        case .live: .green
        case .connecting, .reconnecting: .yellow
        case .idle: .gray
        case .stopped: .red
        }
    }
}

// MARK: - Presentation

extension AppStatus {
    /// Why it last started, in the computer's words (web/src/status/AppList.tsx).
    var startedWords: String? {
        switch startedBy {
        case "you": "You started it"
        case "updated": "You updated it, so it started on its new version"
        case "nightly": "The nightly update moved it to its new version"
        case "update": "It was updated, and started on its new version"
        case "fix": "Fix it restarted it"
        case "watchdog": "The watchdog restarted it: it was unwell on two checks in a row"
        case "battery": "It started again when the power came back (the battery saver had paused it)"
        case "drive": "It started once its drive was plugged in again"
        case "timer": "It started again at the time you set when you stopped it"
        case "docker": "Docker started it again after it stopped on its own; its log says why"
        default: nil
        }
    }

    var stateLabel: String {
        switch state {
        case "running": "Running"
        case "stopped": "Stopped"
        case "elsewhere": "Running elsewhere"
        case "missing": "Missing"
        case "not running": "Not running"
        default: state.capitalized
        }
    }

    /// One line explaining the state, the most urgent part first.
    var detailLine: String {
        if let problem = notAnswering, !problem.isEmpty { return "Not answering: \(problem)" }
        if let drive = waitingFor, !drive.isEmpty { return "Waiting for \(drive)" }
        if state == "stopped", let stop = stoppedOnPurpose { return stop.words() }
        switch health {
        case "restarting": return "Crash loop"
        case "unhealthy": return "Unhealthy"
        case "starting": return "Starting"
        default: return stateLabel
        }
    }

    var symbolName: String {
        if needsAttention { return "exclamationmark.triangle.fill" }
        if health == "starting" { return "hourglass.circle.fill" }
        switch state {
        case "running": return "checkmark.circle.fill"
        case "elsewhere": return "arrow.up.forward.circle.fill"
        default: return "stop.circle.fill"
        }
    }

    var tint: Color {
        if needsAttention { return health == "restarting" || health == "unhealthy" ? .red : .orange }
        if health == "starting" { return .yellow }
        switch state {
        case "running": return .green
        case "elsewhere": return .blue
        default: return .secondary
        }
    }
}
