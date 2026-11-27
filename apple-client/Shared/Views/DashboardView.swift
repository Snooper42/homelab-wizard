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
    @Environment(\.scenePhase) private var scenePhase

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
                case .fix, .updateAll: await dashboard?.refresh()
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
        // When Homelab Wizard last stopped unexpectedly: Status's crash note.
        .task { if actions.computerAnswers("LastCrash") { await model.readCrash() } }
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
        // Lock After keeps the app open a while after it leaves the screen;
        // a member's private Finances still lock as it leaves (private-finances.md).
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { finances.lockPrivate() }
        }
        // The cards change slowly: read them now, then every 5 minutes while
        // unlocked. What this device may do is read again with them: the
        // computer can give a phone its changes for a while only,
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
    /// Under the sidebar's name, so a Stage Manager window that widens keeps its screen.
    @SceneStorage(DashboardViewModel.placeKey) private var savedTab = "apps:all"
    @Environment(AppCoordinator.self) private var coordinator

    /// A household member's phone: their apps, their Finances, and this
    /// device. The homelab's backups and setup are the owner's.
    private var isMember: Bool { coordinator.device?.isMember == true }

    private var tab: Binding<Screen> {
        Binding(
            get: {
                let screen = (Screen(storageKey: savedTab) ?? .status(.all)).row
                // Backups is one of Status' pages on the iPhone, and Setup one of Settings', as on the computer.
                if screen == .backups { return .status(.all) }
                if screen == .setup { return isMember ? .status(.all) : .settings }
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
            PhoneStatus(model: model, computer: computer, isMember: isMember)
                .tabItem { Label("Status", systemImage: Screen.status(.all).systemImage) }
                .badge(model.attentionCount + (isMember ? 0 : model.backups.needsAttention))
                .tag(Screen.status(.all))
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
            if screen == .backups || screen == .setup {
                savedTab = Screen.status(.all).storageKey
                if !isMember { IntentInbox.shared.statusPage = screen == .backups ? .backups : .setup }
            } else {
                savedTab = screen.storageKey
            }
            IntentInbox.shared.screen = nil
            // No Finances on this phone: no page of it waits either.
            if !finances.canSeePlan { IntentInbox.shared.financePage = nil }
        }
        #if SCREENSHOTS
        .onAppear {
            if let tab = screenshotTab {
                if tab == .backups || tab == .setup {
                    savedTab = Screen.status(.all).storageKey
                    IntentInbox.shared.statusPage = tab == .backups ? .backups : .setup
                } else {
                    savedTab = tab.storageKey
                }
            }
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
        } else if ScreenshotMode.shot == "phones" {
            PhonesPage(computer: computer)
        } else if ScreenshotMode.shot == "storage", let storage = model.cards.storage {
            StoragePage(storage: storage, nameOf: { model.app(id: $0)?.name ?? $0 })
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
        // A page's picture opens it over Finances' home as a link does, so it has its back button
        // (as the tab's root, light-budgets and the rest had none); the transaction and the
        // skeleton as before.
        if let page = DeepLink.FinancePage(rawValue: ScreenshotMode.shot ?? "") {
            FinancesView(finances: finances)
                .task(id: finances.canSeePlan) {
                    guard finances.canSeePlan, IntentInbox.shared.financePage == nil else { return }
                    IntentInbox.shared.financePage = page
                }
        } else {
            FinancesView.screenshotRoot(finances: finances)
        }
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
        case "status", "app", "category": .status(.all)
        case "backups": .backups
        case "setup": .setup
        case "settings", "settings-all", "phones", "storage": .settings
        default: .finances
        }
    }
}
#endif

