import SwiftUI

/// Backups: a card with a ring of the copies that are fresh, when the last
/// backup ran and where to, and Back Up Now and Test a Restore; then
/// where they go, the restore tests, the vault, Duplicati's jobs, and each
/// app's copy.
struct BackupsView: View {
    let backups: BackupsViewModel

    var body: some View {
        Form {
            if let overview = backups.overview {
                Section {
                    BackupsHero(overview: overview)
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                        .listRowBackground(Color.clear)
                } footer: {
                    Text("A restore test restores the newest backup somewhere apart and checks it. Your apps aren't touched.")
                }
                summary(overview)
                restore(overview)
                vault(overview)
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
            }
            jobs
            if let overview = backups.overview {
                ForEach(overview.copyGroups) { group in
                    Section {
                        ForEach(group.copies) { copy in
                            CopyRow(copy: copy)
                        }
                    } header: {
                        Text(group.title)
                    } footer: {
                        if let note = group.note { Text(note) }
                    }
                }
            }
        }
        .formStyle(.grouped)
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

    // MARK: Sections

    private func summary(_ o: BackupOverview) -> some View {
        Section {
            if o.shrank > 0 {
                Label(o.shrank == 1 ? "1 copy is less than half the night before's" : "\(o.shrank) copies are less than half the night before's",
                      systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.danger)
            }
            if o.paused > 0 {
                Label("\(o.paused) waiting for a drive", systemImage: "externaldrive.badge.timemachine")
                    .foregroundStyle(.secondary)
            }
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
        Section("Restore Tests") {
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

/// The top of Backups: a ring of the copies that are fresh out of those
/// that should be, the words for it (as Status's Backups tile says them),
/// when the last backup ran and where to, and the two jobs as buttons.
private struct BackupsHero: View {
    let overview: BackupOverview
    @Environment(HomelabTasksViewModel.self) private var tasks

    var body: some View {
        let count = overview.upToDate
        let tile = StatusTiles.backups(overview)
        HStack(alignment: .center, spacing: 14) {
            ProgressRing(value: count.of == 0 ? 0 : Double(count.fresh) / Double(count.of), lineWidth: 8,
                         tint: tile.alert ? Theme.warning : Theme.success, track: Theme.accent.opacity(0.14)) {
                VStack(spacing: 0) {
                    Text(count.fresh, format: .number)
                        .font(.title3.weight(.bold))
                        .monospacedDigit()
                    Text("of \(count.of)")
                        .font(.caption2)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .frame(width: 76, height: 76)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(count.fresh) of \(count.of) copies fresh")

            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: tile.value)
                    .font(.headline)
                    .foregroundStyle(tile.alert ? Theme.warning : Theme.ink)
                if let last = overview.lastRun {
                    Text("Last backup \(last, format: .relative(presentation: .named))")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
                Text(verbatim: "To \(BackupOverview.placeName(overview.destination))")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(1)
                if tasks.canRun {
                    HStack(spacing: 8) {
                        Button(HomelabTask.backup.title) { tasks.start(.backup) }
                            .buttonStyle(.borderedProminent)
                        Button(HomelabTask.restoreTest.title) { tasks.start(.restoreTest) }
                            .buttonStyle(.bordered)
                    }
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .font(.subheadline.weight(.semibold))
                    .disabled(tasks.running != nil)
                    .padding(.top, 6)
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
        }
        .padding(14)
        .card(radius: 24)
    }
}

private struct CopyRow: View {
    @Environment(DashboardViewModel.self) private var dashboard
    let copy: BackupCopy

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
            if copy.size > 0 {
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
