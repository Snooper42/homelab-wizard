import SwiftUI

/// Every Alert: what the homelab alerted about in the last 90 days, kept
/// on the computer, each with when its problem cleared or who snoozed it,
/// as the computer's Every alert… lists them.
struct AlertLogView: View {
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(AppActionsViewModel.self) private var actions
    @State private var alerts: [KeptAlert]?
    @State private var problem: String?

    var body: some View {
        List {
            if let problem {
                Text(verbatim: problem).foregroundStyle(.secondary)
            } else if let alerts {
                if alerts.isEmpty {
                    Text("No alerts kept yet. From now on, each one the homelab sends is kept here for 90 days.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(alerts) { alert in
                        KeptAlertRow(alert: alert)
                        // Snooze… on one whose check still fails, as the Watchdog
                        // card has it, where this device may change things.
                        if actions.canSnooze {
                            let watchdog = dashboard.cards.watchdog
                            ForEach(alert.snoozable(in: watchdog), id: \.self) { check in
                                SnoozeMenu(check: check, snoozed: watchdog?.snoozedUntil(check) != nil) { await load() }
                            }
                        }
                    }
                    if let error = actions.snoozeError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(Theme.danger)
                    }
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Every Alert")
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        do {
            alerts = try await dashboard.alertLog()
            problem = nil
        } catch {
            problem = APIError.from(error).errorDescription
        }
    }
}

/// One kept alert: its title, its lines, what became of it, and when.
struct KeptAlertRow: View {
    let alert: KeptAlert

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if alert.clearedAt != nil {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.success)
                        .accessibilityLabel("Cleared")
                } else if alert.isUrgent {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(Theme.danger)
                        .accessibilityLabel("Urgent")
                }
                Text(verbatim: alert.title)
                    .fontWeight(.semibold)
                Spacer(minLength: 0)
                if let at = alert.at {
                    Text(at, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if !alert.body.isEmpty {
                Text(verbatim: alert.body)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(4)
            }
            HStack(spacing: 6) {
                if let fate = alert.fate() {
                    Text(verbatim: fate)
                }
                Text(verbatim: alert.topicName)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}
