import SwiftUI

// Status' Overview as the computer's (the owner's pictures, Nov 25: docs/images/app-status.png, app-phone.png;
// web/src/status/Tiles.tsx and CategoryPanel.tsx): three cards of one anatomy (a title row, one figure, one line, a
// footer), Apps, Backups and the machine; then the categories as a list, each opening its page. Nothing below them.
// Never "needs you": each card says what happened ("Mealie stopped", "Mealie skipped").

/// One square of the Apps card's days or the Backups card's nights.
struct DaySquare: Equatable, Sendable, Identifiable {
    let id: String
    let tone: BackupNight.Tone
    /// What VoiceOver says for it: "Mon, Nov 24: every app answered".
    let words: String
}

/// The Apps card's words, from the status and the watchdog alone, so they can be tested without a screen
/// (`Tiles` in web/src/status/Tiles.tsx).
struct OverviewApps: Equatable {
    let running: Int
    /// The apps counted: the companion waiting for its scheduled jobs isn't, as on the computer.
    let counted: Int
    /// Unwell, not answering, missing, or stopped when nobody stopped it on purpose (`troubled`).
    let trouble: [AppStatus]
    /// The homelab's own apps that are down.
    let missing: Int
    /// The watchdog's days, oldest first: fourteen from a computer that keeps them, else the week from its outages.
    let days: [DaySquare]
    /// When the watchdog last checked.
    let checked: Date?

    init(status: HomelabStatus?, watchdog: WatchdogSummary?, now: Date = .now, calendar: Calendar = .current) {
        let apps = status?.apps ?? []
        running = apps.filter(\.isRunning).count
        counted = apps.filter { !$0.awaitingJobs }.count
        trouble = apps.filter(\.needsAttention)
        missing = status?.missing ?? 0
        days = Self.days(watchdog, now: now, calendar: calendar)
        checked = watchdog?.lastRun
    }

    /// "22" over "running", or "21" over "of 22 running" when one isn't.
    var figure: String { "\(running)" }
    var unit: String { trouble.isEmpty ? "running" : "of \(counted) running" }
    var alert: Bool { !trouble.isEmpty }

    /// The one app that stopped or isn't well: named with its logo, and its buttons.
    var one: AppStatus? { trouble.count == 1 ? trouble[0] : nil }

    /// The line under the figure: what's down, the one app and what happened to it, the several grouped, or the
    /// days: "All answering · no outage this week".
    var line: String {
        if missing > 0 { return missing == 1 ? "1 of the homelab's own apps is down" : "\(missing) of the homelab's own apps are down" }
        if let one { return "\(one.name) \(Self.lowered(one.detailLine))" }
        if !trouble.isEmpty { return Self.troubleLine(trouble) }
        guard !days.isEmpty else { return "All answering" }
        let outages = days.filter { $0.tone == .warn || $0.tone == .bad }.count
        return "All answering · " + (outages == 0 ? "no outage \(span)" : "\(outages == 1 ? "1 day" : "\(outages) days") with an outage \(span)")
    }

    private var span: String { days.count > 7 ? "in two weeks" : "this week" }

    /// What VoiceOver says for the squares.
    var daysLabel: String {
        let outages = days.filter { $0.tone == .warn || $0.tone == .bad }.count
        return (days.count > 7 ? "The last two weeks: " : "This week: ") + (outages == 0 ? "no outage" : "\(outages) days with an outage")
    }

    /// What's wrong with each, grouped: "Mealie, Vikunja stopped · Immich not answering" (`troubleLine`).
    static func troubleLine(_ apps: [AppStatus]) -> String {
        func kind(_ app: AppStatus) -> String {
            if app.state == "missing" { return "missing" }
            if app.isRunning { return (app.notAnswering ?? "").isEmpty ? "unwell" : "not answering" }
            return "stopped"
        }
        var order: [String] = []
        var names: [String: [String]] = [:]
        for app in apps {
            let k = kind(app)
            if names[k] == nil { order.append(k) }
            names[k, default: []].append(app.name)
        }
        return order.map { k in
            let n = names[k] ?? []
            return (n.count > 3 ? n.prefix(2).joined(separator: ", ") + " +\(n.count - 2)" : n.joined(separator: ", ")) + " " + k
        }.joined(separator: " · ")
    }

