import SwiftUI
#if os(macOS)
import AppKit
#endif

/// The unlocked app. Its layout follows the platform:
/// - iPhone (compact width): a `NavigationStack` with pull to refresh,
///   push navigation and haptics.
/// - Mac and iPad (regular width): a three-column `NavigationSplitView`
///   with a sidebar, the app list and a detail pane.
struct DashboardView: View {
    @State private var model: DashboardViewModel
    /// Lives as long as the dashboard. Locking removes both, and the pending
    /// states and command output go with them.
    @State private var actions: AppActionsViewModel
    @State private var tasks: HomelabTasksViewModel
    @State private var computer: ComputerViewModel
    @State private var finances: FinancesViewModel
    private let api: APIClient
    /// Asks the computer again what this device may do (`/api/me`).
    private let refreshDevice: @MainActor () async -> Void
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    init(coordinator: AppCoordinator) {
        api = coordinator.api
        refreshDevice = { [weak coordinator] in await coordinator?.refreshDevice() }
        let dashboard = DashboardViewModel(api: coordinator.api, liveEvents: coordinator.liveEvents)
        let device: @MainActor () -> DeviceInfo? = { [weak coordinator] in coordinator?.device }
        let authorize: @MainActor (String) async -> Bool = { [weak coordinator] reason in
            await coordinator?.authorizeChange(reason: reason) ?? false
        }
        _model = State(initialValue: dashboard)
        _actions = State(initialValue: AppActionsViewModel(
            api: coordinator.api,
            liveEvents: coordinator.liveEvents,
            device: device,
            authorize: authorize
        ))
        _tasks = State(initialValue: HomelabTasksViewModel(
            api: coordinator.api,
            device: device,
            authorize: authorize,
            didFinish: { [weak dashboard] task in
                // Read again what the job changed.
                switch task {
                case .backup, .restoreTest: await dashboard?.backups.load()
                case .fix: await dashboard?.refresh()
                }
            }
        ))
        _finances = State(initialValue: FinancesViewModel(api: coordinator.api, device: device, authorize: authorize))
        _computer = State(initialValue: ComputerViewModel(
            api: coordinator.api,
            liveEvents: coordinator.liveEvents,
            device: device,
            authorize: authorize
        ))
    }

    var body: some View {
        Group {
            #if os(iOS)
            if sizeClass == .compact {
                PhoneDashboard(model: model, computer: computer, finances: finances)
            } else {
                SplitDashboard(model: model, computer: computer, finances: finances)
            }
            #else
            SplitDashboard(model: model, computer: computer, finances: finances)
            #endif
        }
        // A haptic when something new needs attention, not when it clears.
        .sensoryFeedback(.warning, trigger: model.attentionCount) { old, new in new > old }
        .modifier(AppActionsPresenter(actions: actions))
        .sheet(item: $model.logsApp) { app in
            LogsView(app: app, api: api)
        }
        .sheet(item: $tasks.output) { output in
            TaskOutputView(output: output)
                .environment(tasks)
        }
        .sensoryFeedback(.success, trigger: tasks.successCount)
        .sensoryFeedback(.error, trigger: tasks.failureCount)
        .environment(actions)
        .environment(tasks)
        .environment(model)
        .environment(model.icons)
        .task { await model.loadCatalog() }
        .task { await model.loadForMorning() }
        // Kept as it arrives, so leaving (a lock clears the status first) still saves what was seen.
        .onChange(of: model.liveEvents.status) { _, status in
            guard let status else { return }
            model.latestApps = status.apps
            // Status read aloud: VoiceOver hears what changed as it changes.
            if let words = model.changesToSay(status.apps) {
                AccessibilityNotification.Announcement(words).post()
            }
            // The widget's one line, when it's turned on: a count, never names.
            if WidgetSummaryStore.save(WidgetSummary(needALook: model.attentionCount, at: Date())) {
                WidgetSummaryStore.reloadWidget()
            }
        }
        .onDisappear {
            model.rememberSeen()
        }
        // The cards change slowly: read them now, then every 5 minutes while
        // unlocked. What this device may do is read again with them: the
        // computer can give a phone its changes for a while only (main #455),
        // and when that ends it only looks, without telling the phone.
        .task {
            var first = true
            while !Task.isCancelled {
                if !first { await refreshDevice() }
                first = false
                await model.cards.load()
                try? await Task.sleep(for: .seconds(300))
            }
        }
        // A change that failed may have failed because this device may no
        // longer make changes: read that again, so the buttons go if so.
        .onChange(of: actions.failureCount) { Task { await refreshDevice() } }
        .onChange(of: tasks.failureCount) { Task { await refreshDevice() } }
    }
}