/// Status on iPhone, as the computer's Overview: Apps, Backups and the machine as
/// three cards of one anatomy, then the categories, each opening its page. Nothing below them. While searching,
/// only the apps that match.
private struct PhoneStatus: View {
    @Bindable var model: DashboardViewModel
    let computer: ComputerViewModel
    /// A household member's phone: their apps only (and no backups to read).
    var isMember = false
    /// An app's page grows out of its row (iOS 18).
    @Namespace private var zoom
    @Environment(AppActionsViewModel.self) private var actions
    /// A link's action, waiting for its one tap.
    @State private var linkAsk: LinkAsk?
    /// The pages open on Status, so Siri can open one.
    @State private var path: [StatusPlace] = []
    /// The wide layout's app taken over once, when this layout appears (not
    /// each time the list shows again, or Back would open it again).
    @State private var tookWidePlace = false

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if model.isSearching {
                    // While searching, every match, by group.
                    ForEach(model.groups(matching: model.search)) { group in
                        Section {
                            ForEach(group.apps) { app in
                                NavigationLink(value: StatusPlace.app(app.id)) {
                                    AppRowView(app: app)
                                }
                                .zoomSource(id: app.id, in: zoom)
                                .appActionControls(for: app)
                            }
                        } header: {
                            Text(verbatim: group.label)
                        }
                    }
                } else if model.hasLoaded {
                    Section {
                        if let note = model.crashNote {
                            CrashNoteCard(note: note, model: model)
                                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                                .listRowBackground(Color.clear)
                        }
                        OverviewCards(model: model, computer: computer, isMember: isMember,
                                      open: { id in path.append(.app(id)) }, seeAll: { path.append(.every) })
                            // Room under a card for its shadow, which the row would otherwise cut.
                            .padding(.bottom, 6)
                            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 0, trailing: 0))
                            .listRowBackground(Color.clear)
                        if !isMember, let steps = computer.setupSteps, !steps.isEmpty, !SetupChecklist.progress(steps).allDone {
                            Button { path.append(.setup) } label: {
                                SetupCard(steps: steps)
                            }
                            .buttonStyle(PressableButtonStyle())
                            .accessibilityHint("Opens Setup")
                            .padding(.bottom, 6)
                            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 0, trailing: 0))
                            .listRowBackground(Color.clear)
                        }
                    }
                    // Analytics, as the first of the computer's Status menu after the Overview (not a member's).
                    if !isMember {
                        Section {
                            NavigationLink(value: StatusPlace.analytics) {
                                AnalyticsRow(model: model)
                            }
                            if actions.computerAnswers("SavingsRows") {
                                NavigationLink(value: StatusPlace.subscriptions) {
                                    SubscriptionsRow(model: model)
                                }
                            }
                            NavigationLink(value: StatusPlace.backups) {
                                BackupsRow(model: model)
                            }
                            .badge(model.backups.needsAttention)
                        }
                    }
                    // The categories as one list, a row each (the computer's panel): a tap opens its page.
                    let categories = StatusCategory.list(apps: model.liveEvents.status?.apps ?? [], catalog: model.catalog)
                    if !categories.isEmpty {
                        Section {
                            ForEach(categories) { category in
                                NavigationLink(value: StatusPlace.category(category.id)) {
                                    CategoryRow(category: category)
                                }
                                .contextMenu { GroupActionItems(apps: category.apps) }
                            }
                        } header: {
                            HStack {
                                Text("Categories")
                                Spacer()
                                Button("Show Every App") { path.append(.every) }
                                    .font(.subheadline)
                                    .textCase(nil)
                            }
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
            .searchable(text: $model.search, prompt: "Find an app")
            .navigationTitle("Status")
            .navigationDestination(for: StatusPlace.self) { place in
                switch place {
                case .app(let id):
                    AppDetailView(app: model.app(id: id))
                        .zoomTransition(id: id, in: zoom)
                case .category(let id):
                    CategoryPage(model: model, id: id, zoom: zoom)
                case .every:
                    EveryAppPage(model: model, zoom: zoom)
                case .analytics:
                    AnalyticsPage(model: model)
                case .subscriptions:
                    SubscriptionsPage(model: model)
                case .backups:
                    BackupsView(backups: model.backups)
                case .setup:
                    ComputerView(computer: computer, page: .setup)
                }
            }
            // Stage Manager and Split View: the app open beside the list when the
            // window was wide, and the one open here if it widens.
            .onAppear {
                guard !tookWidePlace else { return }
                tookWidePlace = true
                if path.isEmpty { path = model.phoneStatusPath(keeping: []).map(StatusPlace.app) }
            }
            .onChange(of: path) { _, path in model.followPhoneStatus(path: path.compactMap(\.appID)) }
            #if SCREENSHOTS
            // The screenshots: an app's page, opened as a tap opens it (its own title, no Status search over
            // it: an overlay on the list showed both, apple-loop.md item 1).
            .onChange(of: model.hasLoaded, initial: true) {
                guard path.isEmpty, model.hasLoaded else { return }
                // A category's page: Media, as the computer's picture.
                if ScreenshotMode.shot == "category" { path.append(.category("media")) }
                guard ScreenshotMode.shot == "app", let app = model.app(id: "vikunja") ?? model.latestApps.first else { return }
                path.append(.app(app.id))
            }
            #endif
            .refreshable {
                // Status, and the backups the Backups card and tab's badge count.
                guard !isMember else { return await model.refresh() }
                async let backups: Void = model.backups.load()
                await model.refresh()
                await backups
            }
            // The Backups card and the tab's badge, read once if that tab hasn't yet.
            .task { if !isMember, model.backups.overview == nil { await model.backups.load() } }
            // Finish setting up's card, while steps are left.
            .task(id: model.hasLoaded) { if !isMember, model.hasLoaded { await computer.loadSetup() } }
            // Siri or a shortcut: the app's page, and the action asked for,
            // once Status is read (after unlock).
            .onChange(of: IntentInbox.shared.pending, initial: true) { takeRequest() }
            .onChange(of: model.hasLoaded) { takeRequest() }
            // A link, the Backups card or a screenshot asked for one of Status' pages.
            .onChange(of: IntentInbox.shared.statusPage, initial: true) { _, page in
                guard let page else { return }
                path = [page]
                IntentInbox.shared.statusPage = nil
            }
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
            path = [.app(id)]
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

/// Homelab Wizard's mark and name, atop the sidebar as on the computer.
private struct BrandHeader: View {
    var body: some View {
        HStack(spacing: 10) {
            AppMark(size: 30)
            // On one line at every size (at the largest it broke as "Ho mel ab Wiz ard"), in the theme's
            // own ink: in the sidebar's header `.primary` read grey (4.0:1) (ipad-land-*-status).
            Text("Homelab Wizard")
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
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
    @Environment(HomelabTasksViewModel.self) private var tasks
    /// ⌘K: the palette, and Transactions' own commands while it's in front.
    @State private var paletteOpen = false
    /// Transactions' own commands, when it was in front as ⌘K opened the palette
    /// (passed in by the menu: this view reads no focused value, FocusedValueTests).
    @State private var transactionsFocus: TransactionsFocus?
    /// The sidebar's choice, kept across launches as the computer keeps each
    /// screen's place. Only the choice is kept, never what it shows.
    @SceneStorage(DashboardViewModel.placeKey) private var savedSidebar = "apps:all"
    /// Which Status groups are open (StatusFolds), as on iPhone, and the
    /// computer's for every device (FoldSync).
    @SceneStorage("statusFolds") private var folds = ""
    /// What the computer last said they are, to tell the person's own changes apart.
    @State private var computerFolds: String?
    @Bindable var model: DashboardViewModel
    let computer: ComputerViewModel
    let finances: FinancesViewModel
    @State private var columns: NavigationSplitViewVisibility = .all
    /// The window's width, which Stage Manager and Split View change.
    @State private var width: CGFloat = 1194
    @Environment(\.dynamicTypeSize) private var typeSize
    /// A link's action, waiting for its one tap.
    @State private var linkAsk: LinkAsk?

    /// The computer's screens a phone can reach, in its sidebar's order.
    /// A household member's iPad: their apps, their Finances, and Settings.
    private var isMember: Bool { coordinator.device?.isMember == true }

    private var screens: [Screen] {
        if isMember {
            return [.status(.all)] + (finances.canSeePlan ? [.finances] : []) + [.settings]
        }
        // Backups is one of Status' pages and Setup one of Settings', as on the computer.
        return [.status(.all)] + (finances.canSeePlan ? [.finances] : []) + [.settings]
    }

    /// The highlighted row: Status for any of its filters. Picking Status
    /// again keeps the filter it shows.
    private var row: Binding<Screen?> {
        Binding(
            get: { model.sidebar?.row },
            set: { picked in if picked != model.sidebar?.row { model.sidebar = picked } }
        )
    }

    /// The computer's screens, beside whatever is open (Backups' two columns and the rest's three share it).
    private var sidebar: some View {
        List(selection: row) {
            Section {
                ForEach(screens, id: \.self) { screen in
                    Label(screen.title, systemImage: screen.systemImage)
                        // Whole at the largest text: the column broke them ("Backu ps", "Fi- nances",
                        // ipad-land-large-status, Nov 20); smaller instead, as Status's group names.
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
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
            let saved = Screen(storageKey: savedSidebar) ?? .status(.all)
            if (saved == .backups || saved == .setup) && !isMember {
                model.sidebar = .status(.all)
            } else {
                model.sidebar = saved
            }
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
            IntentInbox.shared.statusPage = .app(id)
        }
        // Wider at the largest text, where it starts hidden (below) and is shown with its button.
        .navigationSplitViewColumnWidth(min: 190, ideal: typeSize.isAccessibilitySize ? 320 : 220)
        // The folds are the computer's, the same on every device.
        .task(id: model.hasLoaded) { await FoldSync.pull(model: model, actions: actions, folds: $folds, computer: $computerFolds) }
        .onChange(of: folds) { _, new in FoldSync.push(new, model: model, actions: actions, computer: $computerFolds) }
        .safeAreaInset(edge: .bottom) {
            ConnectionBadge(state: model.liveEvents.connection)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
    }

    /// Backups and Setup, beside the sidebar across the whole width: a household member's iPad has neither.
    /// (Setup opens nothing, so its right side would only ever be empty: landscape pictures)
    private var wideScreen: Bool { statusWide || ((model.sidebar == .backups || model.sidebar == .setup) && !isMember) }

    /// Status beside the sidebar across the whole width, as the iPhone's: the Overview, its pages opening over it.
    private var statusWide: Bool { model.sidebar == .status(.all) }

    var body: some View {
        Group {
            if wideScreen {
                // Backups across the whole width: the sidebar and Backups, its More pages
                // opening over it.
                NavigationSplitView(columnVisibility: $columns) {
                    sidebar
                } detail: {
                    if statusWide {
                        PhoneStatus(model: model, computer: computer, isMember: isMember)
                    } else {
                    NavigationStack {
                        Group {
                            if model.sidebar == .setup {
                                ComputerView(computer: computer, page: .setup)
                            } else {
                                BackupsView(backups: model.backups, columns: 2)
                            }
                        }
                        .modifier(HealthLineInset(model: model) { model.sidebar = .status(.attention) })
                        .toolbar { toolbarItems }
                    }
                    }
                }
            } else {
                NavigationSplitView(columnVisibility: $columns) {
                    sidebar
                } content: {
                switch model.sidebar {
                // A household member's iPad has neither (a place kept from before).
                case .backups? where isMember, .setup? where isMember:
                    appList
                case .backups?:
                    // Across the whole width beside the sidebar, in its own two columns (below); here only for a moment.
                    BackupsView(backups: model.backups)
                case .finances?:
                    financesColumn
                        // A link to one of its pages (homelab://finances/budgets).
                        .navigationDestination(item: Binding(
                            get: { IntentInbox.shared.financePage },
                            set: { IntentInbox.shared.financePage = $0 }
                        )) { page in
                            FinancesView.linkedPage(page, finances: finances)
                        }
                        .modifier(HealthLineInset(model: model) { model.sidebar = .status(.attention) })
                        .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                        .toolbar { toolbarItems }
                case .setup?:
                    ComputerView(computer: computer, page: .setup)
                        .modifier(HealthLineInset(model: model) { model.sidebar = .status(.attention) })
                        .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                        .toolbar { toolbarItems }
                case .settings? where isMember:
                    MemberSettingsView()
                        .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                case .settings?:
                    settingsColumn
                        .modifier(HealthLineInset(model: model) { model.sidebar = .status(.attention) })
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
                } else if showsAppList, let app = model.app(id: model.selectedAppID) {
                    // Beside Status's list, the page has a stack of its own, so
                    // More About and Everything That Was Done open in it (a split
                    // view's last column has none); another app starts at its page.
                    NavigationStack { AppDetailView(app: app) }
                        .id(app.id)
                        .focusedSceneValue(\.selectedApp, SelectedAppFocus(app: app, actions: actions, showLogs: { model.logsApp = app }))
                } else if !showsAppList {
                    // Beside another screen, its own page (the owner's pick, Nov 15:
                    // pages open on the right); that screen's links open here over it.
                    screenDetail
                } else {
                    ContentUnavailableView(
                        "No App Selected",
                        systemImage: "server.rack",
                        description: Text("Choose an app to see its details.")
                    )
                }
            }
            }
        }
        // Three columns only where they fit: in a narrower window (Stage Manager, Split View, upright) or at the
        // largest text, the sidebar starts hidden, a tap of its button away.
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onChange(of: DashboardViewModel.startsWithSidebar(width: width, largeText: typeSize.isAccessibilitySize), initial: true) { _, shown in
            columns = shown ? .all : .doubleColumn
        }
        // ⌘2 to ⌘6, as the computer's: the View menu (ScreenCommands).
        .focusedSceneValue(\.screenChoice, ScreenChoice(canSeeFinances: finances.canSeePlan) { screen in
            model.sidebar = screen
        })
        .focusedSceneValue(\.palette, PaletteFocus { transactions in
            transactionsFocus = transactions
            paletteOpen = true
        })
        .sheet(isPresented: $paletteOpen) {
            CommandPaletteView(commands: paletteCommands, run: runPalette)
        }
        .linkAskDialog($linkAsk)
        #if SCREENSHOTS
        // The iPad's pictures: the shot's screen (kept as the place, so the
        // sidebar showing later doesn't undo it), and beside Status's list
        // an app's page, as a tap opens it.
        .onAppear {
            // Amounts shown, as the iPhone's pictures show them (light-finances-hidden keeps them hidden).
            finances.amountsShown = !ScreenshotMode.hidesAmounts
            guard let screen = ScreenshotMode.screen else { return }
            savedSidebar = screen.storageKey
            model.sidebar = screen
        }
        .onChange(of: model.hasLoaded, initial: true) {
            // Status' own stack opens the app for the app shot; the Overview stays for the others.
            guard model.hasLoaded, model.selectedAppID == nil, model.sidebar != .status(.all),
                  ScreenshotMode.shot == "status" || ScreenshotMode.shot == "app",
                  let app = model.app(id: "vikunja") ?? model.latestApps.first else { return }
            model.selectedAppID = app.id
        }
        #endif
    }

    /// What's on the right beside a screen other than Status, before one of its
    /// links is tapped: Finances' first page (Bills), every setting, or what opens there.
    @ViewBuilder
    private var screenDetail: some View {
        switch model.sidebar {
        case .finances?:
            #if SCREENSHOTS
            if ScreenshotMode.isFinancePage {
                FinancesView.screenshotRoot(finances: finances)
            } else {
                FinancesView.linkedPage(.bills, finances: finances)
            }
            #else
            FinancesView.linkedPage(.bills, finances: finances)
            #endif
        case .settings?:
            if isMember {
                ContentUnavailableView("Settings", systemImage: "gearshape", description: Text("This iPad's settings are beside this."))
            } else {
                SettingsFormView(computer: computer, section: nil)
            }
        case .backups?:
            ContentUnavailableView("Backups", systemImage: "externaldrive")
        case .setup?:
            ContentUnavailableView("Setup", systemImage: "wrench.and.screwdriver")
        default:
            ContentUnavailableView("No App Selected", systemImage: "server.rack", description: Text("Choose an app to see its details."))
        }
    }

    /// What the palette offers now, as this device may.
    private var paletteCommands: [PaletteCommand] {
        let can = Palette.Can(seeFinances: finances.canSeePlan, change: actions.canChangeApps,
                              backUp: !isMember && tasks.canRun && tasks.running == nil,
                              importFile: transactionsFocus != nil, addTransaction: transactionsFocus != nil,
                              showAmounts: finances.canSeePlan && !finances.amountsHiddenByPlan, amountsShown: finances.amountsShown)
        return Palette.commands(screens: screens, groups: model.groups, can: can, available: { actions.available(for: $0) })
    }

    /// Runs what a command's own button runs: Face ID for a change, as there.
    private func runPalette(_ c: PaletteCommand) {
        func app(_ id: AppStatus.ID) -> AppStatus? { model.app(id: id) }
        switch c.action {
        case .screen(let screen):
            model.sidebar = screen
        case .financePage(let page):
            IntentInbox.shared.open(.finances(page: page))
        case .openApp(let id):
            model.search = ""
            model.sidebar = .status(.all)
            model.selectedAppID = id
            IntentInbox.shared.statusPage = .app(id)
        case .app(let id, let action):
            guard let a = app(id) else { return }
            // Stop was asked twice in the palette, as the computer's: it runs now (Face ID first).
            if action == .stop { Task { await actions.run(.stop, on: a) } } else { actions.request(action, on: a) }
        case .logs(let id):
            if let a = app(id) { model.logsApp = a }
        case .group(let ids, let action):
            let apps = ids.compactMap(app)
            Task { await actions.runGroup(action, on: apps) }
        case .backUpNow:
            tasks.start(.backup)
        case .amounts:
            finances.amountsShown.toggle()
        case .importFile:
            transactionsFocus?.importFile()
        case .addTransaction:
            transactionsFocus?.addTransaction()
        }
    }

    /// Finances in the content column (in the pictures, the page the shot names).
    @ViewBuilder
    private var financesColumn: some View {
        #if SCREENSHOTS
        // A page's picture shows it on the right, beside the home, as a tap opens it.
        if ScreenshotMode.isFinancePage {
            FinancesView(finances: finances)
        } else {
            FinancesView.screenshotRoot(finances: finances)
        }
        #else
        FinancesView(finances: finances)
        #endif
    }

    /// Settings in the content column (in the pictures, every setting for `settings-all`).
    @ViewBuilder
    private var settingsColumn: some View {
        // Every setting is on the right beside it (settings-all's picture too).
        ComputerView(computer: computer, page: .settings)
    }

    /// The screen a link asked for, where this device has it (else Status).
    private func takeScreen() {
        let inbox = IntentInbox.shared
        guard let screen = inbox.screen else { return }
        inbox.screen = nil
        let landing = IntentInbox.landing(screen, isMember: isMember, canSeeFinances: finances.canSeePlan)
        if landing == .backups || landing == .setup {
            model.sidebar = .status(.all)
            inbox.statusPage = landing == .backups ? .backups : .setup
            inbox.financePage = nil
            return
        }
        model.sidebar = landing
        // No Finances here: no page of it waits either.
        if landing != .finances { inbox.financePage = nil }
    }

    /// Does what Siri, a shortcut or a link asked (IntentInbox.outcome), as
    /// the iPhone does: the app's page in the full list, then what waits on
    /// it. An app it can't tell is searched for, so the list shows what matches.
    private func takeRequest() {
        // Status' own stack opens the app's page and does what waits on it, as on the iPhone.
        guard IntentInbox.shared.pending != nil, model.hasLoaded else { return }
        model.sidebar = .status(.all)
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
        case .status: model.attentionCount + (isMember ? 0 : model.backups.needsAttention)
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
        }
        // Again once the device's level is known: right after unlock it may not be yet.
        .task(id: finances.canSeeMoney) { await finances.load() }
        .safeAreaInset(edge: .top) {
            VStack(spacing: 0) {
                if let note = model.crashNote {
                    CrashNoteCard(note: note, model: model)
                        .padding(.horizontal)
                        .padding(.top, 8)
                }
                if model.overnightLine != nil {
                    OvernightLine(model: model)
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                        .background(.bar)
                }
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
                GroupActionsMenu(apps: apps, icon: "playpause.circle")
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
                .tint(Theme.accentFill)
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
                .card()
                Button("Try Again") {
                    Task {
                        await model.refresh()
                        await model.loadAwayMode()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accentFill)
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

/// The health line beside Status's list: atop the screen on the Mac, under it
/// on the iPad. Atop, it took the place of the iPad's large titles (a blank
/// band over Backups, Finances, Setup and Settings, apple-loop.md item 1); the
/// iPad keeps it, as the sidebar that badges Status is hidden in portrait.
private struct HealthLineInset: ViewModifier {
    let model: DashboardViewModel
    let open: @MainActor () -> Void

    func body(content: Content) -> some View {
        #if os(iOS)
        content.safeAreaInset(edge: .bottom) { HealthLineBar(model: model, open: open) }
        #else
        content.safeAreaInset(edge: .top) { HealthLineBar(model: model, open: open) }
        #endif
    }
}

/// Health in one line: atop every screen but Status and an
/// app's page, "All well" or the one thing that needs you. On iPhone, Back
/// is the way to Status; on the Mac and iPad, Open Status shows the apps
/// that need a look.
struct HealthLineBar: View {
    let model: DashboardViewModel
    var open: (@MainActor () -> Void)? = nil
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if let line = model.healthLine {
            // Side by side; at the largest sizes one over the other, so the app's
            // name isn't broken in a narrow column ("Mealie /: Sto…").
            let stacked = typeSize.isAccessibilitySize
            let layout = stacked ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout(spacing: 8))
            layout {
                if line.isEmpty {
                    Label("All well", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Theme.success)
                } else {
                    Label {
                        Text(verbatim: line).lineLimit(stacked ? 3 : 2)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle.fill")
                    }
                    .foregroundStyle(Theme.danger)
                }
                if !stacked { Spacer(minLength: 8) }
                if !line.isEmpty, let open {
                    Button("Open Status", action: open)
                        .buttonStyle(.borderless)
                }
            }
            .font(.callout.weight(.medium))
            // A bar under every screen grows no further than the first accessibility size, as
            // Open Its Page: at the largest it took a quarter of the iPad's Finances column on
            // three lines (ipad-land-large-finances). Still one over the other there.
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .frame(maxWidth: .infinity, alignment: .leading)
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
                    Image(systemName: "chevron.right").accessibilityHidden(true)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(open ? 90 : 0))
                    // Shrunk to fit rather than cut: at the largest text the iPad's
                    // column read "Net…" and "Sec…".
                    Text(verbatim: group.label)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                    // A category's pill says how many run (the redesign's); Needs a look and Pinned keep their count.
                    if let pill = group.runningPill {
                        Text(verbatim: pill.words)
                            .pill(pill.fine ? Theme.success : Theme.warning)
                    } else {
                        Text("\(group.apps.count)")
                            .pill(group.alert ? Theme.danger : .secondary)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // The group's name first: the menu beside it gives way to ⋯ (GroupActionsMenu).
            .layoutPriority(1)
            .accessibilityLabel(Text(verbatim: "\(group.label), \(group.apps.count) \(group.apps.count == 1 ? "app" : "apps")"))
            .accessibilityValue(open ? "Open" : "Folded")
            .accessibilityHint(open ? "Folds the group" : "Opens the group")
            Spacer()
            GroupActionsMenu(apps: group.apps)
                .font(.caption)
                .dynamicTypeSize(...DynamicTypeSize.accessibility1)
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
    @Environment(\.dynamicTypeSize) private var typeSize
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
                    .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
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
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if let words = model.overnightLine {
            // At the largest sizes the button goes under the words: beside them, in the
            // iPad's column, both broke a letter or two a line ("Over / nigh / t:").
            if typeSize.isAccessibilitySize {
                // The words the whole width, without the moon beside them: in the iPad's column the
                // colon still went to a line of its own ("Overnight /: 2 apps").
                VStack(alignment: .leading, spacing: 6) {
                    Text(words).font(.callout)
                    hide
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Image(systemName: "moon.stars").foregroundStyle(.secondary).accessibilityHidden(true)
                    Text(words).font(.callout)
                    Spacer(minLength: 4)
                    hide
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private var hide: some View {
        Button("Hide Until Tomorrow") { model.hideOvernight() }
            .font(.caption)
            .buttonStyle(.borderless)
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