    /// The watchdog's days as squares (`weekSquares` in web/src/screens/status.ts): ok, none (it didn't run), warn
    /// (an app was down a while that day), bad (one is still down today). None before it has run.
    static func days(_ w: WatchdogSummary?, now: Date = .now, calendar: Calendar = .current) -> [DaySquare] {
        guard let w, w.lastRun != nil else { return [] }
        let style = Date.FormatStyle.dateTime.weekday(.abbreviated).month(.abbreviated).day()
        if !w.daily.isEmpty {
            let downNow = !w.failing.isEmpty
            return w.daily.indices.map { i in
                let d = w.daily[i]
                let tone: BackupNight.Tone = d.failed == 0 ? (d.runs > 0 ? .ok : .none) : (i == w.daily.count - 1 && downNow ? .bad : .warn)
                let words = d.failed > 0 ? (d.failed == 1 ? "1 app down for a while" : "\(d.failed) apps down for a while")
                    : d.runs > 0 ? "every app answered" : "not checked"
                return DaySquare(id: d.date, tone: tone, words: "\(LocalDay.parse(d.date)?.formatted(style) ?? d.date): \(words)")
            }
        }
        let all = w.outages.values.flatMap { $0 }
        let today = calendar.startOfDay(for: now)
        return (0..<7).map { i in
            let start = calendar.date(byAdding: .day, value: i - 6, to: today) ?? today
            let end = calendar.date(byAdding: .day, value: 1, to: start) ?? now
            let hit = all.filter { o in o.from < end && (o.to.map { $0 >= start } ?? true) }
            let tone: BackupNight.Tone = hit.isEmpty ? .ok : (i == 6 && hit.contains { $0.to == nil } ? .bad : .warn)
            return DaySquare(id: "\(i)", tone: tone, words: "\(start.formatted(style)): " + (hit.isEmpty ? "every app answered" : "an app down for a while"))
        }
    }

    /// "Stopped at 3:12 AM" as it reads after a name: "stopped at 3:12 AM".
    static func lowered(_ words: String) -> String { words.prefix(1).lowercased() + words.dropFirst() }
}

/// The Backups card's words: how many of last night's copies were made, when, what was skipped, and the last
/// fourteen nights (`lastNight` in web/src/screens/status.ts).
struct OverviewBackups: Equatable {
    let figure: String
    let unit: String
    /// "Last run Thu 7:48 AM", "Not run yet", or "Reading last night…" before Backups is read.
    let line: String
    /// "Mealie, Vikunja skipped"; nil when nothing was.
    let skipped: String?
    let nights: [DaySquare]

    init(_ o: BackupOverview?) {
        guard let o else {
            figure = "—"; unit = ""; line = "Reading last night…"; skipped = nil; nights = []
            return
        }
        let count = o.upToDate
        figure = "\(count.fresh)"
        unit = "of \(count.of) copied"
        line = o.lastRun.map { "Last run " + $0.formatted(.dateTime.weekday(.abbreviated)) + " " + $0.formatted(date: .omitted, time: .shortened) } ?? "Not run yet"
        let names = o.copies.filter { $0.state == "stale" }.map(\.name)
        skipped = names.isEmpty ? nil : names.joined(separator: ", ") + " skipped"
        nights = o.lastNights().map { DaySquare(id: $0.id, tone: $0.tone, words: $0.words(name: o.nightName)) }
    }
}

/// The machine card's words (`MachineCard` in web/src/status/Tiles.tsx): its free space as the figure, its power
/// on the line, how long it has been up (or the nightly updates) in the title row, and the drive's room as a bar.
/// From a computer that sends no facts, the nightly updates alone.
struct OverviewMachine: Equatable {
    let title: String
    let trailing: String
    let figure: String
    let unit: String
    let line: String
    /// Little room left: the figure in red.
    let low: Bool
    /// On battery, or plugged in but free to sleep: the line in amber.
    let lineAlert: Bool
    /// The drive's share used and its words ("582 GB of 994 GB used"); nil without facts.
    let bar: Double?
    let barWords: String