// MARK: - iPhone

/// The iPhone's tabs: the computer's screens, in its order (Status,
/// Backups, Finances, Setup, Settings). Choose apps and Tidy Up are the
/// computer's only.
private struct PhoneDashboard: View {
    typealias Screen = DashboardViewModel.SidebarItem
    @Bindable var model: DashboardViewModel
    let computer: ComputerViewModel
    let finances: FinancesViewModel
    /// The tab, kept between launches as the computer keeps its screen: a name only.
    @SceneStorage("tab") private var savedTab = "apps:all"

    private var tab: Binding<Screen> {
        Binding(
            get: {
                let screen = (Screen(storageKey: savedTab) ?? .status(.all)).row
                return screen == .finances && !finances.canSeePlan ? .status(.all) : screen
            },
            set: { savedTab = $0.storageKey }
        )
    }

    var body: some View {
        TabView(selection: tab) {
            PhoneStatus(model: model, finances: finances) { savedTab = Screen.backups.storageKey }
                .tabItem { Label("Status", systemImage: Screen.status(.all).systemImage) }
                .badge(model.attentionCount)
                .tag(Screen.status(.all))
            NavigationStack {
                BackupsView(backups: model.backups)
            }
            .tabItem { Label("Backups", systemImage: Screen.backups.systemImage) }
            .badge(model.backups.needsAttention)
            .tag(Screen.backups)
            if finances.canSeePlan {
                NavigationStack {
                    financesRoot
                }
                .tabItem { Label("Finances", systemImage: Screen.finances.systemImage) }
                .tag(Screen.finances)
            }
            NavigationStack {
                ComputerView(computer: computer, page: .setup)
            }
            .tabItem { Label("Setup", systemImage: Screen.setup.systemImage) }
            .tag(Screen.setup)
            NavigationStack {
                settingsRoot
            }
            .tabItem { Label("Settings", systemImage: Screen.settings.systemImage) }
            .tag(Screen.settings)
        }
        .shrinkingTabBar()
        #if SCREENSHOTS
        .onAppear {
            if let tab = screenshotTab { savedTab = tab.storageKey }
            finances.amountsShown = !ScreenshotMode.hidesAmounts
        }
        #endif
    }

    // What needs a look is on the Status tab and its badge, not in a line
    // atop every other tab (it squeezed their titles and read as an alarm).

    @ViewBuilder
    private var settingsRoot: some View {
        #if SCREENSHOTS
        if ScreenshotMode.shot == "settings-all" {
            SettingsFormView(computer: computer, section: nil)
        } else {
            ComputerView(computer: computer, page: .settings)
        }
        #else
        ComputerView(computer: computer, page: .settings)
        #endif
    }

    @ViewBuilder
    private var financesRoot: some View {
        #if SCREENSHOTS
        FinancesView.screenshotRoot(finances: finances)
        #else
        FinancesView(finances: finances)
        #endif
    }

    #if SCREENSHOTS
    /// The tab a screenshot shows.
    private var screenshotTab: Screen? {
        switch ScreenshotMode.shot {
        case nil: nil
        case "status", "app": .status(.all)
        case "backups": .backups
        case "setup": .setup
        case "settings", "settings-all": .settings
        default: .finances
        }
    }
    #endif
}

/// Status on iPhone: the ring and what needs a look, four tiles, what
/// changed, the apps by category as the computer groups them, and the
/// cards under them, as the computer has them below its table.
private struct PhoneStatus: View {
    @Bindable var model: DashboardViewModel
    let finances: FinancesViewModel
    /// Opens the Backups tab, from its tile.
    var openBackups: @MainActor () -> Void = {}
    /// Which groups are open (StatusFolds): names only, kept like the tab.
    @SceneStorage("statusFolds") private var folds = ""
    /// An app's page grows out of its row (iOS 18).
    @Namespace private var zoom

