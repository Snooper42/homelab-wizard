import Foundation
import Observation

@MainActor
@Observable
final class DashboardViewModel {
    enum Filter: String, CaseIterable, Identifiable, Hashable {
        case all, attention, running, stopped

        var id: Self { self }

        var title: String {
            switch self {
            case .all: "All Apps"
            case .attention: "Needs Attention"
            case .running: "Running"
            case .stopped: "Stopped"
            }
        }

        var systemImage: String {
            switch self {
            case .all: "square.grid.2x2"
            case .attention: "exclamationmark.triangle"
            case .running: "play.circle"
            case .stopped: "stop.circle"
            }
        }

        func includes(_ app: AppStatus) -> Bool {
            switch self {
            case .all: true
            case .attention: app.needsAttention
            case .running: app.isRunning && !app.needsAttention
            case .stopped: !app.isRunning && !app.needsAttention
            }
        }
    }

    /// What the sidebar can show (Mac and iPad).
    enum SidebarItem: Hashable {
        case overview
        case backups
        case finances
        case computer
        case apps(Filter)
    }

    /// The selection in the sidebar (Mac and iPad).
    var sidebar: SidebarItem? = .apps(.all)
    /// The selected app (Mac and iPad). Stored by id, so the detail follows live updates.
    var selectedAppID: AppStatus.ID?
    /// The app whose log is open in a sheet.
    var logsApp: AppStatus?

    let liveEvents: LiveEventManager
    let cards: CardsViewModel
    let icons: IconStore
    let backups: BackupsViewModel
    /// The catalog, read once per unlock: it only changes with an update on the computer.
    private(set) var catalog: AppCatalog?
    @ObservationIgnored private var catalogLoading = false
    @ObservationIgnored private let api: APIClient

    init(api: APIClient, liveEvents: LiveEventManager) {
        self.liveEvents = liveEvents
        cards = CardsViewModel(api: api, liveEvents: liveEvents)
        icons = IconStore(api: api)
        backups = BackupsViewModel(api: api)
        self.api = api
    }

    var hasLoaded: Bool { liveEvents.status != nil }

    private var allApps: [AppStatus] {
        (liveEvents.status?.apps ?? []).sorted {
            $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }

    /// The apps a filter shows, pinned ones first in their pinned order.
    func apps(for filter: Filter) -> [AppStatus] {
        let order = pinnedOrder
        return allApps.filter(filter.includes).sorted { a, b in
            switch (order[a.id], order[b.id]) {
            case let (x?, y?): x < y
            case (_?, nil): true
            default: false
            }
        }
    }

    /// The pinned apps, in the order they were pinned.
    var pinnedApps: [AppStatus] {
        let order = pinnedOrder
        return allApps.filter { order[$0.id] != nil }.sorted { order[$0.id]! < order[$1.id]! }
    }

    private var pinnedOrder: [String: Int] {
        var order: [String: Int] = [:]
        for (i, id) in (liveEvents.status?.pinned ?? []).enumerated() where order[id] == nil { order[id] = i }
        // An app marked pinned that the list doesn't name goes after the rest.
        for app in liveEvents.status?.apps ?? [] where app.pinned == true && order[app.id] == nil { order[app.id] = order.count }
        return order
    }

    func count(for filter: Filter) -> Int {
        apps(for: filter).count
    }

    var attentionCount: Int { count(for: .attention) }

    func app(id: AppStatus.ID?) -> AppStatus? {
        guard let id else { return nil }
        return liveEvents.status?.apps.first { $0.id == id }
    }

    /// For example, "12 running · 1 needs attention".
    var summary: String {
        guard let status = liveEvents.status else { return "Loading…" }
        var parts = ["\(status.apps.filter(\.isRunning).count) running"]
        if attentionCount > 0 { parts.append("\(attentionCount) need\(attentionCount == 1 ? "s" : "") attention") }
        if status.missing > 0 { parts.append("\(status.missing) missing") }
        return parts.joined(separator: " · ")
    }

    var yearlySavings: Double? {
        guard let savings = liveEvents.status?.savings, savings > 0 else { return nil }
        return savings
    }

    /// Status and the cards together, in one StatusBoard request. If that
    /// fails, it falls back to Status alone.
    func refresh() async {
        await cards.load()
        if cards.error != nil { await liveEvents.refreshNow() }
    }

    func loadCatalog() async {
        guard catalog == nil, !catalogLoading else { return }
        catalogLoading = true
        defer { catalogLoading = false }
        do {
            catalog = try await api.call("Catalog", as: AppCatalog.self)
        } catch {
            // The page works without it; the description is just left out.
            Log.network.error("Catalog failed: \(APIError.from(error).logName, privacy: .public)")
        }
    }

    /// For the sidebar badge and the phone's overview row: failing checks.
    var failingChecks: Int { cards.watchdog?.failing.count ?? 0 }
}
