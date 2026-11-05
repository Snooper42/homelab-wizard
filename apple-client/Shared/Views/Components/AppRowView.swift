import SwiftUI

struct AppRowView: View {
    @Environment(AppActionsViewModel.self) private var actions
    let app: AppStatus

    var body: some View {
        HStack(spacing: 12) {
            AppStateIcon(app: app)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(app.name)
                if let pending = actions.pending[app.id] {
                    PendingActionLine(app: app, pending: pending)
                        .font(.caption)
                } else {
                    Text(app.detailLine)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if let restarts = app.restarts, restarts > 0 {
                Label("\(restarts)", systemImage: "arrow.counterclockwise")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .labelStyle(.titleAndIcon)
                    .accessibilityLabel("\(restarts) restarts")
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
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
