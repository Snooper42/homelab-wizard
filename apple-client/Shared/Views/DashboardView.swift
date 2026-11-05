import SwiftUI

/// The unlocked app. Its layout follows the platform:
/// - iPhone (compact width): a `NavigationStack` with pull to refresh,
///   push navigation and haptics.
/// - Mac and iPad (regular width): a three-column `NavigationSplitView`
///   with a sidebar, the app list and a detail pane.
struct DashboardView: View {
    @State private var model: DashboardViewModel
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    init(liveEvents: LiveEventManager) {
        _model = State(initialValue: DashboardViewModel(liveEvents: liveEvents))
    }

    var body: some View {
        Group {
            #if os(iOS)
            if sizeClass == .compact {
                PhoneDashboard(model: model)
            } else {
                SplitDashboard(model: model)
            }
            #else
            SplitDashboard(model: model)
            #endif
        }
        // A haptic when something new needs attention, not when it clears.
        .sensoryFeedback(.warning, trigger: model.attentionCount) { old, new in new > old }
    }
}

// MARK: - iPhone

private struct PhoneDashboard: View {
    let model: DashboardViewModel

    var body: some View {
        NavigationStack {
            List {
                Section {
                    OverviewHeader(model: model)
                }
                ForEach([DashboardViewModel.Filter.attention, .running, .stopped]) { filter in
                    let apps = model.apps(for: filter)
                    if !apps.isEmpty {
                        Section(filter.title) {
                            ForEach(apps) { app in
                                NavigationLink(value: app.id) {
                                    AppRowView(app: app)
                                }
                            }
                        }
                    }
                }
            }
            .overlay {
                if !model.hasLoaded {
                    ProgressView("Loading…")
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
    @State private var columns: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            List(selection: $model.selectedFilter) {
                Section {
                    ForEach(DashboardViewModel.Filter.allCases) { filter in
                        Label(filter.title, systemImage: filter.systemImage)
                            .badge(model.count(for: filter))
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
            let filter = model.selectedFilter ?? .all
            let apps = model.apps(for: filter)
            List(apps, selection: $model.selectedAppID) { app in
                AppRowView(app: app)
            }
            .overlay {
                if !model.hasLoaded {
                    ProgressView("Loading…")
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
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        Task { await model.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .disabled(model.liveEvents.isRefreshing)
                    .help("Read the status again (⌘R)")

                    DeviceMenu()
                }
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
