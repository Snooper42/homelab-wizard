import SwiftUI

// The top of Status, as the owner chose it ("The pick" in the mockups): a
// card with a ring of the apps running out of all of them and the one thing
// that needs a look, with its button; then four small tiles (Backups,
// Saved, Updates, Checks). Below them the apps stay a list, by category,
// as the computer's Status.

/// What the top of Status says, worked out from the status alone, so it can
/// be tested without a screen.
struct StatusHeadline: Equatable {
    /// Apps running, out of those counted (the companion waiting for its
    /// scheduled jobs isn't counted, as on the computer).
    let running: Int
    let total: Int
    /// The first app that needs a look, if any.
    let attentionID: AppStatus.ID?
    /// How many need a look.
    let attentionCount: Int

    init(status: HomelabStatus?) {
        let counted = (status?.apps ?? []).filter { !$0.awaitingJobs }
        running = counted.filter(\.isRunning).count
        total = counted.count
        let attention = (status?.apps ?? []).filter(\.needsAttention)
        attentionID = attention.first?.id
        attentionCount = attention.count
    }

    /// 0 to 1, for the ring.
    var share: Double { total == 0 ? 0 : Double(running) / Double(total) }

    /// The headline when something needs you, as the redesign's Status
    /// (docs/images/redesign/phone-status.png): "1 app needs you",
    /// "3 apps need you".
    var title: String { attentionCount == 1 ? "1 app needs you" : "\(attentionCount) apps need you" }

    /// Under it: "21 of 22 running".
    var runningLine: String { "\(running) of \(total) running" }
}

/// The ring and the one thing that needs a look, or that all is well.
struct StatusHero: View {
    let model: DashboardViewModel
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let headline = StatusHeadline(status: model.liveEvents.status)
        let app = model.app(id: headline.attentionID)
        let health = model.healthLine ?? ""
        // The ring beside the words, or above them at the largest text sizes.
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 14))
            : AnyLayout(HStackLayout(alignment: .center, spacing: 14))
        layout {
            ProgressRing(value: headline.share, lineWidth: 8,
                         tint: app == nil && health.isEmpty ? Theme.success : Theme.accent,
                         track: Theme.accent.opacity(0.14)) {
                VStack(spacing: 0) {
                    Text(headline.running, format: .number)
                        .font(.title3.weight(.bold))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(headline.running)))
                    Text("of \(headline.total)")
                        .font(.caption2)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .frame(width: 76, height: 76)
            // The ring's number stays inside the ring at any text size.
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .animation(.snappy, value: headline.running)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(headline.running) of \(headline.total) apps running")

            VStack(alignment: .leading, spacing: 3) {
                if let app {
                    Text(headline.attentionCount > 1 ? "\(headline.attentionCount) need a look" : "Needs a look")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.warning)
                    Text(verbatim: app.name)
                        .font(.headline)
                    Text(verbatim: app.detailLine)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                        .lineLimit(2)
                    HeroButtons(app: app)
                        .padding(.top, 6)
                } else if !health.isEmpty {
                    Text("Needs a look")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.warning)
                    Text(verbatim: health)
                        .font(.headline)
                        .lineLimit(3)
                } else {
                    Text("All well")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.success)
                    Text(verbatim: model.summary)
                        .font(.headline)
                    if let words = model.overnightLine {
                        Text(words)
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryInk)
                            .lineLimit(3)
                    }
                }
                if let error = model.liveEvents.refreshError {
                    Label {
                        Text(verbatim: error)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle")
                    }
                    .font(.footnote)
                    .foregroundStyle(Theme.warning)
                    .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .card()
    }
}

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

/// One small tile: what it is in its colour, a big value, a line under it.
struct StatusTile: View {
    let title: String
    let systemImage: String
    let tint: Color
    let value: String
    var detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(title, systemImage: systemImage)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(tint)
            Text(verbatim: value)
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let detail {
                Text(verbatim: detail)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
        .padding(12)
        .card()
        .accessibilityElement(children: .combine)
    }
}

