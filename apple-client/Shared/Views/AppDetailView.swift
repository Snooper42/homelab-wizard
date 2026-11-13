import SwiftUI

struct AppDetailView: View {
    @ScaledMetric(relativeTo: .title2) private var iconSize: CGFloat = 84
    @Environment(\.openURL) private var openURL
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(HomelabTasksViewModel.self) private var tasks
    /// Nil when the app left the status (uninstalled meanwhile).
    let app: AppStatus?
    /// The page itself, kept to what's worth a glance (the owner's mockup,
    /// Nov 8), or everything else about the app behind its More row.
    var page: Page = .main

    enum Page { case main, more }

    var body: some View {
        if let app {
            switch page {
            case .main: mainPage(app)
            case .more: morePage(app)
            }
        } else {
            ContentUnavailableView("App Not Found", systemImage: "questionmark.app", description: Text("It's no longer in the status."))
        }
    }

    /// Everything else: the whole of About, the backup in full, updates,
    /// details, addresses, settings and what CrowdSec stopped.
    private func morePage(_ app: AppStatus) -> some View {
        Form {
            aboutSection(for: app)
            stoppedSection(for: app)
            backupSection(for: app)
            updatesSection(for: app)
            // What was done to it, where the computer keeps that (internal/history).
            if actions.computerAnswers("History") {
                RecentlyDoneSection(app: app)
            }
            detailsSection(for: app)
            addressesSection(for: app)
            // Open on the Computer: the computer's window goes to this app's page.
            if actions.canOpenOnComputer {
                Section {
                    Button("Open on the Computer", systemImage: "desktopcomputer") {
                        Task { await actions.openOnComputer("homelab://app/\(app.id)") }
                    }
                } footer: {
                    if let said = actions.openedOnComputer { Text(verbatim: said) }
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
        .themedCanvas()
        .navigationTitle("More About \(app.name)")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    private func mainPage(_ app: AppStatus) -> some View {
        Form {
            // Its logo big, its name, and its state, centred, then its round buttons.
            Section {
                VStack(spacing: 8) {
                    AppIconView(app: app, size: iconSize)
                        .shadow(color: Design.shadow.opacity(0.14), radius: 12, y: 8)
                    Text(verbatim: app.name)
                        .font(.title2.bold())
                        .multilineTextAlignment(.center)
                    // Its state as a pill in its colour, then the row's own words
                    // when they say more ("Stopped at 3:12 AM: it ran out of memory").
                    // While a Start, Stop or Restart runs, the pill says so with a
                    // spinner, and turns to the new state when Status has it.
                    statePill(for: app)
                    if app.detailLine != app.stateLabel {
                        Text(verbatim: app.detailLine)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    } else if app.isRunning, let since = app.startedAt {
                        Text("Started \(since.formatted(.relative(presentation: .named)))")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .combine)
                roundButtons(for: app)
                    .padding(.top, 10)
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)

            // What's wrong first, then what can be done, then the rest.
            if let problem = app.notAnswering, !problem.isEmpty {
                Section("Problem") {
                    Label("The container runs, but the app doesn't answer: \(problem)", systemImage: "bolt.horizontal.circle")
                        .foregroundStyle(Theme.warning)
                }
            } else if app.state == "stopped", let stop = app.stoppedOnPurpose, stop.keptRestarting {
                Section("Problem") {
                    Label(stop.words(), systemImage: "arrow.triangle.2.circlepath.circle")
                        .foregroundStyle(Theme.danger)
                    Text("Docker kept restarting it, so the watchdog stopped it and left it stopped. Its log says why. Start it once that's fixed.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }

            // Why it isn't running, and what helps (the watchdog's stop is the Problem above).
            if let next = app.stoppedNext(), app.stoppedOnPurpose?.keptRestarting != true {
                Section("Why It's Stopped") {
                    Text(next.why)
                    if !next.todo.isEmpty, actions.canChange {
                        Text(next.todo)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    } else if !next.todo.isEmpty, actions.stoppedOffer(for: app) == .fromComputer {
                        // As the computer's page for a phone: where to start it.
                        Text("\(AppActionsViewModel.StoppedOffer.fromComputer.words): this device can only look.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            actionsSection(for: app)

            weekSection(for: app)

            // A glance: what it's for, its last backup, where it lives;
            // the rest behind More.
            glanceSection(for: app)

            Section {
                NavigationLink {
                    AppDetailView(app: app, page: .more)
                } label: {
                    Label("More About \(app.name)", systemImage: "info.circle")
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle(app.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        // The Backup line, read once if nothing has yet.
        .task { if dashboard.backups.overview == nil, !dashboard.backups.isLoading { await dashboard.backups.load() } }
    }

    /// What it's for in a line, its last backup (and only a problem with it),
    /// and its address: no explanations.
    @ViewBuilder
    private func glanceSection(for app: AppStatus) -> some View {
        let entry = dashboard.catalog?.entry(app.id)
        let backups = dashboard.backups
        let url = app.address.flatMap { Self.httpsURL($0) }
        if let about = entry?.description, !about.isEmpty {
            Section("About") {
                Text(about)
            }
        }
        if !app.isNative, let overview = backups.overview {
            Section("Backup") {
                LabeledContent("Last copy") {
                    if let last = overview.lastRun {
                        HStack(spacing: 4) {
                            Text(last, format: .relative(presentation: .named))
                            if overview.isLate() {
                                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.warning)
                                    .accessibilityLabel("Late")
                            }
                        }
                    } else {
                        Text("Not yet").foregroundStyle(.secondary)
                    }
                }
                if let copy = overview.copy(for: app.id), copy.shrank {
                    Label("Much smaller than the night before: check that \(app.name) still has its data.", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.danger)
                }
            }
        }
        if let url, let address = app.address {
            Section("Address") {
                Link(destination: url) {
                    LabeledContent("Homelab domain", value: address)
                }
            }
        }
    }

    private func detailsSection(for app: AppStatus) -> some View {
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
    }

    @ViewBuilder
    private func addressesSection(for app: AppStatus) -> some View {
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
                                hasAddress: !(app.address ?? "").isEmpty,
                                homeOnly: app.reach == "home"))
            }
        }
    }

    @ViewBuilder
    private func actionsSection(for app: AppStatus) -> some View {
        let available = actions.available(for: app)
        let pending = actions.pending[app.id]
        let hint = actions.lookOnlyHint(for: app) ?? actions.updateHint(for: app)
        let rest = available.filter { !Self.roundActions.contains($0) }
        if !rest.isEmpty || available.contains(.stop) || pending != nil || hint != nil {
            Section {
                if let pending {
                    PendingActionLine(app: app, pending: pending)
                    if pending.failure != nil {
                        Button("Dismiss") { actions.dismissFailure(for: app) }
                    }
                }
                // Start, Stop and Restart are the round buttons up top; the rest here.
                ForEach(available.filter { !Self.roundActions.contains($0) }) { action in
                    Button(role: action.needsConfirmation ? .destructive : nil) {
                        actions.request(action, on: app)
                    } label: {
                        Label(action.title, systemImage: action.systemImage)
                    }
                    .disabled(actions.isBusy)
                }
                if available.contains(.stop), actions.canStopForAWhile {
                    StopForAWhileMenu(app: app)
                }
            } header: {
                if !rest.isEmpty || pending != nil { Text("Actions") }
            } footer: {
                if let hint {
                    Text(hint)
                } else if available.contains(.stop) {
                    Text("Stopped for a while, it starts again by itself.")
                }
            }
        }
    }

    /// The state, or what's being done to it: "Restarting…" with a spinner
    /// in blue until Status shows the result, then the new state, with a
    /// tap you can feel (a buzz when it failed).
    private func statePill(for app: AppStatus) -> some View {
        let pending = actions.pending[app.id]
        let working = pending != nil && pending?.failure == nil
        return ZStack {
            if let pending, working {
                HStack(spacing: 5) {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(Theme.info)
                    Text(pending.action.progressTitle)
                }
                .pill(Theme.info)
                .transition(.blurReplace)
            } else {
                Label(app.stateLabel, systemImage: app.symbolName)
                    .labelStyle(.titleAndIcon)
                    .contentTransition(.symbolEffect(.replace))
                    .pill(app.tint)
                    .transition(.blurReplace)
            }
        }
        .animation(.smooth(duration: 0.35), value: working)
        .animation(.smooth(duration: 0.35), value: app.stateLabel)
        .sensoryFeedback(trigger: pending) { old, new in
            if old != nil, old?.failure == nil, new == nil { return .success }
            if old?.failure == nil, new?.failure != nil { return .error }
            return nil
        }
    }

    /// The actions the round buttons carry.
    private static let roundActions: Set<AppAction> = [.start, .stop, .restart]

    /// Open, Start or Stop, Restart and Logs, as round buttons, as the
    /// mockups have them; each only when it can be done.
    @ViewBuilder
    private func roundButtons(for app: AppStatus) -> some View {
        let available = actions.available(for: app)
        let url = app.address.flatMap { Self.httpsURL($0) }
        if url != nil || !available.filter({ Self.roundActions.contains($0) }).isEmpty || app.hasLogs {
            HStack(alignment: .top, spacing: 20) {
                if let url {
                    RoundActionButton(title: "Open", systemImage: "arrow.up.right.square", tint: Theme.accent) { openURL(url) }
                }
                ForEach([AppAction.start, .restart, .stop].filter { available.contains($0) }) { action in
                    let running = actions.pending[app.id].map { $0.action == action && $0.failure == nil } ?? false
                    RoundActionButton(title: action.title, systemImage: action.systemImage,
                                      tint: action == .stop ? Theme.danger : action == .start ? Theme.success : Theme.info,
                                      busy: running) {
                        actions.request(action, on: app)
                    }
                    .disabled(actions.isBusy)
                }
                if app.hasLogs {
                    RoundActionButton(title: "Logs", systemImage: "text.alignleft", tint: Color(light: 0x5E5E66, dark: 0x98989F)) {
                        dashboard.logsApp = app
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    /// The last seven days, a bar each: green when it answered every check,
    /// amber on a day it was down, red while it's down now.
    private func weekBars(_ outages: [WatchdogOutage]) -> some View {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let days = (0..<7).reversed().compactMap { calendar.date(byAdding: .day, value: -$0, to: today) }
        return HStack(spacing: 6) {
            ForEach(days, id: \.self) { day in
                let end = calendar.date(byAdding: .day, value: 1, to: day) ?? day
                let down = outages.filter { $0.from < end && ($0.to ?? Date()) > day }
                let now = down.contains { $0.to == nil }
                VStack(spacing: 5) {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(now ? Theme.danger : down.isEmpty ? Design.running : Theme.warning)
                        .frame(height: 30)
                    Text(day, format: .dateTime.weekday(.abbreviated))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text("\(day.formatted(.dateTime.weekday(.wide))): \(now ? "down now" : down.isEmpty ? "up all day" : "down for a while")"))
            }
        }
        .padding(.vertical, 4)
    }

    /// The watchdog's week for this app, as the computer shows it on hover.
    @ViewBuilder
    private func weekSection(for app: AppStatus) -> some View {
        if let watchdog = dashboard.cards.watchdog, let share = watchdog.week[app.id] {
            let outages = watchdog.outages[app.id] ?? []
            Section {
                weekBars(outages)
                LabeledContent("Up this week") {
                    Text(share, format: .percent.precision(.fractionLength(0...1)))
                        .foregroundStyle(share < 0.99 ? Theme.warning : .secondary)
                }
                ForEach(outages.reversed()) { outage in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(outage.from, format: .dateTime.weekday(.abbreviated).hour().minute())
                            Spacer()
                            Text(outage.to == nil
                                 ? "Down \(Self.lasted(outage.duration())) now"
                                 : Self.lasted(outage.duration()))
                                .foregroundStyle(outage.to == nil ? Theme.danger : .secondary)
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
                        .foregroundStyle(Theme.danger)
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
                            .foregroundStyle(Theme.warning)
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
                                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.warning)
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
                            .foregroundStyle(Theme.danger)
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
                        .foregroundStyle(Theme.warning)
                }
                if let warning = entry.warning, !warning.isEmpty {
                    Label(warning, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(Theme.warning)
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
        let settings = actions.settings(for: app)
        if !settings.isEmpty {
            Section {
                ForEach(settings) { setting in
                    Toggle(isOn: Binding(
                        get: { actions.value(of: setting, for: app) },
                        set: { on in Task { await actions.set(setting, on: on, for: app) } }
                    )) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(setting.title(for: app))
                                if actions.isSaving(setting, for: app) {
                                    ProgressView().controlSize(.mini)
                                }
                            }
                            Text(setting.detail(on: actions.value(of: setting, for: app), app: app))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .disabled(!actions.canChange || actions.isBusy)
                }
                if let error = actions.settingErrors[app.id] {
                    Text(error).font(.callout).foregroundStyle(Theme.danger)
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
    /// A public app kept home only (main #559) says so.
    nonisolated static func reach(isPublic: Bool, hasAddress: Bool, homeOnly: Bool = false) -> String {
        if isPublic && homeOnly { return "At home only: kept off the internet." }
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