    var body: some View {
        NavigationStack {
            List {
                // While searching, only the apps that match.
                if !model.isSearching, model.hasLoaded {
                    Section {
                        VStack(spacing: 10) {
                            StatusHero(model: model)
                            StatusTiles(model: model, openBackups: openBackups)
                        }
                        // Room under the tiles for their shadows, which the row would otherwise cut.
                        .padding(.bottom, 14)
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 0, trailing: 0))
                        .listRowBackground(Color.clear)
                    }
                }
                let changed = model.isSearching ? [] : model.changedApps
                if !changed.isEmpty {
                    Section {
                        ForEach(changed) { app in
                            NavigationLink(value: app.id) {
                                AppRowView(app: app)
                            }
                            .zoomSource(id: app.id, in: zoom)
                            .appActionControls(for: app)
                        }
                    } header: {
                        HStack {
                            Text("Changed Since You Looked")
                            Spacer()
                            Button("Mark as Seen") { model.markAllSeen() }
                                .textCase(nil)
                                .font(.caption)
                        }
                    }
                }
                // By category, as the computer's Status: what needs a look
                // first, then the pinned apps. While searching, every match shows.
                ForEach(model.isSearching ? model.groups(matching: model.search) : model.groups) { group in
                    let open = model.isSearching || StatusFolds.isOpen(group, in: folds)
                    Section {
                        if open {
                            ForEach(group.apps) { app in
                                NavigationLink(value: app.id) {
                                    AppRowView(app: app)
                                }
                                .zoomSource(id: app.id, in: zoom)
                                .appActionControls(for: app)
                            }
                        } else {
                            FoldedGroupNames(group: group) { folds = StatusFolds.setting(group, open: true, in: folds) }
                        }
                    } header: {
                        GroupHeader(group: group, open: open) {
                            folds = StatusFolds.setting(group, open: !open, in: folds)
                        }
                    }
                }
                if !model.isSearching, model.hasLoaded {
                    StatusCards(cards: model.cards, finances: finances)
                }
            }
            .overlay {
                if !model.hasLoaded {
                    NotLoadedView(model: model)
                } else if model.isSearching, !model.apps(for: .all).contains(where: { model.matchesSearch($0) }) {
                    ContentUnavailableView.search(text: model.search)
                }
            }
            .themedCanvas()
            .searchable(text: $model.search, prompt: "Apps")
            .navigationTitle("Status")
            .navigationDestination(for: AppStatus.ID.self) { id in
                AppDetailView(app: model.app(id: id))
                    .zoomTransition(id: id, in: zoom)
            }
            #if SCREENSHOTS
            .overlay {
                // The screenshots: an app's page, as if tapped.
                if ScreenshotMode.shot == "app", let app = model.app(id: "vikunja") ?? model.latestApps.first {
                    AppDetailView(app: app).background(Theme.canvas)
                }
            }
            #endif
            .refreshable {
                // Status and its cards (refresh reads them), the backups tile, and the money card.
                async let money: Void = finances.load()
                async let backups: Void = model.backups.load()
                await model.refresh()
                await money
                await backups
            }
            // Again once the device's level is known: right after unlock it may not be yet.
            .task(id: finances.canSeeMoney) { await finances.load() }
            // The Backups tile, read once if the Backups tab hasn't yet.
            .task { if model.backups.overview == nil { await model.backups.load() } }
            .toolbar {
                #if os(iOS)
                ToolbarItem(placement: .topBarLeading) {
                    ConnectionBadge(state: model.liveEvents.connection)
                }
                #endif
                ToolbarItem(placement: .primaryAction) {
                    DeviceMenu()
                }
            }
        }
    }
}

// MARK: - Mac & iPad