/// Backups, Saved, Updates and Checks, two by two; a tile with nothing to
/// say yet isn't shown.
struct StatusTiles: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    let model: DashboardViewModel
    /// Opens the Backups tab.
    var openBackups: (@MainActor () -> Void)?

    var body: some View {
        LazyVGrid(columns: typeSize.isAccessibilitySize
                  ? [GridItem(.flexible())]
                  : [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            if let overview = model.backups.overview {
                let tile = Self.backups(overview)
                Button { openBackups?() } label: {
                    StatusTile(title: "Backups", systemImage: "archivebox", tint: tile.alert ? Theme.warning : Theme.success,
                               value: tile.value, detail: tile.detail)
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(openBackups == nil)
            }
            if let savings = model.yearlySavings {
                StatusTile(title: "Saved", systemImage: "dollarsign.circle", tint: Theme.accent,
                           value: savings.formatted(.currency(code: "USD").precision(.fractionLength(0))) + " a year",
                           detail: "Subscriptions you don’t pay")
            }
            if let updates = model.liveEvents.status?.updates {
                StatusTile(title: "Updates", systemImage: "arrow.triangle.2.circlepath", tint: updates.paused ? Theme.warning : Theme.info,
                           value: updates.paused ? "Paused" : "On",
                           detail: updates.paused ? "Nightly updates are off" : updates.schedule.isEmpty ? nil : ClockWords.schedule(updates.schedule))
            }
            if let watchdog = model.cards.watchdog, watchdog.checks > 0 {
                let failing = model.failingChecks
                StatusTile(title: "Checks", systemImage: "stethoscope", tint: failing > 0 ? Theme.danger : Theme.success,
                           value: failing > 0 ? "\(failing) failing" : "All \(watchdog.checks) pass",
                           detail: watchdog.lastRun.map { "Checked " + $0.formatted(.relative(presentation: .named)) })
            }
        }
    }

    /// The Backups tile's words: how many copies are fresh, or how many need a look.
    nonisolated static func backups(_ o: BackupOverview) -> (value: String, detail: String?, alert: Bool) {
        let trouble = o.stale + o.shrank
        let value: String
        if o.copies.isEmpty {
            value = "None yet"
        } else if trouble > 0 {
            value = "\(trouble) need\(trouble == 1 ? "s" : "") a look"
        } else {
            value = o.copies.count == 1 ? "1 fresh" : "All \(o.copies.count) fresh"
        }
        let detail = o.lastRun.map { "Last run " + $0.formatted(.relative(presentation: .named)) }
        return (value, detail, trouble > 0)
    }

    nonisolated static func capitalized(_ s: String) -> String? {
        guard let first = s.first else { return nil }
        return first.uppercased() + s.dropFirst()
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

// MARK: - The trimmed top (Nov 9)

/// The top of Status as the owner trimmed it: one line when all is well
/// ("All 47 apps are running"), or one card for what needs a look, with
/// what's wrong in a sentence and its button. Nothing else above the apps.
struct StatusTop: View {
    let model: DashboardViewModel
    /// Opens an app's page (Status's navigation path).
    var open: @MainActor (AppStatus.ID) -> Void = { _ in }

    var body: some View {
        let headline = StatusHeadline(status: model.liveEvents.status)
        if let app = model.app(id: headline.attentionID) {
            StatusAlertCard(app: app, others: headline.attentionCount - 1, headline: headline) { open(app.id) }
        } else if let health = model.healthLine, !health.isEmpty {
            StatusAlertCard(app: nil, others: 0, words: health)
        } else {
            HStack(spacing: 8) {
                Circle()
                    .fill(Design.running)
                    .frame(width: 9, height: 9)
                Text(verbatim: Self.line(model.liveEvents.status))
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                if let error = model.liveEvents.refreshError {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(Theme.warning)
                        .accessibilityLabel(Text(verbatim: error))
                }
            }
            .padding(.horizontal, 4)
            .accessibilityElement(children: .combine)
        }
    }

    /// "All 47 apps are running", or what keeps that from being true
    /// without anything being wrong: "46 running, 1 stopped by you".
    nonisolated static func line(_ status: HomelabStatus?) -> String {
        guard let status else { return "Reading your apps…" }
        let counted = status.apps.filter { !$0.awaitingJobs }
        guard !counted.isEmpty else { return "No apps yet" }
        let running = counted.filter(\.isRunning).count
        if running == counted.count {
            return counted.count == 1 ? "Your app is running" : "All \(counted.count) apps are running"
        }
        let stopped = counted.count - running
        return "\(running) running, \(stopped) stopped by you"
    }
}

/// What needs a look, as one card: the app's logo, "Needs a look", what's
/// wrong in a sentence, then its everyday button and Open Its Page.
struct StatusAlertCard: View {
    let app: AppStatus?
    /// How many more need a look besides it.
    let others: Int
    /// For a problem that's no app's (the health line): its words.
    var words: String? = nil
    /// The whole homelab's count, for the redesign's headline over the app
    /// ("1 app needs you", "21 of 22 running").
    var headline: StatusHeadline? = nil
    /// Opens the app's page.
    var open: @MainActor () -> Void = {}
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // The buttons side by side, or Open Its Page under the others at the
        // largest text sizes (beside them it squeezed Start to "Star / t").
        let buttons = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
        // The logo over its words there too: beside them it took a column of its own, and
        // "Needs a look" broke onto two lines beside it (large-status).
        let heading = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 11))
        if let app, let headline {
            // The redesign's card (phone-status.png): the headline and the count
            // over a rule, then the app with what's wrong, then its buttons.
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: headline.title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Theme.warning)
                    Text(verbatim: headline.runningLine)
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.secondaryInk)
                }
                Divider()
                heading {
                    AppIconView(app: app, size: 40, stateBadge: false)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(verbatim: app.name)
                            .font(.headline)
                            .foregroundStyle(Theme.ink)
                            .lineLimit(1)
                        Text(verbatim: app.detailLine)
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryInk)
                            .lineLimit(2)
                    }
                }
                buttons {
                    HeroButtons(app: app, wide: true)
                    Button { open() } label: {
                        Text("Its Page").lineLimit(1).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .modifier(HeroButtonLook(wide: true))
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        } else {
            legacy(buttons: buttons, heading: heading)
        }
    }

    /// A problem that's no app's (the health line), or an app without the
    /// homelab's count: "Needs a look" over its words, as before.
    private func legacy(buttons: AnyLayout, heading: AnyLayout) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            heading {
                if let app {
                    AppIconView(app: app, size: 40, stateBadge: false)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(others > 0 ? "\(others + 1) need a look" : "Needs a look")
                        .font(.caption.weight(.bold))
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.warning)
                    Text(verbatim: app?.name ?? (words ?? ""))
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .lineLimit(app == nil ? 3 : 1)
                }
            }
            if let app {
                Text(verbatim: app.detailLine)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(2)
                buttons {
                    HeroButtons(app: app)
                    Button("Open Its Page") { open() }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .font(.subheadline.weight(.semibold))
                    .dynamicTypeSize(...DynamicTypeSize.accessibility1)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
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

// MARK: - Backups and This Mac (the redesign, Nov 24)

/// Under the headline, two cards side by side as the redesign's phone
/// picture (`phone-status.png`) and the computer's Status: **Backups**, how
/// many of last night's copies were made and what was skipped, opening
/// Backups; and **This Mac**, its free space, its power and the nightly
/// updates. One above the other at the largest text sizes. Not on a
/// household member's phone, whose homelab isn't theirs to look after.
struct StatusPair: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    let model: DashboardViewModel

    var body: some View {
        let overview = model.backups.overview
        let machine = model.cards.machine
        let updates = model.liveEvents.status?.updates
        if overview != nil || machine != nil || updates != nil {
            let columns = typeSize.isAccessibilitySize
                ? [GridItem(.flexible())]
                : [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
            LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                if let overview {
                    let words = Self.backups(overview)
                    Button { IntentInbox.shared.screen = .backups } label: {
                        PairCard(title: "Backups", icon: "externaldrive", figure: words.figure, unit: words.unit, lines: words.lines, alert: words.alert)
                    }
                    .buttonStyle(PressableButtonStyle())
                    .accessibilityHint("Opens Backups")
                }
                if machine != nil || updates != nil {
                    let words = Self.machine(machine, updates: updates)
                    PairCard(title: "This Machine", icon: "desktopcomputer", figure: words.figure, unit: words.unit, lines: words.lines, alert: words.alert)
                }
            }
        }
    }

    /// The Backups card's words: "11" "of 12", then when it ran and what was skipped.
    nonisolated static func backups(_ o: BackupOverview, now: Date = .now) -> (figure: String, unit: String, lines: [String], alert: Bool) {
        let copies = o.copies
        guard !copies.isEmpty else { return ("—", "", ["No copies yet"], false) }
        let fresh = copies.filter { $0.state == "fresh" }.count
        var lines: [String] = []
        if let run = o.lastRun {
            lines.append(now.timeIntervalSince(run) < 30 * 3600
                ? "Last night at " + run.formatted(date: .omitted, time: .shortened)
                : "Last run " + run.formatted(.relative(presentation: .named)))
        }
        let skipped = copies.filter { $0.state == "stale" }
        let waiting = copies.filter { $0.state == "paused" }
        if skipped.count == 1 {
            lines.append("\(skipped[0].name) skipped")
        } else if skipped.count > 1 {
            lines.append("\(skipped.count) skipped")
        } else if !waiting.isEmpty {
            lines.append(waiting.count == 1 ? "1 waiting for its drive" : "\(waiting.count) waiting for their drive")
        }
        return ("\(fresh)", "of \(copies.count)", lines, !skipped.isEmpty || o.shrank > 0)
    }

    /// The This Mac card's words: "412 GB" "free", then the power and the nightly updates.
    nonisolated static func machine(_ m: MachineFacts?, updates: UpdatesState?) -> (figure: String, unit: String, lines: [String], alert: Bool) {
        var lines: [String] = []
        if let words = m?.powerWords { lines.append(words) }
        if let updates {
            if updates.paused {
                lines.append("Updates paused")
            } else if !updates.schedule.isEmpty {
                let when = ClockWords.schedule(updates.schedule)
                lines.append("Updates " + when.prefix(1).lowercased() + when.dropFirst())
            }
        }
        guard let m else { return ("—", "", lines, false) }
        return (m.freeFigure, "free", lines, m.needsALook)
    }
}

/// One of the two: its name, a big figure with a smaller word beside it,
/// and a line or two under it, as the computer's Backups and This Mac cards.
private struct PairCard: View {
    let title: String
    var icon = "square.grid.2x2"
    let figure: String
    let unit: String
    let lines: [String]
    var alert = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            SymbolTitle(text: title, icon: icon)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(verbatim: figure)
                    .font(.title.weight(.bold))
                    .foregroundStyle(alert ? Theme.warning : Theme.ink)
                    .monospacedDigit()
                if !unit.isEmpty {
                    Text(verbatim: unit)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            ForEach(lines, id: \.self) { line in
                Text(verbatim: line)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .padding(16)
        .card()
        .accessibilityElement(children: .combine)
    }
}
