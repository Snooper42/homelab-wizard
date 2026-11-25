import SwiftUI

/// Backups, as the redesign's phone picture (Nov 24; the owner's Nov 12
/// order kept): Last night, how many copies were made, when and where to,
/// with Back Up Now and Test a Restore; what needs you, in one list; the
/// restore test and off-site side by side; the fresh ones folded to a row of
/// logos; and the rest one tap down (More), the password export among it.
struct BackupsView: View {
    let backups: BackupsViewModel
    /// The fresh copies, opened from their row of logos. Kept like Status's folds.
    @SceneStorage("backupsFreshOpen") private var freshOpen = false

    /// Two columns across the iPad's width (the owner's pick, Nov 15): the summary and what needs
    /// a look on the left, the fresh copies and More on the right. One column elsewhere.
    var columns = 1
    /// Its own width, for whether two columns fit (`BackupsLayout`).
    @State private var width: CGFloat = 0

    var body: some View {
        Group {
            if BackupsLayout.columns(asked: columns, width: width) == 2, let overview = backups.overview {
                HStack(alignment: .top, spacing: 0) {
                    Form {
                        heading(overview)
                        warnings(overview)
                        needsYou(overview)
                        cards(overview)
                    }
                    .formStyle(.grouped)
                    Form {
                        fresh(overview)
                        more(overview)
                    }
                    .formStyle(.grouped)
                }
            } else {
                Form {
                    if let overview = backups.overview {
                        heading(overview)
                        warnings(overview)
                        needsYou(overview)
                        cards(overview)
                        fresh(overview)
                        more(overview)
                    } else {
                        if let error = backups.overviewError {
                            Section {
                                Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.warning)
                            }
                        }
                        Section {
                            TaskButton(task: .backup)
                            TaskButton(task: .restoreTest)
                        }
                        jobs
                    }
                }
                .formStyle(.grouped)
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .themedCanvas()
        .overlay {
            if backups.overview == nil, backups.overviewError == nil, backups.isLoading {
                ProgressView("Reading the backups…")
            }
        }
        .task { await backups.load() }
        .refreshable { await backups.load() }
        .navigationTitle("Backups")
    }

    @ViewBuilder
    private func heading(_ overview: BackupOverview) -> some View {
        Section {
            BackupsHero(overview: overview)
                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                .listRowBackground(Color.clear)
        }
    }

    /// The restore test and off-site, side by side under Needs You, as the redesign's picture.
    private func cards(_ overview: BackupOverview) -> some View {
        Section {
            BackupCards(cards: overview.cards())
                .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 4, trailing: 0))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
    }

    /// What needs you, in one list as the redesign's picture: the copies out of date or shrunk, then the ones waiting
    /// for their drive or not copied yet, each with its fix (Start for a stopped app); the waiting ones' notes under it.
    @ViewBuilder
    private func needsYou(_ overview: BackupOverview) -> some View {
        let copies = overview.needingYou
        if !copies.isEmpty {
            let notes = overview.waitingGroups.compactMap(\.note)
            Section {
                ForEach(copies) { copy in
                    CopyRow(copy: copy)
                }
            } header: {
                CountHeader(title: "Needs You", count: copies.count, tint: overview.needingALook.isEmpty ? .secondary : Theme.warning)
            } footer: {
                if !notes.isEmpty { Text(verbatim: notes.joined(separator: "\n")) }
            }
        }
    }