/// Homelab Wizard's name and line, atop the sidebar as on the computer.
private struct BrandHeader: View {
    var body: some View {
        HStack(spacing: 10) {
            AppMark(size: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text("Homelab Wizard")
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text("Your apps, at home")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .textCase(nil)
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}

private struct SplitDashboard: View {
    typealias Screen = DashboardViewModel.SidebarItem
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(AppCoordinator.self) private var coordinator
    /// The sidebar's choice, kept across launches as the computer keeps each
    /// screen's place (#417). Only the choice is kept, never what it shows.
    @SceneStorage("sidebar") private var savedSidebar = "apps:all"
    /// Which Status groups are open (StatusFolds), as on iPhone.
    @SceneStorage("statusFolds") private var folds = ""
    @Bindable var model: DashboardViewModel
    let computer: ComputerViewModel
    let finances: FinancesViewModel
    @State private var columns: NavigationSplitViewVisibility = .all

    /// The computer's screens a phone can reach, in its sidebar's order.
    private var screens: [Screen] {
        [.status(.all), .backups] + (finances.canSeePlan ? [.finances] : []) + [.setup, .settings]
    }

    /// The highlighted row: Status for any of its filters. Picking Status
    /// again keeps the filter it shows.
    private var row: Binding<Screen?> {
        Binding(
            get: { model.sidebar?.row },
            set: { picked in if picked != model.sidebar?.row { model.sidebar = picked } }
        )
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            List(selection: row) {
                Section {
                    ForEach(screens, id: \.self) { screen in
                        Label(screen.title, systemImage: screen.systemImage)
                            .badge(badge(for: screen))
                            .tag(screen)
                    }
                } header: {
                    BrandHeader()
                }
            }
            .navigationTitle("Homelab Wizard")
            .onAppear { model.sidebar = Screen(storageKey: savedSidebar) ?? .status(.all) }
            .onChange(of: model.sidebar) { _, item in
                if let item { savedSidebar = item.storageKey }
            }
            // Finances gone from this device: back to Status.
            .onChange(of: finances.canSeePlan) { _, can in
                if !can, model.sidebar == .finances { model.sidebar = .status(.all) }
            }
            // An app asked for from the menu bar: show it in the full list.
            .onChange(of: coordinator.requestedAppID, initial: true) { _, id in
                guard let id else { return }
                coordinator.requestedAppID = nil
                model.search = ""
                model.sidebar = .status(.all)
                model.selectedAppID = id
            }
            .navigationSplitViewColumnWidth(min: 190, ideal: 220)
            .safeAreaInset(edge: .bottom) {
                ConnectionBadge(state: model.liveEvents.connection)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
        } content: {
            switch model.sidebar {
            case .backups?:
                BackupsView(backups: model.backups)
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .finances?:
                FinancesView(finances: finances)
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .setup?:
                ComputerView(computer: computer, page: .setup)
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .settings?:
                ComputerView(computer: computer, page: .settings)
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            default:
                appList
            }
        } detail: {
            if let app = model.app(id: model.selectedAppID) {
                AppDetailView(app: app)
                    .focusedSceneValue(\.selectedApp, SelectedAppFocus(app: app, actions: actions, showLogs: { model.logsApp = app }))
            } else {
                ContentUnavailableView(
                    "No App Selected",
                    systemImage: "server.rack",
                    description: Text("Choose an app to see its details.")
                )
            }
        }
        // ⌘2 to ⌘6, as the computer's: the View menu (ScreenCommands).
        .focusedSceneValue(\.screenChoice, ScreenChoice(canSeeFinances: finances.canSeePlan) { screen in
            model.sidebar = screen
        })
    }

    private func badge(for screen: Screen) -> Int {
        switch screen {
        case .status: model.attentionCount
        case .backups: model.backups.needsAttention
        default: 0
        }
    }

    private var appList: some View {
        let filter: DashboardViewModel.Filter
        if case .status(let chosen)? = model.sidebar { filter = chosen } else { filter = .all }
        let apps = model.apps(for: filter).filter { model.matchesSearch($0) }
        return List(selection: $model.selectedAppID) {
            if filter == .all {
                // All Apps is grouped by category, as the computer's Status.
                ForEach(model.isSearching ? model.groups(matching: model.search) : model.groups) { group in
                    let open = model.isSearching || StatusFolds.isOpen(group, in: folds)
                    Section {
                        if open {
                            ForEach(group.apps) { app in
                                AppRowView(app: app)
                                    .appActionControls(for: app)
                            }
                        } else {
                            FoldedGroupNames(group: group) { folds = StatusFolds.setting(group, open: true, in: folds) }
                        }
                    } header: {
                        GroupHeader(group: group, open: open) {
                            folds = StatusFolds.setting(group, open: !open, in: folds)
                        }
                    }
                }
            } else {
                ForEach(apps) { app in
                    AppRowView(app: app)
                        .appActionControls(for: app)
                }
            }
            // The cards, below the apps as on the computer's Status.
            if filter == .all, !model.isSearching, model.hasLoaded {
                // Not rows to select: the selection is an app.
                StatusCards(cards: model.cards, finances: finances)
                    .selectionDisabled()
            }
        }
        // Again once the device's level is known: right after unlock it may not be yet.
        .task(id: finances.canSeeMoney) { await finances.load() }
        .safeAreaInset(edge: .top) {
            if model.overnightLine != nil {
                OvernightLine(model: model)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(.bar)
            }
        }
        .overlay {
            if !model.hasLoaded {
                NotLoadedView(model: model)
            } else if apps.isEmpty {
                if model.isSearching {
                    ContentUnavailableView.search(text: model.search)
                } else {
                    ContentUnavailableView(filter.emptyTitle, systemImage: filter.systemImage,
                                           description: filter == .all ? Text("Pick a few on the computer's Choose apps. They show up here as they start.") : nil)
                }
            }
        }
        .searchable(text: $model.search, prompt: "Filter Apps")
        .navigationTitle(filter == .all ? "Status" : filter.title)
        #if os(macOS)
        .navigationSubtitle(model.summary)
        #endif
        .navigationSplitViewColumnWidth(min: 260, ideal: 320)
        .refreshable {
            // Status and its cards (refresh reads them), and the money card.
            async let money: Void = finances.load()
            await model.refresh()
            await money
        }
        .toolbar {
            toolbarItems
            // The filters the sidebar listed before: here, as Status's own.
            ToolbarItem(placement: .automatic) {
                Picker("Show", selection: Binding(get: { filter }, set: { model.sidebar = .status($0) })) {
                    ForEach(DashboardViewModel.Filter.allCases) { choice in
                        Label("\(choice.title) (\(model.count(for: choice)))", systemImage: choice.systemImage)
                            .tag(choice)
                    }
                }
                .pickerStyle(.menu)
                .help("Which apps Status shows")
            }
            ToolbarItem(placement: .automatic) {
                GroupActionsMenu(apps: apps)
            }
            if !model.changedApps.isEmpty {
                ToolbarItem(placement: .automatic) {
                    Button {
                        model.markAllSeen()
                    } label: {
                        Label("Mark as Seen", systemImage: "eye.circle")
                    }
                    .help("Clear the dots on rows that changed since you looked")
                }
            }
        }
    }

    /// Health in one line, with Open Status to the apps that need a look.
    private var healthLine: some View {
        HealthLineBar(model: model) { model.sidebar = .status(.attention) }
    }

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button {
                Task { await model.refresh() }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .disabled(model.liveEvents.isRefreshing || model.cards.isLoading)
            .help("Read the status and cards again")

            DeviceMenu()
        }
    }
}

/// Before the first status: reading it, or why it can't be read yet.
private struct NotLoadedView: View {
    let model: DashboardViewModel

    var body: some View {
        let live = model.liveEvents
        if let error = live.refreshError ?? live.connection.problem {
            ContentUnavailableView {
                Label("Can't Reach the Computer", systemImage: "wifi.exclamationmark")
            } description: {
                Text(error)
            } actions: {
                Button("Try Again") {
                    Task { await model.refresh() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(live.isRefreshing || model.cards.isLoading)
            }
        } else {
            ProgressView("Reading the status…")
        }
    }
}

/// Health in one line (main #470): atop every screen but Status and an
/// app's page, "All well" or the one thing that needs you. On iPhone, Back
/// is the way to Status; on the Mac and iPad, Open Status shows the apps
/// that need a look.
struct HealthLineBar: View {
    let model: DashboardViewModel
    var open: (@MainActor () -> Void)? = nil

    var body: some View {
        if let line = model.healthLine {
            HStack(spacing: 8) {
                if line.isEmpty {
                    Label("All well", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Theme.success)
                } else {
                    Label {
                        Text(verbatim: line).lineLimit(2)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle.fill")
                    }
                    .foregroundStyle(Theme.danger)
                }
                Spacer(minLength: 8)
                if !line.isEmpty, let open {
                    Button("Open Status", action: open)
                        .buttonStyle(.borderless)
                }
            }
            .font(.callout.weight(.medium))
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(.bar)
            .accessibilityElement(children: .combine)
        }
    }
}

/// A Status group's heading: its fold, its name and how many, and the
/// group's own Start, Restart and Stop menu.
struct GroupHeader: View {
    let group: AppGroup
    let open: Bool
    let toggle: @MainActor () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Button(action: toggle) {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(open ? 90 : 0))
                    Text(verbatim: group.label)
                    Text("\(group.apps.count)")
                        .pill(group.alert ? Theme.danger : .secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(verbatim: "\(group.label), \(group.apps.count) \(group.apps.count == 1 ? "app" : "apps")"))
            .accessibilityValue(open ? "Open" : "Folded")
            .accessibilityHint(open ? "Folds the group" : "Opens the group")
            Spacer()
            GroupActionsMenu(apps: group.apps)
                .font(.caption)
        }
        .textCase(nil)
    }
}

/// A folded group's apps, by name, on a line of their own (as the computer
/// shows them since main #474). A tap opens the group.
struct FoldedGroupNames: View {
    let group: AppGroup
    let open: @MainActor () -> Void

    var body: some View {
        Button(action: open) {
            Text(verbatim: group.apps.map(\.name).joined(separator: ", "))
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the group")
    }
}

/// The morning's line about the night, with Hide until tomorrow.
struct OvernightLine: View {
    let model: DashboardViewModel

    var body: some View {
        if let words = model.overnightLine {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "moon.stars").foregroundStyle(.secondary).accessibilityHidden(true)
                Text(words).font(.callout)
                Spacer(minLength: 4)
                Button("Hide Until Tomorrow") { model.hideOvernight() }
                    .font(.caption)
                    .buttonStyle(.borderless)
            }
            .accessibilityElement(children: .combine)
        }
    }
}

private extension DashboardViewModel.Filter {
    var emptyTitle: String {
        switch self {
        case .all: "No Apps"
        case .attention: "Nothing Needs a Look"
        case .running: "Nothing Running"
        case .stopped: "Nothing Stopped"
        }
    }
}

// MARK: - Shared pieces

/// The device's menu: what it may do, Lock, and Unpair.
struct DeviceMenu: View {
    @Environment(AppCoordinator.self) private var coordinator
    @State private var confirmingUnpair = false

    var body: some View {
        Menu {
            if let device = coordinator.device {
                Section("Paired as \(device.name)") {
                    if let server = coordinator.serverName {
                        Label(server, systemImage: "network")
                    }
                    Label(
                        device.canChange ? "Can make changes" : "Look only",
                        systemImage: device.canChange ? "hand.tap" : "eye"
                    )
                }
            }
            Button {
                coordinator.lock()
            } label: {
                Label("Lock Now", systemImage: "lock")
            }
            Button(role: .destructive) {
                confirmingUnpair = true
            } label: {
                Label("Unpair This Device…", systemImage: "minus.circle")
            }
        } label: {
            Label("Device", systemImage: "person.badge.shield.checkmark")
        }
        .confirmationDialog("Unpair this device?", isPresented: $confirmingUnpair, titleVisibility: .visible) {
            Button("Unpair", role: .destructive) { coordinator.unpair() }
        } message: {
            if let id = coordinator.device?.id {
                Text("The token is deleted from this device. To revoke it on the computer as well, run: homelab phone remove \(id)")
            } else {
                Text("The token is deleted from this device. To revoke it on the computer as well, use homelab phone remove.")
            }
        }
    }
}

