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
            parts.append(status.missing == 1 ? "1 of the homelab's own apps is down" : "\(status.missing) of the homelab's own apps are down")
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

    // MARK: Status read aloud (main #451)

    /// Each app's words at the last reading, for what to say when they change.
    /// In memory only, and gone with the dashboard on lock.
    @ObservationIgnored private var heard: [AppStatus.ID: String]?

    /// What changed since the last reading, for VoiceOver to say: "Vikunja:
    /// Restarting", apps that change to the same words together. Nil the
    /// first time and when nothing changed.
    func changesToSay(_ apps: [AppStatus]) -> String? {
        let before = heard
        heard = Dictionary(apps.map { ($0.id, $0.detailLine) }, uniquingKeysWith: { first, _ in first })
        guard let before else { return nil }
        return Self.changes(from: before, to: apps)
    }

    /// The row's own words, as the computer reads them out: apps listed in
    /// Status's order, five at most by name.
    nonisolated static func changes(from before: [AppStatus.ID: String], to apps: [AppStatus]) -> String? {
        var order: [String] = []
        var names: [String: [String]] = [:]
        for app in apps {
            let words = app.detailLine
            guard let was = before[app.id], was != words else { continue }
            if names[words] == nil { order.append(words) }
            names[words, default: []].append(app.name)
        }
        guard !order.isEmpty else { return nil }
        return order.map { "\(listed(names[$0] ?? [])): \($0)" }.joined(separator: ". ")
    }

    /// "A", "A and B", "A, B and C", or "A, B, C, D and 3 more".
    nonisolated static func listed(_ names: [String]) -> String {
        guard let last = names.last else { return "" }
        if names.count > 5 { return names.prefix(4).joined(separator: ", ") + " and \(names.count - 4) more" }
        if names.count == 1 { return last }
        return names.dropLast().joined(separator: ", ") + " and " + last
    }

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
    // MARK: Health in one line (main #470)

    /// The line atop every screen but Status and an app's page: nil until
    /// Status has been read, "" when all is well, else the one thing that
    /// needs you, in the rows' own words.
    var healthLine: String? {
        guard let status = liveEvents.status else { return nil }
        // A failing check that is an app's own is already in its row.
        let appIDs = Set(status.apps.map(\.id))
        let apps = status.apps.filter(\.needsAttention).map { (name: $0.name, words: $0.detailLine) }
        let checks = (cards.watchdog?.failing ?? []).map(\.name).filter { !appIDs.contains($0) }
        return Self.healthWords(apps: apps, checks: checks) ?? ""
    }

    /// As the computer says it (`trouble` in web/src/status/healthLine.ts);
    /// nil when there's nothing to say.
    nonisolated static func healthWords(apps: [(name: String, words: String)], checks: [String]) -> String? {
        if apps.count == 1, let app = apps.first { return "\(app.name): \(app.words)" }
        if !apps.isEmpty { return "\(apps.count) apps need a look: \(shortList(apps.map(\.name)))" }
        if checks.count == 1, let check = checks.first { return "The watchdog's check of \(check) is failing" }
        if !checks.isEmpty { return "\(checks.count) of the watchdog's checks are failing: \(shortList(checks))" }
        return nil
    }

    /// "A", "A and B", "A, B and C", or "A, B and 3 more".
    nonisolated static func shortList(_ names: [String]) -> String {
        guard let last = names.last else { return "" }
        if names.count > 3 { return names.prefix(2).joined(separator: ", ") + " and \(names.count - 2) more" }
        if names.count == 1 { return last }
        return names.dropLast().joined(separator: ", ") + " and " + last
    }

    /// What the Overview's watchdog card has to show: failing checks, and
    /// memory nearly full (main #458).
    var failingChecks: Int {
        (cards.watchdog?.failing.count ?? 0) + (cards.watchdog?.memory == nil ? 0 : 1)
    }
}