    @ViewBuilder
    private func fresh(_ overview: BackupOverview) -> some View {
        if !overview.freshCopies.isEmpty {
            Section {
                if freshOpen {
                    ForEach(overview.freshCopies) { copy in
                        CopyRow(copy: copy)
                    }
                } else {
                    FoldedCopies(copies: overview.freshCopies) { freshOpen = true }
                }
            } header: {
                Button {
                    withAnimation(.snappy) { freshOpen.toggle() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.right").accessibilityHidden(true)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .rotationEffect(.degrees(freshOpen ? 90 : 0))
                        CountHeader(title: "Up to Date", count: overview.freshCopies.count, tint: .secondary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityValue(freshOpen ? "Open" : "Folded")
            }
        }
    }

    /// What can't wait for More: unencrypted password exports lying around,
    /// and backups on the same disk as the data.
    @ViewBuilder
    private func warnings(_ o: BackupOverview) -> some View {
        let vault = o.vaultNeedsDoing()
        if !o.plainExports.isEmpty || !o.destinationOK || vault != nil {
            Section {
                if !o.plainExports.isEmpty {
                    Label("Unencrypted password exports are lying in recovery-staging. Delete them on the computer.", systemImage: "exclamationmark.lock.fill")
                        .foregroundStyle(Theme.danger)
                }
                if !o.destinationOK {
                    Label("The backups are on the same disk as the data. Choose another drive on the computer, under Backups.", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(Theme.warning)
                }
                // The password export, due or never made: its tile left the top for the redesign's two cards.
                if let vault {
                    Label("\(vault.title): \([vault.value, vault.detail].compactMap { $0 }.joined(separator: ", "))", systemImage: "lock")
                        .foregroundStyle(Theme.warning)
                }
            }
        }
    }

    /// The detail, one tap down: Duplicati's jobs, the restore tests, where
    /// the backups go, and the password export.
    private func more(_ o: BackupOverview) -> some View {
        Section("More") {
            NavigationLink {
                page("Duplicati") { jobs }
            } label: {
                IconTileLabel(title: "Duplicati’s jobs", systemImage: "shippingbox.fill", tint: TileColour.indigo) {
                    if let jobs = backups.jobs { Text("\(jobs.count)") }
                }
            }
            NavigationLink {
                page("Restore Tests") { restore(o) }
            } label: {
                IconTileLabel(title: "Restore tests", systemImage: "arrow.counterclockwise", tint: TileColour.grey) {
                    if let tested = o.restoreTest.lastTest { Text(verbatim: BackupOverview.ago(tested)) }
                }
            }
            NavigationLink {
                page("Where They Go") { summary(o) }
            } label: {
                IconTileLabel(title: "Where they go", systemImage: "externaldrive.fill", tint: TileColour.blue) {
                    Text(verbatim: BackupOverview.placeName(o.destination)).lineLimit(1)
                }
            }
            NavigationLink {
                page("Password Export") { vault(o) }
            } label: {
                IconTileLabel(title: "Password export", systemImage: "key.horizontal.fill", tint: TileColour.orange) { EmptyView() }
            }
        }
    }

    /// A page of More, on the same canvas as Backups.
    private func page(_ title: String, @ViewBuilder _ content: () -> some View) -> some View {
        Form { content() }
            .formStyle(.grouped)
            .themedCanvas()
            .navigationTitle(title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
    }

    // MARK: Sections

    private func summary(_ o: BackupOverview) -> some View {
        Section {
            // The settings file (.env) goes with the nightly backup, as the computer says.
            LabeledContent("Settings file") {
                if let copied = o.envCopied {
                    Text("Copied \(copied, format: .relative(presentation: .named))")
                } else {
                    Text("Not copied yet").foregroundStyle(Theme.warning)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                LabeledContent("Goes to") { Text(verbatim: BackupOverview.placeName(o.destination)) }
                // The whole folder, under it: too long to sit beside the label.
                Text(verbatim: o.destination)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
            }
            if !o.destinationOK {
                Label("The backups are on the same disk as the data. Choose another drive on the computer, under Backups.", systemImage: "exclamationmark.triangle")
                    .foregroundStyle(Theme.warning)
            }
        } header: {
            Text("Nightly Backup")
        } footer: {
            if o.staleAfterHours > 0 {
                Text("A copy counts as out of date after \(o.staleAfterHours) hours.")
            }
        }
    }

    private func restore(_ o: BackupOverview) -> some View {
        Section {
            if let failed = o.restoreTest.failedSince {
                Label("Failed \(failed.when.formatted(.relative(presentation: .named))): \(failed.summary)", systemImage: "xmark.octagon.fill")
                    .foregroundStyle(Theme.danger)
            }
            if let tested = o.restoreTest.lastTest {
                LabeledContent("Last passed") {
                    if let took = o.restoreTest.lastPassTook {
                        Text("\(tested.formatted(.relative(presentation: .named))) · in \(RestoreRun.took(took))")
                    } else {
                        Text(tested, format: .relative(presentation: .named))
                    }
                }
                if let summary = o.restoreTest.lastSummary, !summary.isEmpty {
                    Text(summary).font(.callout).foregroundStyle(.secondary)
                }
            } else {
                Text("No restore test has passed yet.").foregroundStyle(.secondary)
            }
            if o.restoreDue {
                Label("A restore test is due: Test a Restore, below, runs one.", systemImage: "calendar.badge.exclamationmark")
                    .foregroundStyle(Theme.warning)
            }
            if !o.restoreTest.history.isEmpty {
                DisclosureGroup("Drills on record (\(o.restoreTest.history.count))") {
                    // By position: two drills can share a moment.
                    ForEach(o.restoreTest.recentDrills.indices, id: \.self) { i in
                        let run = o.restoreTest.recentDrills[i]
                        HStack {
                            Image(systemName: run.passed ? "checkmark.circle.fill" : "xmark.octagon.fill")
                                .foregroundStyle(run.passed ? Theme.success : Theme.danger)
                                .accessibilityLabel(run.passed ? "Passed" : "Failed")
                            Text(run.when, format: .dateTime.month(.abbreviated).day())
                            if run.engine == "kopia" { Text(verbatim: "Kopia").foregroundStyle(.secondary) }
                            Spacer()
                            if run.seconds > 0 {
                                Text(RestoreRun.took(run.seconds)).foregroundStyle(.secondary)
                            }
                        }
                        .font(.callout)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            if let kopia = o.kopia {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Kopia").fontWeight(.semibold)
                    if !kopia.repository.isEmpty {
                        Text("A second copy of the same folders, apart from Duplicati's, in \(kopia.repository)")
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                    if let failed = kopia.failed, !failed.isEmpty {
                        Text("Last test failed: \(failed)").foregroundStyle(Theme.danger)
                    } else if let tested = kopia.lastTest {
                        Text("Last passed \(tested, format: .relative(presentation: .named))").foregroundStyle(.secondary)
                    }
                    if kopia.due {
                        Text("A Kopia restore test is due.").foregroundStyle(Theme.warning)
                    }
                }
                .font(.callout)
            }
        }
    }

    private func vault(_ o: BackupOverview) -> some View {
        Section {
            switch o.vaultState {
            case .plainExportLyingAround:
                EmptyView()
            case .neverMade:
                Label("Never made yet.", systemImage: "key.horizontal")
                    .foregroundStyle(Theme.warning)
            case .due(let exported):
                Label("Due: the last one is from \(exported.formatted(.relative(presentation: .named))).", systemImage: "key.horizontal")
                    .foregroundStyle(Theme.warning)
            case .fine(let exported):
                LabeledContent("Last encrypted export") { Text(exported, format: .relative(presentation: .named)) }
            }
            if !o.plainExports.isEmpty {
                Label("Unencrypted exports are lying in recovery-staging. Delete them on the computer:", systemImage: "exclamationmark.lock.fill")
                    .foregroundStyle(Theme.danger)
                ForEach(o.plainExports, id: \.self) { name in
                    Text(verbatim: name).font(.caption.monospaced()).textSelection(.enabled)
                }
            }
        } header: {
            Text("Password Vault Export")
        } footer: {
            Text("A copy of your passwords you can open anywhere, once a month.")
        }
    }

    @ViewBuilder
    private var jobs: some View {
        if let jobs = backups.jobs, !jobs.isEmpty {
            Section {
                ForEach(jobs) { job in
                    JobRow(job: job)
                }
            } header: {
                Text("Duplicati")
            } footer: {
                Text(DuplicatiWords.summary(jobs))
            }
        } else if let jobs = backups.jobs, jobs.isEmpty {
            Section("Duplicati") {
                Text("No jobs yet. Create the backup jobs on the computer, under Backups.")
                    .foregroundStyle(.secondary)
            }
        } else if let error = backups.jobsError {
            Section("Duplicati") {
                Text(DuplicatiWords.problem(error)).foregroundStyle(.secondary)
            }
        }
    }
}

private struct JobRow: View {
    let job: DuplicatiJob

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Image(systemName: icon).foregroundStyle(tint)
                    .accessibilityLabel(stateWords)
                Text(job.name).fontWeight(.semibold)
                Spacer()
                if let size = job.size { Text(DuplicatiJob.sizeText(size)).font(.caption).foregroundStyle(.secondary) }
            }
            if let finished = job.lastFinished {
                Text("Finished \(finished, format: .relative(presentation: .named))").font(.caption).foregroundStyle(.secondary)
            } else {
                Text("Hasn't run yet").font(.caption).foregroundStyle(.secondary)
            }
            if let message = job.errorMessage, !message.isEmpty {
                Text(message).font(.caption).foregroundStyle(Theme.danger).lineLimit(4)
            } else if job.damaged, let checked = job.checked, let problem = job.checkProblem {
                // Sunday's check found a damaged file (main #463).
                Text("Failed its check \(checked.formatted(Self.checkTime)): \(problem). A version may not restore: open the job in Duplicati.")
                    .font(.caption).foregroundStyle(Theme.danger).lineLimit(5)
            } else if job.state == "stale" {
                Text("Not run for over a week").font(.caption).foregroundStyle(Theme.warning)
            }
            if let summary = job.lastRunSummary {
                Text(summary).font(.caption).foregroundStyle(.secondary)
            }
            if !job.sources.isEmpty {
                Text("Copies " + job.sourceNames.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            if let next = job.nextRun {
                Text("Next \(next, format: .relative(presentation: .named))").font(.caption).foregroundStyle(.secondary)
            }
            if let checked = job.checked {
                Text(job.checkProblem == nil
                     ? "Checked \(checked.formatted(Self.checkTime)): a sample of its files matched"
                     : "Checked \(checked.formatted(Self.checkTime)): a file is damaged")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// "Sun, Nov 8, 7:12 AM", as the computer's dateTimeText.
    private static let checkTime = Date.FormatStyle.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute()

    private var stateWords: String {
        if job.damaged { return "Failed its check" }
        return switch job.state {
        case "ok": "Backed up"
        case "failed": "Failed"
        case "stale": "Out of date"
        default: "Not run yet"
        }
    }

    private var icon: String {
        if job.damaged { return "xmark.octagon.fill" }
        return switch job.state {
        case "ok": "checkmark.circle.fill"
        case "failed": "xmark.octagon.fill"
        case "stale": "exclamationmark.triangle.fill"
        default: "circle.dashed"
        }
    }

    private var tint: Color {
        if job.damaged { return Theme.danger }
        return switch job.state {
        case "ok": Theme.success
        case "failed": Theme.danger
        case "stale": Theme.warning
        default: .secondary
        }
    }
}

/// The top of Backups, as the redesign's phone picture (phone-backups.png)
/// and the computer's Last night card: a chip for what was skipped, how many
/// of last night's copies were made ("11 of 12 copied"), when it finished
/// and where they went, then Back Up Now and Test a Restore side by side.
/// The fourteen nights' squares join when the computer keeps each night's
/// result (quality-loop Q4).
private struct BackupsHero: View {
    let overview: BackupOverview
    @Environment(HomelabTasksViewModel.self) private var tasks
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let words = overview.lastNight()
        VStack(alignment: .leading, spacing: 6) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline) {
                    title
                    Spacer(minLength: 8)
                    chip(words.chip)
                }
                VStack(alignment: .leading, spacing: 6) {
                    title
                    chip(words.chip)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(verbatim: words.figure)
                    .font(.system(.largeTitle, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text(verbatim: words.unit)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.secondaryInk)
            }
            .accessibilityElement(children: .combine)
            if !words.caption.isEmpty {
                Text(verbatim: words.caption)
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .tracking(0.6)
                    .foregroundStyle(Theme.secondaryInk)
            }
            if tasks.canRun {
                let layout = typeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(spacing: 10))
                    : AnyLayout(HStackLayout(spacing: 10))
                layout {
                    Button { tasks.start(.backup) } label: {
                        Text(HomelabTask.backup.title).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accentFill)
                    Button { tasks.start(.restoreTest) } label: {
                        Text(HomelabTask.restoreTest.title).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .font(.headline)
                .disabled(tasks.running != nil)
                .padding(.top, 8)
            } else {
                Text("This device can only look.")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
            }
            if let running = tasks.running, running == .backup || running == .restoreTest {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.small)
                    Text(running.progressTitle).font(.caption).foregroundStyle(Theme.secondaryInk)
                }
            }
            ForEach([HomelabTask.backup, .restoreTest], id: \.self) { task in
                if let error = tasks.errors[task] {
                    Text(error).font(.caption).foregroundStyle(Theme.danger)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .card(radius: 24)
    }

    private var title: some View {
        Text("Last night")
            .font(.headline)
            .foregroundStyle(Theme.ink)
    }

    @ViewBuilder
    private func chip(_ words: String?) -> some View {
        if let words {
            Label(words, systemImage: "exclamationmark.triangle")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.warning)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Theme.warning.opacity(0.14), in: Capsule())
                .lineLimit(1)
        }
    }
}

private struct CopyRow: View {
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(AppActionsViewModel.self) private var actions
    let copy: BackupCopy

    /// The app of a copy that's out of date because it's stopped: Start, beside it, is its fix.
    private var stoppedApp: AppStatus? {
        guard copy.state == "stale", let id = copy.app else { return nil }
        return dashboard.liveEvents.status?.apps.first { $0.id == id && $0.state == "stopped" }
    }

    var body: some View {
        HStack(spacing: 10) {
            // The app's logo with its copy's state as a badge, or the state alone.
            if let id = copy.app, BundledLogo.image(for: id) != nil {
                AppLogo(id: id, size: 28)
                    .overlay(alignment: .bottomTrailing) {
                        Image(systemName: icon)
                            .font(.system(size: 12))
                            .foregroundStyle(tint)
                            .background(Circle().fill(.background).padding(1))
                            .offset(x: 4, y: 4)
                    }
                    .accessibilityElement()
                    .accessibilityLabel(stateWords)
            } else {
                Image(systemName: icon).foregroundStyle(tint)
                    .accessibilityLabel(stateWords)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: copy.name)
                Group {
                    if let drive = copy.waitingFor, !drive.isEmpty {
                        Text("Waiting for the \(AppStatus.driveName(drive)) drive")
                    } else if let newest = copy.newest {
                        Text("\(newest, format: .relative(presentation: .named)) · \(copy.count) \(copy.count == 1 ? "copy" : "copies")")
                    } else {
                        Text("No copy yet")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                if let why = copy.staleWhy(apps: dashboard.liveEvents.status?.apps) {
                    Text(verbatim: why)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if copy.shrank {
                    Text("Less than half the night before's \(copy.before, format: .byteCount(style: .memory)): check that \(copy.name) still has its data.")
                        .font(.caption)
                        .foregroundStyle(Theme.danger)
                }
            }
            Spacer(minLength: 0)
            if let app = stoppedApp, actions.canChangeApps {
                Button("Start") { actions.request(.start, on: app) }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .tint(Theme.accentFill)
                    .disabled(actions.isBusy)
                    .accessibilityLabel("Start \(app.name)")
            } else if copy.size > 0 {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(copy.size, format: .byteCount(style: .memory))
                    if !copy.shrank, copy.sizeChanged {
                        Text("was \(copy.before, format: .byteCount(style: .memory))")
                    }
                }
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var stateWords: String {
        if copy.shrank { return "Shrank" }
        return switch copy.state {
        case "fresh": "Fresh"
        case "stale": "Out of date"
        case "paused": "Waiting for its drive"
        default: "No copy yet"
        }
    }

    private var icon: String {
        if copy.shrank { return "exclamationmark.triangle.fill" }
        return switch copy.state {
        case "fresh": "checkmark.circle.fill"
        case "stale": "exclamationmark.triangle.fill"
        case "paused": "pause.circle.fill"
        default: "circle.dashed"
        }
    }

    private var tint: Color {
        if copy.shrank { return Theme.danger }
        return switch copy.state {
        case "fresh": Theme.success
        case "stale": Theme.warning
        default: .secondary
        }
    }
}

/// The restore test and off-site, as the redesign's phone picture: each its
/// name, its state in big (amber or red when it needs a look), and a line or
/// two. Side by side; one under the other at the largest text sizes.
private struct BackupCards: View {
    let cards: [BackupOverview.Card]
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: 12))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 12))
        layout {
            ForEach(cards) { card in
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: card.title)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(verbatim: card.value)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(card.tone == .good ? Theme.ink : card.tone == .warn ? Theme.warning : Theme.danger)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    ForEach(card.lines, id: \.self) { line in
                        Text(verbatim: line)
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryInk)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(16)
                .card(radius: 24)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// A section's name and how many are in it, as Status's group headers.
private struct CountHeader: View {
    let title: String
    let count: Int
    let tint: Color

    var body: some View {
        HStack(spacing: 6) {
            Text(verbatim: title)
            Text("\(count)").pill(tint)
        }
        .textCase(nil)
    }
}

/// The fresh copies, folded: their apps' logos in a row and their names
/// under them, as a folded Status group shows its apps. A tap opens them.
private struct FoldedCopies: View {
    let copies: [BackupCopy]
    let open: @MainActor () -> Void
    @ScaledMetric(relativeTo: .body) private var logo: CGFloat = 30
    private let shown = 6

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    ForEach(copies.prefix(shown)) { copy in
                        AppLogo(id: copy.app, size: min(logo, 44))
                    }
                    if copies.count > shown {
                        Text(verbatim: "+\(copies.count - shown)")
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                            .frame(width: min(logo, 44), height: min(logo, 44))
                            .background(Theme.canvas, in: RoundedRectangle(cornerRadius: min(logo, 44) * 0.22, style: .continuous))
                    }
                    Spacer(minLength: 0)
                }
                Text(verbatim: copies.map(\.name).joined(separator: ", "))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "Up to date: " + copies.map(\.name).joined(separator: ", ")))
        .accessibilityHint("Shows each copy")
    }
}
