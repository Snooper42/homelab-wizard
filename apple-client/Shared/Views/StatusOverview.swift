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
        .card(radius: 24)
    }
}

/// The app's everyday action (Start for a stopped one, Restart for one
/// that isn't well) and Logs, as capsules.
struct HeroButtons: View {
    let app: AppStatus
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard

    var body: some View {
        HStack(spacing: 8) {
            if let action = actions.available(for: app).first(where: \.isEveryday) {
                Button(action.title) { actions.request(action, on: app) }
                    .buttonStyle(.borderedProminent)
                    .disabled(actions.isBusy)
            }
            if app.hasLogs {
                Button("Logs") { dashboard.logsApp = app }
                    .buttonStyle(.bordered)
            }
        }
        .buttonBorderShape(.capsule)
        .controlSize(.small)
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
        .card(radius: 24)
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
                           detail: updates.paused ? "Nightly updates are off" : Self.capitalized(updates.schedule))
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
            StatusAlertCard(app: app, others: headline.attentionCount - 1) { open(app.id) }
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
    static func line(_ status: HomelabStatus?) -> String {
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
    /// Opens the app's page.
    var open: @MainActor () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 11) {
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
                HStack(spacing: 8) {
                    HeroButtons(app: app)
                    Button("Open Its Page") { open() }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .font(.subheadline.weight(.semibold))
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 20)
    }
}