    init(_ m: MachineFacts?, updates: UpdatesState?, now: Date = .now) {
        let paused = updates?.paused == true
        let schedule = updates?.schedule ?? ""
        let updatesWords = paused ? "Updates paused" : "Updates " + (schedule.isEmpty ? "nightly" : schedule)
        guard let m else {
            title = "Updates"; trailing = ""
            figure = paused ? "Paused" : "On"; unit = ""
            line = paused ? "Until you resume them" : "Run " + (schedule.isEmpty ? "nightly" : schedule)
            low = false; lineAlert = false; bar = nil; barWords = ""
            return
        }
        let up = MachineFacts.upFor(m.booted, now: now)
        title = "This machine"
        trailing = up ?? updatesWords
        let free = m.freeParts
        figure = free.figure
        unit = free.unit
        line = [m.powerWords, up == nil ? nil : OverviewApps.lowered(updatesWords)].compactMap { $0 }.joined(separator: " · ")
        low = m.low
        lineAlert = m.power == "battery" || (m.power == "plugged" && !m.keptAwake)
        bar = m.usedShare
        barWords = m.usedWords
    }
}

/// A category on the Overview and its page: each of the catalog's categories with its apps on this machine,
/// whatever their state, Media automation last and your own apps after it (`statusParts` in
/// web/src/screens/status.ts).
struct StatusCategory: Identifiable, Equatable {
    let id: String
    let label: String
    let apps: [AppStatus]
    /// What its line says in place of its apps' names while none stopped (Media automation's).
    var summary: String? = nil

    static let automation = "media-automation"

    /// The apps that stopped or aren't well, by name.
    var stopped: [String] { apps.filter(\.needsAttention).map(\.name) }
    var running: Int { apps.filter(\.isRunning).count }

    /// "Nginx Proxy Manager, AdGuard Home +2"; "Mealie stopped · Vikunja" when one stopped.
    var line: String {
        let stopped = self.stopped
        if stopped.isEmpty, let summary { return summary }
        let names = apps.map(\.name)
        let lead = stopped.isEmpty ? names : ["\(stopped.joined(separator: ", ")) stopped"] + names.filter { !stopped.contains($0) }
        return lead.prefix(2).joined(separator: stopped.isEmpty ? ", " : " · ") + (lead.count > 2 ? " +\(lead.count - 2)" : "")
    }

    /// "4 running" when all of them run, "1 of 2 running" in amber when one doesn't.
    var pill: (words: String, fine: Bool) {
        stopped.isEmpty ? ("\(running) running", true) : ("\(running) of \(apps.count) running", false)
    }

    /// What VoiceOver says for its row: "Network, 4 running: Nginx Proxy Manager, AdGuard Home, …".
    var spoken: String { "\(label), \(pill.words): \(apps.map(\.name).joined(separator: ", "))" }

    static func list(apps: [AppStatus], catalog: AppCatalog?) -> [StatusCategory] {
        let sorted = apps.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        var categoryOf = Dictionary((catalog?.apps ?? []).map { ($0.id, $0.category) }, uniquingKeysWith: { first, _ in first })
        // Seerr sits in Media, beside Jellyfin: a household asks there and watches there (arr item 8).
        if categoryOf["seerr"] == automation { categoryOf["seerr"] = "media" }
        let all = catalog?.categories ?? []
        let categories = all.filter { $0.id != automation } + all.filter { $0.id == automation }
        let known = Set(categories.map(\.id))
        var out = categories.map { c in
            StatusCategory(id: c.id, label: c.id == automation ? "Media automation" : c.label,
                           apps: sorted.filter { categoryOf[$0.id] == c.id },
                           summary: c.id == automation ? "Finds and downloads what you ask for in Seerr" : nil)
        }
        out.append(StatusCategory(id: "own", label: "Your own apps", apps: sorted.filter { !known.contains(categoryOf[$0.id] ?? "") }))
        return out.filter { !$0.apps.isEmpty }
    }
}

/// Where Status' stack goes: an app's page, a category's page, or every app.
enum StatusPlace: Hashable {
    case app(AppStatus.ID)
    case category(String)
    case every
    case analytics

