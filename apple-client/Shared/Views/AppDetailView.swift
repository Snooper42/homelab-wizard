import SwiftUI

struct AppDetailView: View {
    @ScaledMetric(relativeTo: .title2) private var iconSize: CGFloat = 52
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(HomelabTasksViewModel.self) private var tasks
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

                // What's wrong first, then what can be done, then the rest.
                if let problem = app.notAnswering, !problem.isEmpty {
                    Section("Problem") {
                        Label("The container runs, but the app doesn't answer: \(problem)", systemImage: "bolt.horizontal.circle")
                            .foregroundStyle(.orange)
                    }
                } else if app.state == "stopped", let stop = app.stoppedOnPurpose, stop.keptRestarting {
                    Section("Problem") {
                        Label(stop.words(), systemImage: "arrow.triangle.2.circlepath.circle")
                            .foregroundStyle(.red)
                        Text("Docker kept restarting it, so the watchdog stopped it and left it stopped. Its log says why. Start it once that's fixed.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }

                actionsSection(for: app)

                weekSection(for: app)

                aboutSection(for: app)

                stoppedSection(for: app)

                backupSection(for: app)

                updatesSection(for: app)

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
                    if let restarts = app.restarts, restarts > 0 {
                        LabeledContent("Restarts", value: restarts.formatted())
                    }
                    if let container = app.container, !container.isEmpty {
                        LabeledContent("Container") {
                            Text(container).textSelection(.enabled)
                        }
                    }
                    if let drive = app.waitingFor, !drive.isEmpty {
                        LabeledContent("Waiting for drive", value: AppStatus.driveName(drive))
                        Text("It starts by itself within a minute of the drive being plugged in again.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }

                if app.address != nil || app.url != nil {
                    Section {
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
                    } header: {
                        Text("Addresses")
                    } footer: {
                        Text(Self.reach(isPublic: dashboard.catalog?.entry(app.id)?.isPublic == true,
                                        hasAddress: !(app.address ?? "").isEmpty))
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

    /// The proxy's and CrowdSec's pages: what CrowdSec stopped today
    /// (main #430), from the Protection card the dashboard already holds.
    static let guardApps: Set<String> = ["nginx-proxy-manager", "crowdsec"]

    @ViewBuilder
    private func stoppedSection(for app: AppStatus) -> some View {
        if Self.guardApps.contains(app.id), let protection = dashboard.cards.protection {
            Section {
                if !protection.enforced {
                    Label("Bans aren't reaching the proxy. \(protection.bouncer)", systemImage: "exclamationmark.shield.fill")
                        .foregroundStyle(.red)
                }
                if protection.today.isEmpty {
                    Text(protection.week == 0 ? "Nothing this week." : "Nothing yet today; \(protection.week) this week.")
                        .foregroundStyle(.secondary)
                } else {
                    StoppedToday(protection: protection)
                }
            } header: {
                Text("What CrowdSec Stopped Today")
            } footer: {
                if protection.todayCount > 0 {
                    Text(protection.bannedNow > 0 ? "\(protection.todayCount) today · \(protection.bannedNow) banned now" : "\(protection.todayCount) today")
                }
            }
        }
    }

    /// The app page's Updates card (web/src/page/AppPage.tsx): the version
    /// it runs, when it came, and whether its updates are held.
    @ViewBuilder
    private func updatesSection(for app: AppStatus) -> some View {
        let updated = app.updatedAt.flatMap(GoTime.parse)
        if !app.isNative, updated != nil || app.held == true {
            Section("Updates") {
                if let updated {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("The version it runs now")
                        Text("Updated \(updated, format: .relative(presentation: .named)); the one before is kept for a week, for Roll back.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                }
                if app.held == true {
                    VStack(alignment: .leading, spacing: 2) {
                        Label("Its updates are held", systemImage: "pause.circle")
                            .foregroundStyle(.orange)
                        Text("After a rollback, the nightly update leaves it out. Nightly updates, under Settings, puts it back.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    /// The app page's Last backup tile and "In the nightly backup" row
    /// (web/src/page/AppPage.tsx), from the Backups the dashboard holds.
    @ViewBuilder
    private func backupSection(for app: AppStatus) -> some View {
        let backups = dashboard.backups
        Section {
            if app.isNative {
                Text("It runs on its own, outside the homelab; its own app keeps its data.")
                    .foregroundStyle(.secondary)
            } else if let overview = backups.overview {
                LabeledContent("Last nightly backup") {
                    if let last = overview.lastRun {
                        HStack(spacing: 4) {
                            Text(last, format: .relative(presentation: .named))
                            if overview.isLate() {
                                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                                    .accessibilityLabel("Late")
                            }
                        }
                    } else {
                        Text("Not yet").foregroundStyle(.secondary)
                    }
                }
                if let copy = overview.copy(for: app.id) {
                    LabeledContent("Its database's copy") {
                        if let drive = copy.waitingFor, !drive.isEmpty {
                            Text("Waiting for the \(AppStatus.driveName(drive)) drive")
                        } else if let newest = copy.newest {
                            Text(newest, format: .relative(presentation: .named))
                        } else {
                            Text("None yet").foregroundStyle(.secondary)
                        }
                    }
                    if copy.shrank {
                        Label("Less than half the night before's \(copy.before.formatted(.byteCount(style: .memory))): check that \(app.name) still has its data.",
                              systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                    }
                    Text("Its files, and its database's copy, every night.")
                        .font(.callout).foregroundStyle(.secondary)
                } else {
                    Text("Its files in the homelab folder, every night.")
                        .font(.callout).foregroundStyle(.secondary)
                }
                LabeledContent("Restore test") {
                    if let tested = overview.restoreTest.lastTest {
                        Text(tested, format: .dateTime.month(.abbreviated).day())
                    } else {
                        Text("None yet").foregroundStyle(.secondary)
                    }
                }
                // As the computer's More card: the whole nightly backup, now.
                if tasks.canRun {
                    TaskButton(task: .backup)
                }
            } else if let error = backups.overviewError {
                Text(error).foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        } header: {
            Text("Backup")
        }
        // Read once if nothing has yet (the morning or the Backups screen may have).
        .task { if backups.overview == nil, !backups.isLoading { await backups.load() } }
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
                // Others installed here that do much the same job (main #438).
                let installed = Set((dashboard.liveEvents.status?.apps ?? [])
                    .filter { $0.state == "running" || $0.state == "stopped" }.map(\.id))
                ForEach(dashboard.catalog?.sameJob(as: app.id, among: installed) ?? []) { pair in
                    Label("You also run \(pair.name), which does much the same: \(pair.why)", systemImage: "square.on.square")
                        .foregroundStyle(.secondary)
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
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(setting.title)
                                if actions.isSaving(setting, for: app) {
                                    ProgressView().controlSize(.mini)
                                }
                            }
                            Text(setting.detail(on: actions.value(of: setting, for: app)))
                                .font(.caption)
                                .foregroundStyle(.secondary)
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
                // Held updates are explained under Updates, above.
                if !actions.canChange {
                    Text("This device can only look.")
                }
            }
        }
    }

    /// Where it can be reached from, as the computer's Address tile says it.
    nonisolated static func reach(isPublic: Bool, hasAddress: Bool) -> String {
        if isPublic { return "At home, and on the internet through the Cloudflare Tunnel." }
        if hasAddress { return "At home and on your tailnet, not on the internet." }
        return "On this machine only."
    }

    /// Only https links open. The address may come without a scheme.
    static func httpsURL(_ address: String) -> URL? {
        let text = address.contains("://") ? address : "https://" + address
        guard let url = URL(string: text), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }
}
