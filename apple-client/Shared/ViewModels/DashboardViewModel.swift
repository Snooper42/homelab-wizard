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
            case .attention: "Needs a Look"
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

    /// The screens, as the computer's sidebar has them (web/dist/index.html),
    /// in its order: Status, Backups, Finances, Setup, Settings. Choose apps
    /// and Tidy Up are the computer's only; a phone can't reach them.
    enum SidebarItem: Hashable {
        /// Status, showing every app or one filter of them.
        case status(Filter)
        case backups
        case finances
        case setup
        case settings

        /// How the choice is kept between launches: a name, nothing more.
        var storageKey: String {
            switch self {
            case .status(let filter): "apps:" + filter.rawValue
            case .backups: "backups"
            case .finances: "finances"
            case .setup: "setup"
            case .settings: "settings"
            }
        }

        init?(storageKey: String) {
            switch storageKey {
            // Before the screens matched the computer's: the cards were on
            // Overview (now under Status), and Computer is Setup and Settings.
            case "overview": self = .status(.all)
            case "computer": self = .settings
            case "backups": self = .backups
            case "finances": self = .finances
            case "setup": self = .setup
            case "settings": self = .settings
            default:
                guard storageKey.hasPrefix("apps:"), let filter = Filter(rawValue: String(storageKey.dropFirst(5))) else { return nil }
                self = .status(filter)
            }
        }

        /// The sidebar row it highlights: any Status filter is the Status row.
        var row: SidebarItem {
            if case .status = self { return .status(.all) }
            return self
        }

        /// The computer's shortcut for it, ⌘ and this number (web/src/app.ts:
        /// Choose apps is 1 and Tidy Up 7, on the computer only).
        var shortcut: Character {
            switch self {
            case .status: "2"
            case .backups: "3"
            case .setup: "4"
            case .settings: "5"
            case .finances: "6"
            }
        }

        var title: String {
            switch self {
            case .status: "Status"
            case .backups: "Backups"
            case .finances: "Finances"
            case .setup: "Setup"
            case .settings: "Settings"
            }
        }

        /// The computer's icon for it, as near as SF Symbols has it.
        var systemImage: String {
            switch self {
            case .status: "waveform.path.ecg"
            case .backups: "archivebox"
            case .finances: "dollarsign"
            case .setup: "checkmark.circle"
            case .settings: "slider.horizontal.3"
            }
        }
    }

    /// The selection in the sidebar (Mac and iPad).
    var sidebar: SidebarItem? = .status(.all)
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

    /// What was done (the computer's record): one app's, or everything matching search.
    func history(appID: String = "", search: String = "") async throws -> [HistoryEntry] {
        try await api.history(appID: appID, search: search)
    }

    /// Every alert the computer kept, newest first.
    func alertLog() async throws -> [KeptAlert] {
        try await api.alertLog()
    }

    // MARK: Away mode (ADR-0023)

    /// The apps on the internet through the tunnel, as last kept, read
    /// when nothing answers. In memory only while the dashboard is up.
    private(set) var awayApps: [AwayApp] = []
    /// Whether each one's own address answered; missing until asked.
    private(set) var awayAnswers: [AwayApp.ID: Bool] = [:]
    /// What was last handed to be kept, so an unchanged list isn't kept again.
    @ObservationIgnored private var keptAwayApps: [AwayApp]?

    /// Nothing read, and neither home nor the tunnel answers: only the apps
    /// on the internet are shown, with a line saying so.
    var inAwayMode: Bool { !hasLoaded && liveEvents.cannotReach && !awayApps.isEmpty }

    /// Reads the kept apps and asks each whether it answers.
    func loadAwayMode() async {
        awayApps = await api.awayApps()
        awayAnswers = [:]
        guard !awayApps.isEmpty else { return }
        awayAnswers = await api.awayAnswers(awayApps)
    }

    /// Away mode's apps, read only when nothing answers.
    func loadAwayModeIfNothingAnswers() async {
        guard liveEvents.cannotReach else { return }
        await loadAwayMode()
    }

    /// Keeps the apps Away mode would show, from what was just read.
    func rememberAwayApps() {
        guard let status = liveEvents.status, let catalog else { return }
        let apps = AwayApp.list(from: status, catalog: catalog)
        // Status changes often; the list seldom.
        guard apps != keptAwayApps else { return }
        keptAwayApps = apps
        let api = self.api
        Task { await api.rememberAwayApps(apps) }
    }

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

    // MARK: Status by category, as the computer's Status

    /// Every app grouped as the computer's Status groups them: what needs a
    /// look first, then the pinned ones, then each catalog category, then
    /// Other (`renderAppList` in web/src/screens/status.ts).
    var groups: [AppGroup] { Self.groups(apps: allApps, pinned: pinnedApps, catalog: catalog) }

    /// The groups with only the apps the search matches; empty groups go.
    func groups(matching query: String) -> [AppGroup] {
        groups.compactMap { group in
            let apps = group.apps.filter { Self.matches($0, query) }
            return apps.isEmpty ? nil : AppGroup(label: group.label, apps: apps, alert: group.alert, pinned: group.pinned)
        }
    }

    nonisolated static func groups(apps: [AppStatus], pinned: [AppStatus], catalog: AppCatalog?) -> [AppGroup] {
        // The computer's Needs a look group: unwell, crash-looping, or missing.
        // A stopped app stays in its category, its row saying why.
        func trouble(_ app: AppStatus) -> Bool {
            app.health == "unhealthy" || app.health == "restarting" || app.state == "missing"
        }
        let pinnedShown = pinned.filter { !trouble($0) }
        let pinnedIDs = Set(pinnedShown.map(\.id))
        let rest = apps.filter { !trouble($0) && !pinnedIDs.contains($0.id) }
        let categoryOf = Dictionary((catalog?.apps ?? []).map { ($0.id, $0.category) }, uniquingKeysWith: { first, _ in first })
        let categories = catalog?.categories ?? []
        let known = Set(categories.map(\.id))
        var out = [AppGroup(label: "Needs a look", apps: apps.filter(trouble), alert: true),
                   AppGroup(label: "Pinned", apps: pinnedShown, pinned: true)]
        out += categories.map { category in AppGroup(label: category.label, apps: rest.filter { categoryOf[$0.id] == category.id }) }
        out.append(AppGroup(label: "Other", apps: rest.filter { !known.contains(categoryOf[$0.id] ?? "") }))
        return out.filter { !$0.apps.isEmpty }
    }

    func count(for filter: Filter) -> Int {
        apps(for: filter).count
    }

    var attentionCount: Int { count(for: .attention) }

    func app(id: AppStatus.ID?) -> AppStatus? {
        guard let id else { return nil }
        return liveEvents.status?.apps.first { $0.id == id }
    }

    /// For example, "12 of 14 running · 1 needs a look", as the computer says it.
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
        if attention > 0 { parts.append("\(attention) need\(attention == 1 ? "s" : "") a look") }
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

    /// The groups opened or folded on Status as the computer keeps them for
    /// every device (StatusFolds); nil where it can't say (an older computer,
    /// or no answer), and this device keeps its own.
    func computerFolds() async -> String? {
        guard let open = try? await api.call("StatusFolds", as: [String: Bool].self) else { return nil }
        return StatusFolds.fromComputer(open)
    }

    /// Keeps `raw` as every device's folds (SetStatusFolds, a change).
    func saveFolds(_ raw: String) async {
        do {
            try await api.setStatusFolds(StatusFolds.choices(raw))
        } catch {
            Log.network.error("SetStatusFolds failed: \(APIError.from(error).logName, privacy: .public)")
        }
    }

    func loadCatalog() async {
        guard catalog == nil, !catalogLoading else { return }
        catalogLoading = true
        defer { catalogLoading = false }
        do {
            catalog = try await api.call("Catalog", as: AppCatalog.self)
            rememberAwayApps()
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

/// A group of Status: a category, or what needs a look, or the pinned apps.
struct AppGroup: Identifiable, Equatable, Sendable {
    let label: String
    let apps: [AppStatus]
    /// What needs a look: its count in red, never folded at first.
    var alert = false
    /// The pinned apps: open at first, since the point of them is a glance.
    var pinned = false

    var id: String { label }

    /// Folded until opened, as on the computer: everything in it runs,
    /// waits for the scheduled jobs, or was stopped on purpose.
    var isFine: Bool {
        !alert && !pinned && apps.allSatisfy { app in
            app.isRunning || app.awaitingJobs
                || (app.state == "stopped" && app.stoppedOnPurpose != nil && app.stoppedOnPurpose?.keptRestarting != true)
        }
    }
}

/// Which Status groups are open: the person's own choices, by group name,
/// kept as the sidebar's place is (scene storage). Until they choose, a
/// group is open unless everything in it is fine. Only names are kept,
/// never what the groups hold.
enum StatusFolds {
    static func choices(_ raw: String) -> [String: Bool] {
        (try? JSONDecoder().decode([String: Bool].self, from: Data(raw.utf8))) ?? [:]
    }

    static func isOpen(_ group: AppGroup, in raw: String) -> Bool {
        choices(raw)[group.label] ?? !group.isFine
    }

    /// `raw` with `group` opened or folded.
    static func setting(_ group: AppGroup, open: Bool, in raw: String) -> String {
        var picked = choices(raw)
        picked[group.label] = open
        guard let data = try? JSONEncoder().encode(picked) else { return raw }
        return String(decoding: data, as: UTF8.self)
    }

    /// The folds the computer keeps for every device (its `StatusFolds`,
    /// internal/statusfolds), as this device keeps them.
    static func fromComputer(_ open: [String: Bool]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        guard let data = try? encoder.encode(open) else { return "" }
        return String(decoding: data, as: UTF8.self)
    }

    /// Whether `raw` is the person's own change, to keep for every device:
    /// not what the computer last said (in whatever order), on a device
    /// allowed changes, with a computer that keeps them. A device that only
    /// looks keeps its own.
    static func shouldSave(_ raw: String, computers: String?, canChange: Bool, keeps: Bool) -> Bool {
        canChange && keeps && choices(raw) != choices(computers ?? "")
    }
}