    var appID: AppStatus.ID? {
        if case .app(let id) = self { return id }
        return nil
    }
}

// MARK: - The cards

/// The three cards' anatomy: a title row (its name, and a few words at its end), one figure with a smaller word
/// beside it, one line, and a footer.
struct OverviewCard<Line: View, Footer: View>: View {
    let title: String
    var trailing: String = ""
    let figure: String
    var unit: String = ""
    var tone: Color? = nil
    @ViewBuilder let line: Line
    @ViewBuilder let footer: Footer

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(verbatim: title)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Spacer(minLength: 8)
                if !trailing.isEmpty {
                    Text(verbatim: trailing)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(verbatim: figure)
                    .font(.largeTitle.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(tone ?? Theme.ink)
                if !unit.isEmpty {
                    Text(verbatim: unit)
                        .font(.title3)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.top, 2)
            line
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
                .fixedSize(horizontal: false, vertical: true)
            footer
                .padding(.top, 10)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .card()
    }
}

/// A row of squares, a day or a night each, as the computer's cards draw them.
struct DaySquaresView: View {
    let squares: [DaySquare]
    let label: String

    var body: some View {
        let many = squares.count > 7
        HStack(spacing: many ? 4 : 6) {
            ForEach(squares) { square in
                RoundedRectangle(cornerRadius: many ? 6 : 8, style: .continuous)
                    .fill(BackupTone.color(square.tone))
                    .frame(maxWidth: .infinity)
                    .frame(height: 32)
                    .accessibilityElement()
                    .accessibilityLabel(Text(verbatim: square.words))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text(verbatim: label))
    }
}

/// Apps: how many run, then all answering and the watchdog's days; one app that stopped named with its logo,
/// Start · Logs and its page; two or more, Start All and See Them.
struct OverviewAppsCard: View {
    let words: OverviewApps
    /// Opens an app's page.
    let open: @MainActor (AppStatus.ID) -> Void
    /// Shows every app.
    let seeAll: @MainActor () -> Void
    @Environment(AppActionsViewModel.self) private var actions

    var body: some View {
        OverviewCard(title: "Apps", trailing: words.checked.map { "Checked " + $0.formatted(.relative(presentation: .named)) } ?? "",
                     figure: words.figure, unit: words.unit, tone: words.alert ? Theme.warning : nil) {
            if let one = words.one, words.missing == 0 {
                HStack(spacing: 8) {
                    AppIconView(app: one, size: 22, stateBadge: false)
                    Text(verbatim: words.line)
                        .lineLimit(2)
                }
            } else {
                Text(verbatim: words.line)
                    .foregroundStyle(words.missing > 0 ? Theme.danger : Theme.secondaryInk)
            }
        } footer: {
            footer
        }
    }

    @ViewBuilder
    private var footer: some View {
        if let one = words.one {
            HStack(spacing: 8) {
                HeroButtons(app: one)
                Spacer(minLength: 0)
                Button { open(one.id) } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 20, height: 20)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.circle)
                .controlSize(.small)
                .accessibilityLabel(Text(verbatim: "\(one.name): its page"))
            }
        } else if !words.trouble.isEmpty {
            let stopped = AppAction.groupTargets(.start, in: words.trouble)
            HStack(spacing: 8) {
                if actions.canChangeApps, !stopped.isEmpty {
                    Button { actions.requestGroup(.start, on: stopped) } label: {
                        Label("Start All", systemImage: AppAction.start.systemImage)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accentFill)
                    .disabled(actions.isBusy)
                }
                Button("See Them") { seeAll() }
                    .buttonStyle(.bordered)
            }
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .font(.subheadline.weight(.semibold))
        } else if !words.days.isEmpty {
            DaySquaresView(squares: words.days, label: words.daysLabel)
        }
    }
}

/// Backups: last night's copies, what was skipped, and the last fourteen nights; a tap opens Backups.
struct OverviewBackupsCard: View {
    let words: OverviewBackups

