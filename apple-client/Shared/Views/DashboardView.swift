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
        // The household's own pictures for a logo, wherever one is drawn.
        .environment(\.ownLogos, finances.ownLogos)
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
        // Alerts from this app (Settings › Alerts From), while it runs.
        .task { await LocalAlerts.watch(read: { try await model.alertLog() }, computerKeeps: { actions.computerAnswers("AlertLog") }) }
        // Kept as it arrives, so leaving (a lock clears the status first) still saves what was seen.
        .onChange(of: model.liveEvents.status) { _, status in
            guard let status else { return }
            model.latestApps = status.apps
            // Away mode's apps, kept only when they change.
            model.rememberAwayApps()
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
    @Environment(AppCoordinator.self) private var coordinator

    /// A household member's phone: their apps, their Finances, and this
    /// device. The homelab's backups and setup are the owner's.
    private var isMember: Bool { coordinator.device?.isMember == true }

    private var tab: Binding<Screen> {
        Binding(
            get: {
                let screen = (Screen(storageKey: savedTab) ?? .status(.all)).row
                return IntentInbox.landing(screen, isMember: isMember, canSeeFinances: finances.canSeePlan)
            },
            set: { screen in
                // Leaving Finances locks a member's private ones.
                if screen != .finances { finances.lockPrivate() }
                savedTab = screen.storageKey
            }
        )
    }

    var body: some View {
        TabView(selection: tab) {
            PhoneStatus(model: model, isMember: isMember)
                .tabItem { Label("Status", systemImage: Screen.status(.all).systemImage) }
                .badge(model.attentionCount)
                .tag(Screen.status(.all))
            if !isMember {
                NavigationStack {
                    BackupsView(backups: model.backups)
                }
                .tabItem { Label("Backups", systemImage: Screen.backups.systemImage) }
                .badge(model.backups.needsAttention)
                .tag(Screen.backups)
            }
            if finances.canSeePlan {
                NavigationStack {
                    financesRoot
                        // A link to one of its pages (homelab://finances/budgets).
                        .navigationDestination(item: Binding(
                            get: { IntentInbox.shared.financePage },
                            set: { IntentInbox.shared.financePage = $0 }
                        )) { page in
                            FinancesView.linkedPage(page, finances: finances)
                        }
                }
                .tabItem { Label("Finances", systemImage: Screen.finances.systemImage) }
                .tag(Screen.finances)
            }
            if !isMember {
                NavigationStack {
                    ComputerView(computer: computer, page: .setup)
                }
                .tabItem { Label("Setup", systemImage: Screen.setup.systemImage) }
                .tag(Screen.setup)
            }
            NavigationStack {
                if isMember {
                    MemberSettingsView()
                } else {
                    settingsRoot
                }
            }
            .tabItem { Label("Settings", systemImage: Screen.settings.systemImage) }
            .tag(Screen.settings)
        }
        .shrinkingTabBar()
        // Siri or a shortcut asked for an app: Status, where its page opens.
        .onChange(of: IntentInbox.shared.pending, initial: true) { _, request in
            if request != nil { savedTab = Screen.status(.all).storageKey }
        }
        // A link asked for a screen (homelab://backups): that tab, where this
        // phone has it (the tab's own rules still apply).
        .onChange(of: IntentInbox.shared.screen, initial: true) { _, screen in
            guard let screen else { return }
            savedTab = screen.storageKey
            IntentInbox.shared.screen = nil
            // No Finances on this phone: no page of it waits either.
            if !finances.canSeePlan { IntentInbox.shared.financePage = nil }
        }
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
    private var screenshotTab: Screen? { ScreenshotMode.screen }
    #endif
}

#if SCREENSHOTS
extension ScreenshotMode {
    /// The screen a picture shows: the iPhone's tab, the iPad's sidebar row.
    @MainActor static var screen: DashboardViewModel.SidebarItem? {
        switch shot {
        case nil: nil
        case "status", "app": .status(.all)
        case "backups": .backups
        case "setup": .setup
        case "settings", "settings-all": .settings
        default: .finances
        }
    }
}
#endif

/// Status on iPhone, as the owner trimmed it (Nov 9): one line when all is
/// well, or a card for what needs a look; then the apps by category, the
/// pinned ones open, the rest folded to a row of logos until opened.
private struct PhoneStatus: View {
    @Bindable var model: DashboardViewModel
    /// A household member's phone: their apps only (and no backups to read).
    var isMember = false
    /// Which groups are open (StatusFolds): names only, kept like the tab,
    /// and the computer's for every device (FoldSync).
    @SceneStorage("statusFolds") private var folds = ""
    /// What the computer last said they are, to tell the person's own changes apart.
    @State private var computerFolds: String?
    /// An app's page grows out of its row (iOS 18).
    @Namespace private var zoom
    @Environment(AppActionsViewModel.self) private var actions
    /// A link's action, waiting for its one tap.
    @State private var linkAsk: LinkAsk?
    /// The pages open on Status, so Siri can open one.
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                // While searching, only the apps that match.
                // One line when all is well, or one card for what needs a
                // look (the owner's trim, Nov 9). An app changed since you
                // looked has its dot on its row.
                if !model.isSearching, model.hasLoaded {
                    Section {
                        StatusTop(model: model) { id in path.append(id) }
                            // Room under a card for its shadow, which the row would otherwise cut.
                            .padding(.bottom, 6)
                            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 0, trailing: 0))
                            .listRowBackground(Color.clear)
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
            // The folds are the computer's, the same on every device.
            .task(id: model.hasLoaded) { await FoldSync.pull(model: model, actions: actions, folds: $folds, computer: $computerFolds) }
            .onChange(of: folds) { _, new in FoldSync.push(new, model: model, actions: actions, computer: $computerFolds) }
            .navigationTitle("Status")
            .navigationDestination(for: AppStatus.ID.self) { id in
                AppDetailView(app: model.app(id: id))
                    .zoomTransition(id: id, in: zoom)
            }
            #if SCREENSHOTS
            // The screenshots: an app's page, opened as a tap opens it (its own title, no Status search over
            // it: an overlay on the list showed both, apple-loop.md item 1).
            .onChange(of: model.hasLoaded, initial: true) {
                guard ScreenshotMode.shot == "app", path.isEmpty, model.hasLoaded,
                      let app = model.app(id: "vikunja") ?? model.latestApps.first else { return }
                path.append(app.id)
            }
            #endif
            .refreshable {
                // Status, and the backups the Backups tab's badge counts.
                guard !isMember else { return await model.refresh() }
                async let backups: Void = model.backups.load()
                await model.refresh()
                await backups
            }
            // The Backups tab's badge, read once if that tab hasn't yet.
            .task { if !isMember, model.backups.overview == nil { await model.backups.load() } }
            // Siri or a shortcut: the app's page, and the action asked for,
            // once Status is read (after unlock).
            .onChange(of: IntentInbox.shared.pending, initial: true) { takeRequest() }
            .onChange(of: model.hasLoaded) { takeRequest() }
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
        .linkAskDialog($linkAsk)
    }

    /// Does what Siri, a shortcut or a link asked (IntentInbox.outcome):
    /// opens the app's page, then what waits on it. An app it can't tell is
    /// searched for instead, so the list shows what matches.
    private func takeRequest() {
        let inbox = IntentInbox.shared
        guard let request = inbox.pending, model.hasLoaded else { return }
        inbox.pending = nil
        switch IntentInbox.outcome(of: request, in: model.apps(for: .all), available: { actions.available(for: $0) }) {
        case .search(let said):
            model.search = said
        case .open(let id, let then):
            path = NavigationPath([id])
            if let then, let app = model.app(id: id) {
                follow(then, on: app, model: model, actions: actions) { linkAsk = $0 }
            }
        }
    }
}

