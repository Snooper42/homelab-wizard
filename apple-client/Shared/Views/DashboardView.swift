import SwiftUI

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
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    init(coordinator: AppCoordinator) {
        api = coordinator.api
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
        // The cards change slowly: read them now, then every 5 minutes while unlocked.
        .task { await model.loadCatalog() }
        .task {
            while !Task.isCancelled {
                await model.cards.load()
                try? await Task.sleep(for: .seconds(300))
            }
        }
    }
}

// MARK: - iPhone

private struct PhoneDashboard: View {
    let model: DashboardViewModel
    let computer: ComputerViewModel
    let finances: FinancesViewModel

    var body: some View {
        NavigationStack {
            List {
                Section {
                    OverviewHeader(model: model)
                    NavigationLink {
                        OverviewView(cards: model.cards, finances: finances)
                    } label: {
                        Label(finances.canSeeMoney ? "Money, Watchdog & Alerts" : "Watchdog, Protection & Alerts", systemImage: "gauge.with.dots.needle.33percent")
                            .badge(model.failingChecks)
                    }
                    NavigationLink {
                        BackupsView(backups: model.backups)
                    } label: {
                        Label("Backups", systemImage: "externaldrive.badge.checkmark")
                            .badge(model.backups.needsAttention)
                    }
                    if finances.canSeePlan {
                        NavigationLink {
                            FinancesView(finances: finances)
                        } label: {
                            Label("Finances", systemImage: "banknote")
                        }
                    }
                    NavigationLink {
                        ComputerView(computer: computer)
                    } label: {
                        Label("Computer", systemImage: "desktopcomputer")
                    }
                }
                ForEach([DashboardViewModel.Filter.attention, .running, .stopped]) { filter in
                    let apps = model.apps(for: filter)
                    if !apps.isEmpty {
                        Section {
                            ForEach(apps) { app in
                                NavigationLink(value: app.id) {
                                    AppRowView(app: app)
                                }
                                .appActionControls(for: app)
                            }
                        } header: {
                            HStack {
                                Text(filter.title)
                                Spacer()
                                GroupActionsMenu(apps: apps)
                                    .textCase(nil)
                                    .font(.caption)
                            }
                        }
                    }
                }
            }
            .overlay {
                if !model.hasLoaded {
                    NotLoadedView(model: model)
                }
            }
            .navigationTitle("Homelab")
            .navigationDestination(for: AppStatus.ID.self) { id in
                AppDetailView(app: model.app(id: id))
            }
            .refreshable { await model.refresh() }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    DeviceMenu()
                }
            }
        }
    }
}

// MARK: - Mac & iPad

private struct SplitDashboard: View {
    @Bindable var model: DashboardViewModel
    let computer: ComputerViewModel
    let finances: FinancesViewModel
    @State private var columns: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            List(selection: $model.sidebar) {
                Section {
                    Label("Overview", systemImage: "gauge.with.dots.needle.33percent")
                        .badge(model.failingChecks)
                        .tag(DashboardViewModel.SidebarItem.overview)
                    Label("Backups", systemImage: "externaldrive.badge.checkmark")
                        .badge(model.backups.needsAttention)
                        .tag(DashboardViewModel.SidebarItem.backups)
                    if finances.canSeePlan {
                        Label("Finances", systemImage: "banknote")
                            .tag(DashboardViewModel.SidebarItem.finances)
                    }
                    Label("Computer", systemImage: "desktopcomputer")
                        .tag(DashboardViewModel.SidebarItem.computer)
                }
                Section("Apps") {
                    ForEach(DashboardViewModel.Filter.allCases) { filter in
                        Label(filter.title, systemImage: filter.systemImage)
                            .badge(model.count(for: filter))
                            .tag(DashboardViewModel.SidebarItem.apps(filter))
                    }
                }
            }
            .navigationTitle("Homelab")
            .navigationSplitViewColumnWidth(min: 190, ideal: 220)
            .safeAreaInset(edge: .bottom) {
                ConnectionBadge(state: model.liveEvents.connection)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
        } content: {
            switch model.sidebar {
            case .overview?:
                OverviewView(cards: model.cards, finances: finances)
                    .navigationSplitViewColumnWidth(min: 300, ideal: 380)
                    .toolbar { toolbarItems }
            case .backups?:
                BackupsView(backups: model.backups)
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .finances?:
                FinancesView(finances: finances)
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            case .computer?:
                ComputerView(computer: computer)
                    .navigationSplitViewColumnWidth(min: 320, ideal: 420)
                    .toolbar { toolbarItems }
            default:
                appList
            }
        } detail: {
            if let app = model.app(id: model.selectedAppID) {
                AppDetailView(app: app)
            } else {
                ContentUnavailableView(
                    "No App Selected",
                    systemImage: "server.rack",
                    description: Text("Choose an app to see its details.")
                )
            }
        }
    }

    private var appList: some View {
        let filter: DashboardViewModel.Filter
        if case .apps(let chosen)? = model.sidebar { filter = chosen } else { filter = .all }
        let apps = model.apps(for: filter)
        return List(apps, selection: $model.selectedAppID) { app in
            AppRowView(app: app)
                .appActionControls(for: app)
        }
        .overlay {
            if !model.hasLoaded {
                NotLoadedView(model: model)
            } else if apps.isEmpty {
                ContentUnavailableView(filter.emptyTitle, systemImage: filter.systemImage)
            }
        }
        .navigationTitle(filter.title)
        #if os(macOS)
        .navigationSubtitle(model.summary)
        #endif
        .navigationSplitViewColumnWidth(min: 260, ideal: 320)
        .refreshable { await model.refresh() }
        .toolbar {
            toolbarItems
            ToolbarItem(placement: .automatic) {
                GroupActionsMenu(apps: apps)
            }
        }
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

private extension DashboardViewModel.Filter {
    var emptyTitle: String {
        switch self {
        case .all: "No Apps"
        case .attention: "Nothing Needs Attention"
        case .running: "Nothing Running"
        case .stopped: "Nothing Stopped"
        }
    }
}

// MARK: - Shared pieces

private struct OverviewHeader: View {
    let model: DashboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ConnectionBadge(state: model.liveEvents.connection)
            Text(model.summary)
                .font(.headline)
            if let savings = model.yearlySavings {
                Text("Replaces \(savings, format: .currency(code: "USD").precision(.fractionLength(0))) a year in subscriptions")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let error = model.liveEvents.refreshError {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }
        .padding(.vertical, 4)
    }
}

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