    var body: some View {
        Button { IntentInbox.shared.screen = .backups } label: {
            OverviewCard(title: "Backups", trailing: "Every night at 03:30", figure: words.figure, unit: words.unit,
                         tone: words.skipped == nil ? nil : Theme.warning) {
                if let skipped = words.skipped {
                    Text("\(Text(verbatim: words.line)) · \(Text(verbatim: skipped).foregroundStyle(Theme.warning))")
                } else {
                    Text(verbatim: words.line)
                }
            } footer: {
                if !words.nights.isEmpty {
                    DaySquaresView(squares: words.nights, label: "The last \(words.nights.count) nights")
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityHint("Opens Backups")
    }
}

/// The machine: its free space, its power, the drive's bar, and Pause or Resume for the nightly updates.
struct OverviewMachineCard: View {
    let words: OverviewMachine
    let computer: ComputerViewModel

    var body: some View {
        OverviewCard(title: words.title, trailing: words.trailing, figure: words.figure, unit: words.unit,
                     tone: words.low ? Theme.danger : nil) {
            if !words.line.isEmpty {
                Text(verbatim: words.line)
                    .foregroundStyle(words.lineAlert ? Theme.warning : Theme.secondaryInk)
            }
        } footer: {
            HStack(alignment: .bottom, spacing: 12) {
                if let share = words.bar {
                    VStack(alignment: .leading, spacing: 6) {
                        ProgressView(value: share)
                            .tint(Theme.accent)
                            .accessibilityLabel("Drive used")
                        Text(verbatim: words.barWords)
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryInk)
                    }
                } else {
                    Spacer(minLength: 0)
                }
                if computer.canChange, let updates = computer.updates {
                    Button(updates.paused ? "Resume" : "Pause") {
                        Task { await computer.setNightlyUpdates(on: updates.paused) }
                    }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .font(.subheadline.weight(.semibold))
                    .disabled(computer.isSavingUpdates)
                    .accessibilityLabel(updates.paused ? "Resume nightly app updates" : "Pause nightly app updates")
                }
            }
            if let error = computer.updatesError {
                Text(verbatim: error)
                    .font(.footnote)
                    .foregroundStyle(Theme.danger)
            }
        }
    }
}

/// The three cards, one above the other on a phone and side by side where there's room. A household member's
/// phone has Apps alone: the homelab's backups and machine aren't theirs to look after.
struct OverviewCards: View {
    let model: DashboardViewModel
    let computer: ComputerViewModel
    var isMember = false
    let open: @MainActor (AppStatus.ID) -> Void
    let seeAll: @MainActor () -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12, alignment: .top)], spacing: 12) {
            OverviewAppsCard(words: OverviewApps(status: model.liveEvents.status, watchdog: model.cards.watchdog), open: open, seeAll: seeAll)
            if !isMember {
                OverviewBackupsCard(words: OverviewBackups(model.backups.overview))
                OverviewMachineCard(words: OverviewMachine(model.cards.machine, updates: computer.updates), computer: computer)
            }
        }
    }
}

/// A category's row: its first three logos, its name over its apps' names, how many run (amber when one stopped).
struct CategoryRow: View {
    let category: StatusCategory
    @ScaledMetric(relativeTo: .body) private var logo: CGFloat = 30
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let size = min(logo, 42)
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
            : AnyLayout(HStackLayout(spacing: 12))
        layout {
            HStack(spacing: -size * 0.3) {
                ForEach(category.apps.prefix(3)) { app in
                    AppIconView(app: app, size: size, stateBadge: false)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: category.label)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(verbatim: category.line)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            let pill = category.pill
            HStack(spacing: 3) {
                if pill.fine {
                    Image(systemName: "checkmark")
                        .font(.caption.weight(.bold))
                }
                Text(verbatim: pill.words)
                    .lineLimit(1)
            }
            .pill(pill.fine ? Theme.success : Theme.warning)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: category.spoken))
    }
}

/// A tile's dot and its one live line (`tileLine` and `stateOf` in web/src/status): how long it has been up when
/// it's well, else what happened to it.
struct TileLine: Equatable {
    enum Tone: Equatable { case ok, warn, bad, plain }
    let tone: Tone
    let words: String