/// A link's action, waiting for its tap.
private struct LinkAsk: Equatable {
    let app: AppStatus
    let action: AppAction
}

/// What waits on an app's page once it's open: its logs, a link's action
/// for one tap, or Siri's action as its button would (Face ID, and Stop
/// asks first). After the page is up, so the spinner and the result show there.
@MainActor
private func follow(
    _ then: IntentInbox.Then,
    on app: AppStatus,
    model: DashboardViewModel,
    actions: AppActionsViewModel,
    ask: @escaping @MainActor (LinkAsk) -> Void
) {
    Task { @MainActor in
        try? await Task.sleep(for: .milliseconds(600))
        switch then {
        case .logs: model.logsApp = app
        case .ask(let action): ask(LinkAsk(app: app, action: action))
        case .run(let action): actions.request(action, on: app)
        }
    }
}

private extension View {
    /// A link's action, on a device allowed changes: one tap here, then as
    /// its button would (Face ID, and Stop asks first).
    func linkAskDialog(_ ask: Binding<LinkAsk?>) -> some View {
        modifier(LinkAskDialog(ask: ask))
    }
}

private struct LinkAskDialog: ViewModifier {
    @Binding var ask: LinkAsk?
    @Environment(AppActionsViewModel.self) private var actions

    func body(content: Content) -> some View {
        content.confirmationDialog(
            ask.map { "\($0.action.title) \($0.app.name)?" } ?? "",
            isPresented: Binding(get: { ask != nil }, set: { if !$0 { ask = nil } }),
            titleVisibility: .visible,
            presenting: ask
        ) { ask in
            Button(ask.action.title, role: ask.action == .stop ? .destructive : nil) {
                actions.request(ask.action, on: ask.app)
            }
            Button("Not Now", role: .cancel) {}
        } message: { _ in
            Text("A link asked for this. Nothing happens unless you tap it.")
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

/// Status's folds as the computer keeps them for every device (the owner,
/// Nov 10): read when Status loads, taken as this device's; the person's
/// own changes saved back, on a device allowed changes, where the computer
/// keeps them. A device that only looks keeps its own.
@MainActor
enum FoldSync {
    static func pull(model: DashboardViewModel, actions: AppActionsViewModel, folds: Binding<String>, computer: Binding<String?>) async {
        guard actions.computerAnswers("StatusFolds"), let theirs = await model.computerFolds() else { return }
        computer.wrappedValue = theirs
        if StatusFolds.choices(theirs) != StatusFolds.choices(folds.wrappedValue) { folds.wrappedValue = theirs }
    }

    static func push(_ raw: String, model: DashboardViewModel, actions: AppActionsViewModel, computer: Binding<String?>) {
        guard StatusFolds.shouldSave(raw, computers: computer.wrappedValue, canChange: actions.canChange,
                                     keeps: actions.computerAnswers("SetStatusFolds")) else { return }
        computer.wrappedValue = raw
        Task { await model.saveFolds(raw) }
    }
}

private struct SplitDashboard: View {
    typealias Screen = DashboardViewModel.SidebarItem
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(AppCoordinator.self) private var coordinator
    /// The sidebar's choice, kept across launches as the computer keeps each
    /// screen's place (#417). Only the choice is kept, never what it shows.
    @SceneStorage("sidebar") private var savedSidebar = "apps:all"
    /// Which Status groups are open (StatusFolds), as on iPhone, and the
    /// computer's for every device (FoldSync).
    @SceneStorage("statusFolds") private var folds = ""
    /// What the computer last said they are, to tell the person's own changes apart.
    @State private var computerFolds: String?
    @Bindable var model: DashboardViewModel
    let computer: ComputerViewModel
    let finances: FinancesViewModel
    @State private var columns: NavigationSplitViewVisibility = .all
    /// A link's action, waiting for its one tap.
    @State private var linkAsk: LinkAsk?

    /// The computer's screens a phone can reach, in its sidebar's order.
    /// A household member's iPad: their apps, their Finances, and Settings.
    private var isMember: Bool { coordinator.device?.isMember == true }

    private var screens: [Screen] {
        if isMember {
            return [.status(.all)] + (finances.canSeePlan ? [.finances] : []) + [.settings]
        }
        return [.status(.all), .backups] + (finances.canSeePlan ? [.finances] : []) + [.setup, .settings]
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
            // Where it was left, then what a link, Siri or a shortcut asked
            // for while it was locked (after, so the place kept doesn't undo it).
            .onAppear {
                model.sidebar = Screen(storageKey: savedSidebar) ?? .status(.all)
                takeScreen()
                takeRequest()
            }
            // A link asked for a screen (homelab://backups): that row, where
            // this device has it.
            .onChange(of: IntentInbox.shared.screen) { takeScreen() }
            // Siri, a shortcut or a link asked for an app: its page in the
            // full list, once Status is read, and what waits on it.
            .onChange(of: IntentInbox.shared.pending) { takeRequest() }
            .onChange(of: model.hasLoaded) { takeRequest() }
            .onChange(of: model.sidebar) { _, item in
                if let item { savedSidebar = item.storageKey }
                // Leaving Finances locks a member's private ones.
                if item != .finances { finances.lockPrivate() }
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
            // The folds are the computer's, the same on every device.
            .task(id: model.hasLoaded) { await FoldSync.pull(model: model, actions: actions, folds: $folds, computer: $computerFolds) }
            .onChange(of: folds) { _, new in FoldSync.push(new, model: model, actions: actions, computer: $computerFolds) }
            .safeAreaInset(edge: .bottom) {
                ConnectionBadge(state: model.liveEvents.connection)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
        } content: {
            switch model.sidebar {
            // A household member's iPad has neither (a place kept from before).
            case .backups? where isMember, .setup? where isMember:
                appList
            case .backups?:
                BackupsView(backups: model.backups)
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .finances?:
                financesColumn
                    // A link to one of its pages (homelab://finances/budgets).
                    .navigationDestination(item: Binding(
                        get: { IntentInbox.shared.financePage },
                        set: { IntentInbox.shared.financePage = $0 }
                    )) { page in
                        FinancesView.linkedPage(page, finances: finances)
                    }
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .setup?:
                ComputerView(computer: computer, page: .setup)
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .settings? where isMember:
                MemberSettingsView()
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
            case .settings?:
                settingsColumn
                    .safeAreaInset(edge: .top) { healthLine }
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            default:
                appList
            }
        } detail: {
            if showsAppList, model.showsAlertLog {
                // Every Alert, from Status's Recent Alerts card in the list.
                NavigationStack {
                    AlertLogView()
                }
            } else if let app = model.app(id: model.selectedAppID) {
                // Beside Status's list, the page has a stack of its own, so
                // More About and Everything That Was Done open in it (a split
                // view's last column has none); another app starts at its page.
                // Beside another screen (Finances), that screen's links open here.
                Group {
                    if showsAppList {
                        NavigationStack { AppDetailView(app: app) }
                            .id(app.id)
                    } else {
                        AppDetailView(app: app)
                    }
                }
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
        .linkAskDialog($linkAsk)
        #if SCREENSHOTS
        // The iPad's pictures: the shot's screen (kept as the place, so the
        // sidebar showing later doesn't undo it), and beside Status's list
        // an app's page, as a tap opens it.
        .onAppear {
            guard let screen = ScreenshotMode.screen else { return }
            savedSidebar = screen.storageKey
            model.sidebar = screen
        }
        .onChange(of: model.hasLoaded, initial: true) {
            guard model.hasLoaded, model.selectedAppID == nil,
                  ScreenshotMode.shot == "status" || ScreenshotMode.shot == "app",
                  let app = model.app(id: "vikunja") ?? model.latestApps.first else { return }
            model.selectedAppID = app.id
        }
        #endif
    }

    /// Finances in the content column (in the pictures, the page the shot names).
    @ViewBuilder
    private var financesColumn: some View {
        #if SCREENSHOTS
        FinancesView.screenshotRoot(finances: finances)
        #else
        FinancesView(finances: finances)
        #endif
    }

    /// Settings in the content column (in the pictures, every setting for `settings-all`).
    @ViewBuilder
    private var settingsColumn: some View {
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

    /// The screen a link asked for, where this device has it (else Status).
    private func takeScreen() {
        let inbox = IntentInbox.shared
        guard let screen = inbox.screen else { return }
        inbox.screen = nil
        let landing = IntentInbox.landing(screen, isMember: isMember, canSeeFinances: finances.canSeePlan)
        model.sidebar = landing
        // No Finances here: no page of it waits either.
        if landing != .finances { inbox.financePage = nil }
    }

    /// Does what Siri, a shortcut or a link asked (IntentInbox.outcome), as
    /// the iPhone does: the app's page in the full list, then what waits on
    /// it. An app it can't tell is searched for, so the list shows what matches.
    private func takeRequest() {
        let inbox = IntentInbox.shared
        guard let request = inbox.pending, model.hasLoaded else { return }
        inbox.pending = nil
        let outcome = IntentInbox.outcome(of: request, in: model.apps(for: .all), available: { actions.available(for: $0) })
        model.sidebar = .status(.all)
        switch outcome {
        case .search(let said):
            model.search = said
        case .open(let id, let then):
            model.search = ""
            model.selectedAppID = id
            if let then, let app = model.app(id: id) {
                follow(then, on: app, model: model, actions: actions) { linkAsk = $0 }
            }
        }
    }

    /// Whether the list beside the detail is Status's apps (the content
    /// column's default: Status, or a place kept that this device lacks).
    private var showsAppList: Bool {
        switch model.sidebar {
        case .backups?, .setup?: isMember
        case .finances?, .settings?: false
        default: true
        }
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
                // Not rows to select: the selection is an app. Every Alert
                // opens beside the list, in the app's place.
                StatusCards(cards: model.cards, finances: finances)
                    .selectionDisabled()
                    .environment(\.openAlertLog, { model.openAlertLog() })
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
        Group {
            if model.inAwayMode {
                AwayModeView(model: model)
            } else {
                reading
            }
        }
        // Nothing answers: read the apps kept for it, and ask each.
        .task(id: live.cannotReach) { await model.loadAwayModeIfNothingAnswers() }
    }

    @ViewBuilder
    private var reading: some View {
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

/// Away mode (ADR-0023): neither home nor the tunnel answers, so only the
/// apps on the internet are listed, as last read, each with whether its own
/// address answers and Open. Everything else comes back by itself at home.
private struct AwayModeView: View {
    let model: DashboardViewModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Label("Can't reach home or the tunnel", systemImage: "wifi.exclamationmark")
                    .font(.headline)
                Text("Your apps on the internet, as last read. Everything else comes back by itself when the computer answers.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                VStack(spacing: 0) {
                    ForEach(model.awayApps) { app in
                        Button {
                            openURL(app.address)
                        } label: {
                            HStack(spacing: 10) {
                                Circle()
                                    .fill(dot(for: app))
                                    .frame(width: 9, height: 9)
                                Text(verbatim: app.name)
                                    .foregroundStyle(.primary)
                                Spacer()
                                Text(words(for: app))
                                    .font(.footnote)
                                    .foregroundStyle(Theme.secondaryInk)
                                Image(systemName: "arrow.up.right.square")
                                    .foregroundStyle(.tint)
                            }
                            .padding(.vertical, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text(verbatim: "\(app.name), \(words(for: app))"))
                        .accessibilityHint("Opens it in Safari")
                        if app.id != model.awayApps.last?.id { Divider() }
                    }
                }
                .padding(.horizontal, 14)
                .card(radius: 20)
                Button("Try Again") {
                    Task {
                        await model.refresh()
                        await model.loadAwayMode()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.liveEvents.isRefreshing)
            }
            .padding()
        }
    }

    private func dot(for app: AwayApp) -> Color {
        switch model.awayAnswers[app.id] {
        case true?: Design.running
        case false?: Theme.warning
        case nil: Color.secondary.opacity(0.4)
        }
    }

    private func words(for app: AwayApp) -> String {
        switch model.awayAnswers[app.id] {
        case true?: "Answers"
        case false?: "Not answering"
        case nil: "Asking…"
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

/// A folded group: its apps' logos in a row, as a Home Screen folder
/// shows its apps, and their names under them. A badge only on one that
/// isn't simply running. A tap opens the group.
struct FoldedGroupNames: View {
    let group: AppGroup
    let open: @MainActor () -> Void
    @ScaledMetric(relativeTo: .body) private var logo: CGFloat = 30
    /// How many logos fit before "+3".
    private let shown = 6

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    ForEach(group.apps.prefix(shown)) { app in
                        AppIconView(app: app, size: min(logo, 44), stateBadge: !app.isPlainlyFine)
                    }
                    if group.apps.count > shown {
                        Text(verbatim: "+\(group.apps.count - shown)")
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                            .frame(width: min(logo, 44), height: min(logo, 44))
                            .background(Theme.canvas, in: RoundedRectangle(cornerRadius: min(logo, 44) * 0.22, style: .continuous))
                    }
                    Spacer(minLength: 0)
                }
                Text(verbatim: group.apps.map(\.name).joined(separator: ", "))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: group.apps.map(\.name).joined(separator: ", ")))
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

