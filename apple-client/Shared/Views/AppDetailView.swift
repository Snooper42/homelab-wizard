import SwiftUI

struct AppDetailView: View {
    @ScaledMetric(relativeTo: .title2) private var iconSize: CGFloat = 52
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    /// Nil when the app left the status (uninstalled meanwhile).
    let app: AppStatus?

    var body: some View {
        if let app {
            Form {
                Section {
                    HStack(spacing: 14) {
                        AppIconView(app: app, size: iconSize)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(app.name)
                                .font(.title2.bold())
                            Text(app.detailLine)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                aboutSection(for: app)

                actionsSection(for: app)

                weekSection(for: app)

                if let problem = app.notAnswering, !problem.isEmpty {
                    Section("Problem") {
                        Label("The container runs, but the app doesn't answer: \(problem)", systemImage: "bolt.horizontal.circle")
                            .foregroundStyle(.orange)
                    }
                }

                Section("Details") {
                    LabeledContent("State", value: app.stateLabel)
                    if let health = app.health, !health.isEmpty {
                        LabeledContent("Health", value: health.capitalized)
                    }
                    if app.isRunning, let started = app.startedAt {
                        LabeledContent("Started") {
                            Text(started, format: .relative(presentation: .named))
                        }
                        if let why = app.startedWords {
                            Text(why).font(.callout).foregroundStyle(.secondary)
                        }
                    }
                    if let updated = app.updatedAt.flatMap(GoTime.parse) {
                        LabeledContent("Updated") {
                            Text(updated, format: .relative(presentation: .named))
                        }
                    }
                    if let restarts = app.restarts, restarts > 0 {
                        LabeledContent("Restarts", value: restarts.formatted())
                    }
                    if let container = app.container, !container.isEmpty {
                        LabeledContent("Container") {
                            Text(container).textSelection(.enabled)
                        }
                    }
                    if let drive = app.waitingFor, !drive.isEmpty {
                        LabeledContent("Waiting for drive", value: drive)
                    }
                }

                if app.address != nil || app.url != nil {
                    Section("Addresses") {
                        if let address = app.address, let url = Self.httpsURL(address) {
                            Link(destination: url) {
                                LabeledContent("Homelab domain", value: address)
                            }
                        }
                        if let local = app.url, !local.isEmpty {
                            LabeledContent("On the computer") {
                                Text(local).textSelection(.enabled)
                            }
                        }
                    }
                }

                if app.hasLogs {
                    Section {
                        Button {
                            dashboard.logsApp = app
                        } label: {
                            Label("Logs", systemImage: "doc.text")
                        }
                    }
                }

                settingsSection(for: app)

                if app.settingsChanged == true {
                    Section("Notes") {
                        Label("Settings changed. It keeps the old ones until it's recreated.", systemImage: "gearshape.arrow.triangle.2.circlepath")
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(app.name)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
        } else {
            ContentUnavailableView("App Not Found", systemImage: "questionmark.app", description: Text("It's no longer in the status."))
        }
    }

    @ViewBuilder
    private func actionsSection(for app: AppStatus) -> some View {
        let available = actions.available(for: app)
        let pending = actions.pending[app.id]
        let hint = actions.lookOnlyHint(for: app)
        if !available.isEmpty || pending != nil || hint != nil {
            Section {
                if let pending {
                    PendingActionLine(app: app, pending: pending)
                    if pending.failure != nil {
                        Button("Dismiss") { actions.dismissFailure(for: app) }
                    }
                }
                ForEach(available) { action in
                    Button(role: action.needsConfirmation ? .destructive : nil) {
                        actions.request(action, on: app)
                    } label: {
                        Label(action.title, systemImage: action.systemImage)
                    }
                    .disabled(actions.isBusy)
                }
                if available.contains(.stop) {
                    StopForAWhileMenu(app: app)
                }
            } header: {
                Text("Actions")
            } footer: {
                if let hint {
                    Text(hint)
                } else if available.contains(.stop) {
                    Text("Stopped for a while, it starts again by itself.")
                }
            }
        }
    }

    /// The watchdog's week for this app, as the computer shows it on hover.
    @ViewBuilder
    private func weekSection(for app: AppStatus) -> some View {
        if let watchdog = dashboard.cards.watchdog, let share = watchdog.week[app.id] {
            let outages = watchdog.outages[app.id] ?? []
            Section {
                LabeledContent("Up this week") {
                    Text(share, format: .percent.precision(.fractionLength(0...1)))
                        .foregroundStyle(share < 0.99 ? .orange : .secondary)
                }
                ForEach(outages.reversed()) { outage in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(outage.from, format: .dateTime.weekday(.abbreviated).hour().minute())
                            Spacer()
                            Text(outage.to == nil
                                 ? "Down \(Self.lasted(outage.duration())) now"
                                 : Self.lasted(outage.duration()))
                                .foregroundStyle(outage.to == nil ? .red : .secondary)
                        }
                        .font(.callout)
                        if !outage.problem.isEmpty {
                            Text(outage.problem).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            } header: {
                Text("This Week")
            } footer: {
                Text(outages.isEmpty ? "No outages this week. The watchdog checks it every 15 minutes." : "The watchdog checks it every 15 minutes.")
            }
        }
    }

    private static func lasted(_ seconds: TimeInterval) -> String {
        Duration.seconds(max(60, seconds)).formatted(.units(allowed: [.days, .hours, .minutes], width: .abbreviated, maximumUnitCount: 2))
    }

    @ViewBuilder
    private func aboutSection(for app: AppStatus) -> some View {
        if let entry = dashboard.catalog?.entry(app.id) {
            Section("About") {
                if !entry.description.isEmpty {
                    Text(entry.description)
                }
                if let category = dashboard.catalog?.categoryLabel(entry.category), !category.isEmpty {
                    LabeledContent("Category", value: category)
                }
                if !entry.replaces.isEmpty {
                    LabeledContent("Instead of") {
                        Text(entry.replaces.joined(separator: ", ")).multilineTextAlignment(.trailing)
                    }
                }
                if let phone = entry.phone, !phone.isEmpty {
                    LabeledContent("Phone app", value: phone)
                }
                if entry.isPublic {
                    Label("Reachable from the internet, not only at home.", systemImage: "globe")
                        .foregroundStyle(.orange)
                }
                if let warning = entry.warning, !warning.isEmpty {
                    Label(warning, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            }
        }
    }

    @ViewBuilder
    private func settingsSection(for app: AppStatus) -> some View {
        let settings = AppSetting.available(for: app)
        if !settings.isEmpty {
            Section {
                ForEach(settings) { setting in
                    Toggle(isOn: Binding(
                        get: { actions.value(of: setting, for: app) },
                        set: { on in Task { await actions.set(setting, on: on, for: app) } }
                    )) {
                        HStack {
                            Text(setting.title)
                            if actions.isSaving(setting, for: app) {
                                ProgressView().controlSize(.mini)
                            }
                        }
                    }
                    .disabled(!actions.canChange || actions.isBusy)
                }
                if let error = actions.settingErrors[app.id] {
                    Text(error).font(.callout).foregroundStyle(.red)
                }
            } header: {
                Text("Settings")
            } footer: {
                if !actions.canChange {
                    Text("This device can only look.")
                } else if app.held == true {
                    Text("Its updates are held, for example after a rollback. Turn Update nightly on to let the nightly update include it again.")
                }
            }
        }
    }

    /// Only https links open. The address may come without a scheme.
    private static func httpsURL(_ address: String) -> URL? {
        let text = address.contains("://") ? address : "https://" + address
        guard let url = URL(string: text), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }
}