    static func of(_ a: AppStatus, now: Date = .now) -> TileLine {
        // Stopped on purpose is no trouble: a plain dot. Stopped by the watchdog for restarting over and over is.
        if a.state == "stopped", let stop = a.stoppedOnPurpose {
            return TileLine(tone: stop.keptRestarting ? .bad : .plain, words: stop.words(now: now))
        }
        if a.state != "running", a.pausedOnBattery { return TileLine(tone: .warn, words: "Paused on battery") }
        if a.state == "stopped", let drive = a.waitingFor, !drive.isEmpty {
            return TileLine(tone: .warn, words: "Waiting for the \(AppStatus.driveName(drive)) drive")
        }
        if a.state == "stopped" {
            return TileLine(tone: (a.stoppedWhy ?? "").isEmpty ? .warn : .bad,
                            words: AppStatus.stoppedByItself(at: a.stoppedAt.flatMap(GoTime.parse), why: a.stoppedWhy, now: now))
        }
        if a.isRunning {
            switch a.health {
            case "unhealthy": return TileLine(tone: .bad, words: "Unhealthy")
            case "restarting": return TileLine(tone: .bad, words: "Restarting")
            case "starting": return TileLine(tone: .warn, words: "Starting")
            default: break
            }
            if let problem = a.notAnswering, !problem.isEmpty { return TileLine(tone: .bad, words: "Not answering: \(problem)") }
            if a.health == "native" { return TileLine(tone: .ok, words: "Running") }
            return TileLine(tone: .ok, words: a.startedAt.map { upFor($0, now: now) } ?? "Running")
        }
        if a.awaitingJobs { return TileLine(tone: .plain, words: "Starts with the scheduled jobs (Setup)") }
        switch a.state {
        case "missing": return TileLine(tone: .bad, words: "Not running")
        case "elsewhere": return TileLine(tone: .warn, words: "Runs elsewhere")
        default: return TileLine(tone: .warn, words: "Not running")
        }
    }

    /// "Up a minute", "Up 12 min", "Up 5 hours", "Up 4 days", as a tile says it (`upFor` in CategoryPage.tsx).
    static func upFor(_ since: Date, now: Date = .now) -> String {
        let minutes = max(0, Int((now.timeIntervalSince(since) / 60).rounded()))
        let hours = Int((Double(minutes) / 60).rounded())
        if minutes < 2 { return "Up a minute" }
        if minutes < 60 { return "Up \(minutes) min" }
        if hours < 48 { return "Up \(hours) \(hours == 1 ? "hour" : "hours")" }
        return "Up \(Int((Double(hours) / 24).rounded())) days"
    }

    var color: Color {
        switch tone {
        case .ok: Design.running
        case .warn: Theme.warning
        case .bad: Theme.danger
        case .plain: Theme.secondaryInk.opacity(0.5)
        }
    }
}

extension StatusCategory {
    /// The catalog's apps of a category not on this machine yet, to add (helpers aside; Seerr in Media); none for
    /// your own apps, which come from no catalog.
    static func toAdd(_ id: String, installed: Set<String>, catalog: AppCatalog?) -> [CatalogEntry] {
        guard id != "own" else { return [] }
        return (catalog?.apps ?? []).filter { entry in
            let category = entry.id == "seerr" && entry.category == automation ? "media" : entry.category
            return category == id && entry.kind != "helper" && !installed.contains(entry.id)
        }
    }

    /// The line under the page's title: "6 on the server · 6 running · 5 to add".
    static func facts(apps: [AppStatus], toAdd: Int) -> String {
        [apps.isEmpty ? nil : "\(apps.count) on the server",
         apps.isEmpty ? nil : "\(apps.filter(\.isRunning).count) running",
         toAdd > 0 ? "\(toAdd) to add" : nil].compactMap { $0 }.joined(separator: " · ")
    }

    /// Whether Find an App matches it: its name, or what it does, regardless of case and accents.
    static func matches(_ words: [String], _ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return true }
        return words.contains { $0.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
    }
}

/// A category's page (the computer's, two across on a phone: app-status-category-phone.png): its apps as tiles,
/// each with its dot, its logo, one live line, Open or Start, and ⋯; then the catalog's others, faded, under
/// *Add to <category>* (no Install on a phone yet: they're added on the computer).
struct CategoryPage: View {
    let model: DashboardViewModel
    let id: String
    var zoom: Namespace.ID
    @State private var find = ""

