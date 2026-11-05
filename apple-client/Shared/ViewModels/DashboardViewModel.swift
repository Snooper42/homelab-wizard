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

        /// How the choice is kept between launches: a name, nothing more.
        var storageKey: String {
            switch self {
            case .overview: "overview"
            case .backups: "backups"
            case .finances: "finances"
            case .computer: "computer"
            case .apps(let filter): "apps:" + filter.rawValue
            }
        }

        init?(storageKey: String) {
            switch storageKey {
            case "overview": self = .overview
            case "backups": self = .backups
            case "finances": self = .finances
            case "computer": self = .computer
            default:
                guard storageKey.hasPrefix("apps:"), let filter = Filter(rawValue: String(storageKey.dropFirst(5))) else { return nil }
                self = .apps(filter)
            }
        }
    }

    /// The selection in the sidebar (Mac and iPad).
    var sidebar: SidebarItem? = .apps(.all)
    /// The selected app (Mac and iPad). Stored by id, so the detail follows live updates.
    var selectedAppID: AppStatus.ID?
    /// The app whose log is open in a sheet.
    var logsApp: AppStatus?
    /// What's typed in the app list's search field. It goes with the
    /// dashboard on lock, and isn't kept.
    var search = ""

    /// Whether `app` matches the search: its name or id, regardless of case
    /// and accents. Everything matches an empty search.
    func matchesSearch(_ app: AppStatus) -> Bool { Self.matches(app, search) }

    nonisolated static func matches(_ app: AppStatus, _ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return true }
        let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
        return app.name.range(of: needle, options: options) != nil
            || app.id.range(of: needle, options: options) != nil
    }

    var isSearching: Bool { !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

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
        return allApps.filter { order[$0.id] != nil }.sorted { (order[$0.id] ?? 0) < (order[$1.id] ?? 0) }
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

    /// For example, "12 of 14 running · 1 needs attention".
    var summary: String {
        guard let status = liveEvents.status else { return "Loading…" }
        return Self.summary(of: status)
    }

    /// The computer's Running and Needs a look tiles, in one line. The
    /// phone companion waiting for its scheduled jobs isn't counted, as there.
    nonisolated static func summary(of status: HomelabStatus) -> String {
        guard !status.apps.isEmpty else { return "No apps yet" }
        let counted = status.apps.filter { !$0.awaitingJobs }.count
        var parts = ["\(status.apps.filter(\.isRunning).count) of \(counted) running"]
        let attention = status.apps.filter(\.needsAttention).count
        if attention > 0 { parts.append("\(attention) need\(attention == 1 ? "s" : "") attention") }
        if status.missing > 0 {
            parts.append(status.missing == 1 ? "1 baseline app is down" : "\(status.missing) baseline apps are down")
        }
        if !status.batteryPaused.isEmpty { parts.append("\(status.batteryPaused.count) paused on battery") }
        if status.checking { parts.append("checking…") }
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

    /// What was seen last time, as keyed hashes (ChangeMemory), read once
    /// per unlock and again after Mark as Seen.
    private var seen = ChangeMemory.load()
    @ObservationIgnored private let seenKey = ChangeMemory.deviceKey()
    /// The apps as last shown, kept to be saved as seen when the dashboard goes.
    @ObservationIgnored var latestApps: [AppStatus] = []

    /// "Restarted since you looked", or nil.
    func changeNote(for app: AppStatus) -> String? {
        guard let seenKey else { return nil }
        return ChangeMemory.change(of: app, since: seen, key: seenKey)
    }

    /// Leaving the dashboard: what it showed is what was seen.
    func rememberSeen() {
        guard let seenKey else { return }
        ChangeMemory.save(latestApps, key: seenKey)
    }

    /// The apps that changed since you looked, in the list's order.
    var changedApps: [AppStatus] {
        apps(for: .all).filter { changeNote(for: $0) != nil }
    }

    /// Mark as Seen: what's shown now is what was seen, so the dots go.
    func markAllSeen() {
        guard let seenKey, let apps = liveEvents.status?.apps, !apps.isEmpty else { return }
        ChangeMemory.save(apps, key: seenKey)
        seen = ChangeMemory.memory(of: apps, key: seenKey)
    }

    /// Hidden until tomorrow on this device.
    private(set) var overnightHidden = Overnight.isHiddenToday()

    /// The morning's line about the night, or nil.
    var overnightLine: String? {
        guard !overnightHidden, let status = liveEvents.status else { return nil }
        var events: [AlertEvent] = []
        if case .alerts(let list)? = cards.cards["alerts"]?.data { events = list }
        return Overnight.words(.init(
            now: Date(),
            apps: status.apps,
            events: events,
            outages: cards.watchdog?.outages ?? [:],
            copies: backups.overview?.copies,
            watched: cards.watchdog != nil
        ))
    }

    func hideOvernight() {
        Overnight.hideToday()
        overnightHidden = true
    }

    /// In the morning, read Backups too, for the night's copies.
    func loadForMorning() async {
        guard Overnight.night(of: Date()) != nil, backups.overview == nil else { return }
        await backups.load()
    }

    /// For the sidebar badge and the phone's overview row: failing checks.
    var failingChecks: Int { cards.watchdog?.failing.count ?? 0 }
}