    var body: some View {
        let apps = model.liveEvents.status?.apps ?? []
        let category = StatusCategory.list(apps: apps, catalog: model.catalog).first { $0.id == id }
        let label = category?.label ?? model.catalog?.categories.first(where: { $0.id == id })?.label ?? ""
        let installed = category?.apps ?? []
        let add = StatusCategory.toAdd(id, installed: Set(apps.map(\.id)), catalog: model.catalog)
        let shown = installed.filter { StatusCategory.matches([$0.name, model.catalog?.entry($0.id)?.description ?? ""], find) }
        let addShown = add.filter { StatusCategory.matches([$0.name, $0.description], find) }
        let columns = [GridItem(.adaptive(minimum: 150), spacing: 12, alignment: .top)]
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                let facts = StatusCategory.facts(apps: installed, toAdd: add.count)
                if !facts.isEmpty, find.isEmpty {
                    Text(verbatim: facts)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
                if !shown.isEmpty {
                    TileHeading(title: "On the server", count: installed.count)
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(shown) { app in
                            AppTile(app: app)
                                .zoomSource(id: app.id, in: zoom)
                        }
                    }
                }
                if !addShown.isEmpty {
                    TileHeading(title: "Add to \(label)", count: add.count)
                        .padding(.top, 8)
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(addShown) { entry in
                            ShelfTile(entry: entry)
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .overlay {
            if !find.isEmpty, shown.isEmpty, addShown.isEmpty {
                ContentUnavailableView.search(text: find)
            } else if installed.isEmpty, add.isEmpty {
                ContentUnavailableView("No Apps Here", systemImage: "square.grid.2x2")
            }
        }
        .themedCanvas()
        .navigationTitle(label)
        .searchable(text: $find, prompt: "Find an app")
    }
}

/// "On the server  6": a shelf's heading and how many it has.
private struct TileHeading: View {
    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: 8) {
            Text(verbatim: title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
            Text(verbatim: "\(count)")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(Theme.secondaryInk)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

/// An app's tile: its dot and ⋯ (the row's menu) at the top, its logo and name, one live line, and Open while it
/// runs or Start when it stopped by itself. A tap opens its page.
struct AppTile: View {
    let app: AppStatus
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(\.openURL) private var openURL

    var body: some View {
        let line = TileLine.of(app)
        VStack(spacing: 8) {
            HStack {
                Circle()
                    .fill(line.color)
                    .frame(width: 9, height: 9)
                    .accessibilityHidden(true)
                Spacer()
                Menu {
                    AppMenuItems(app: app)
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.secondaryInk)
                        .frame(width: 36, height: 28)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text(verbatim: "\(app.name): more"))
            }
            NavigationLink(value: StatusPlace.app(app.id)) {
                VStack(spacing: 6) {
                    AppIconView(app: app, size: 58, stateBadge: false)
                    Text(verbatim: app.name)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if let pending = actions.pending[app.id] {
                        PendingActionLine(app: app, pending: pending)
                            .font(.subheadline)
                            .lineLimit(1)
                    } else {
                        Text(verbatim: line.words)
                            .font(.subheadline)
                            .foregroundStyle(line.tone == .bad ? Theme.danger : Theme.secondaryInk)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens its page")
            button
                .frame(minHeight: 34)
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .card()
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var button: some View {
        if actions.stoppedOffer(for: app) == .start, actions.pending[app.id] == nil {
            Button { actions.request(.start, on: app) } label: {
                Label(AppAction.start.title, systemImage: AppAction.start.systemImage)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accentFill)
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .font(.subheadline.weight(.semibold))
            .disabled(actions.isBusy)
        } else if app.isRunning, let address = app.address, let url = AppDetailView.httpsURL(address) {
            Button { openURL(url) } label: {
                Label("Open", systemImage: "arrow.up.right")
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .font(.subheadline.weight(.semibold))
        } else {
            Color.clear.frame(height: 1)
        }
    }
}

/// A catalog app not on this machine yet, faded: its logo, its name and what it does.
struct ShelfTile: View {
    let entry: CatalogEntry

    var body: some View {
        VStack(spacing: 6) {
            AppLogo(id: entry.id, size: 58)
            Text(verbatim: entry.name)
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(verbatim: entry.description)
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
        .padding(14)
        .card()
        .opacity(0.55)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Add it on the computer")
    }
}

/// Every app, by group as the computer's whole list: what needs a look, the pinned ones, then each category.
struct EveryAppPage: View {
    let model: DashboardViewModel
    var zoom: Namespace.ID

    var body: some View {
        List {
            ForEach(model.groups) { group in
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
        }
        .themedCanvas()
        .navigationTitle("Every App")
    }
}

// MARK: - The one app's buttons

/// The app's everyday action (Start for a stopped one, Restart for one
/// that isn't well) and Logs, as capsules.
struct HeroButtons: View {
    let app: AppStatus
    /// As the redesign's card (phone-status.png): each a symbol and its word, the buttons sharing the width.
    var wide = false
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard

    var body: some View {
        // Wide, the card's layout places each beside Its Page; otherwise together in a row of their own.
        if wide {
            buttons
        } else {
            HStack(spacing: 8) { buttons }
        }
    }

    @ViewBuilder
    private var buttons: some View {
        if let action = actions.available(for: app).first(where: \.isEveryday) {
            Button { actions.request(action, on: app) } label: {
                label(action.title, symbol: action.systemImage)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accentFill)
            .disabled(actions.isBusy)
            .modifier(HeroButtonLook(wide: wide))
        }
        if app.hasLogs {
            Button { dashboard.logsApp = app } label: {
                label("Logs", symbol: "line.3.horizontal")
            }
            .buttonStyle(.bordered)
            .modifier(HeroButtonLook(wide: wide))
        }
    }

    @ViewBuilder
    private func label(_ title: String, symbol: String) -> some View {
        if wide {
            Label(title, systemImage: symbol)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
        } else {
            Text(title)
        }
    }
}

/// The hero card's capsules: small beside other words; on the redesign's card a size up, sharing the width.
struct HeroButtonLook: ViewModifier {
    let wide: Bool

    func body(content: Content) -> some View {
        content
            .buttonBorderShape(.capsule)
            .controlSize(wide ? .regular : .small)
            .font(.subheadline.weight(.semibold))
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
    }
}

extension View {
    /// The floating glass tab bar shrinks as you scroll down, as in Apple's
    /// own apps, on iOS 26 and later; earlier, nothing changes.
    @ViewBuilder func shrinkingTabBar() -> some View {
        #if os(iOS) && compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
        #else
        self
        #endif
    }
}

// MARK: - When Homelab Wizard stopped (the owner's pick, Nov 16)

/// The computer's crash note at the top of Status: which part of Homelab
/// Wizard stopped unexpectedly and when, Share the Report (shown in full
/// first, as Settings' Get Help) and Hide (on this device). Once per crash;
/// nothing on a computer that doesn't answer `LastCrash`.
struct CrashNoteCard: View {
    let note: CrashNote
    let model: DashboardViewModel
    @State private var report: DiagnosticsReport?
    @State private var making = false
    @State private var problem: String?

    var body: some View {
        card(note)
            .sheet(item: $report) { ReportView(report: $0) }
    }

    private func card(_ note: CrashNote) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.title3)
                .foregroundStyle(Theme.warning)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text(verbatim: note.title())
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                Text("It started again by itself. The diagnostics report carries what happened, with passwords and tokens taken out, for whoever helps you.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                HStack(spacing: 8) {
                    Button {
                        Task { await share() }
                    } label: {
                        if making { ProgressView().controlSize(.small) } else { Text("Share the Report") }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(making)
                    Button("Hide") {
                        withAnimation { model.hideCrash() }
                    }
                    .buttonStyle(.bordered)
                }
                .controlSize(.small)
                .padding(.top, 2)
                if let problem {
                    Text(verbatim: problem).font(.footnote).foregroundStyle(Theme.danger)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func share() async {
        making = true
        defer { making = false }
        do {
            report = try await model.report()
            problem = nil
        } catch {
            problem = "Couldn't make the report: \(error.localizedDescription)"
        }
    }
}
