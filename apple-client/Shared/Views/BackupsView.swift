import SwiftUI

/// Backups, read-only: where they go, whether each app's copy is fresh,
/// Duplicati's jobs, and the restore tests that prove they work.
struct BackupsView: View {
    let backups: BackupsViewModel

    var body: some View {
        Form {
            if let overview = backups.overview {
                summary(overview)
                restore(overview)
                vault(overview)
            } else if let error = backups.overviewError {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.orange)
                }
            }
            Section {
                TaskButton(task: .backup)
                TaskButton(task: .restoreTest)
            } footer: {
                Text("A restore test restores the newest backup somewhere apart and checks it. Your apps aren't touched.")
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
            if o.stale > 0 {
                Label("\(o.stale) \(o.stale == 1 ? "copy is" : "copies are") out of date", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
            } else if o.copies.isEmpty {
                Label("No backups yet", systemImage: "externaldrive.badge.questionmark")
                    .foregroundStyle(.secondary)
            } else {
                Label("Every copy is fresh", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
            if o.shrank > 0 {
                Label(o.shrank == 1 ? "1 copy is less than half the night before's" : "\(o.shrank) copies are less than half the night before's",
                      systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
            }
            if o.paused > 0 {
                Label("\(o.paused) waiting for a drive", systemImage: "externaldrive.badge.timemachine")
                    .foregroundStyle(.secondary)
            }
            if let last = o.lastRun {
                LabeledContent("Last backup") { Text(last, format: .relative(presentation: .named)) }
            }
            if !o.copies.isEmpty {
                LabeledContent("Copies up to date", value: "\(o.upToDate.fresh) of \(o.upToDate.of)")
            }
            // The settings file (.env) goes with the nightly backup, as the computer says.
            LabeledContent("Settings file") {
                if let copied = o.envCopied {
                    Text("Copied \(copied, format: .relative(presentation: .named))")
                } else {
                    Text("Not copied yet").foregroundStyle(.orange)
                }
            }
            LabeledContent("Goes to") {
                Text(o.destination).textSelection(.enabled).multilineTextAlignment(.trailing)
            }
            if !o.destinationOK {
                Label("The backups are on the same disk as the data. Choose another drive on the computer, under Backups.", systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.orange)
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
                    .foregroundStyle(.red)
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
                    .foregroundStyle(.orange)
            }
            if !o.restoreTest.history.isEmpty {
                DisclosureGroup("Drills on record (\(o.restoreTest.history.count))") {
                    // By position: two drills can share a moment.
                    ForEach(o.restoreTest.recentDrills.indices, id: \.self) { i in
                        let run = o.restoreTest.recentDrills[i]
                        HStack {
                            Image(systemName: run.passed ? "checkmark.circle.fill" : "xmark.octagon.fill")
                                .foregroundStyle(run.passed ? .green : .red)
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
                        Text("Last test failed: \(failed)").foregroundStyle(.red)
                    } else if let tested = kopia.lastTest {
                        Text("Last passed \(tested, format: .relative(presentation: .named))").foregroundStyle(.secondary)
                    }
                    if kopia.due {
                        Text("A Kopia restore test is due.").foregroundStyle(.orange)
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
                    .foregroundStyle(.orange)
            case .due(let exported):
                Label("Due: the last one is from \(exported.formatted(.relative(presentation: .named))).", systemImage: "key.horizontal")
                    .foregroundStyle(.orange)
            case .fine(let exported):
                LabeledContent("Last encrypted export") { Text(exported, format: .relative(presentation: .named)) }
            }
            if !o.plainExports.isEmpty {
                Label("Unencrypted exports are lying in recovery-staging. Delete them on the computer:", systemImage: "exclamationmark.lock.fill")
                    .foregroundStyle(.red)
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
                if let size = job.size { Text(size).font(.caption).foregroundStyle(.secondary) }
            }
            if let finished = job.lastFinished {
                Text("Finished \(finished, format: .relative(presentation: .named))").font(.caption).foregroundStyle(.secondary)
            } else {
                Text("Hasn't run yet").font(.caption).foregroundStyle(.secondary)
            }
            if job.state == "failed", let message = job.errorMessage, !message.isEmpty {
                Text(message).font(.caption).foregroundStyle(.red).lineLimit(4)
            }
            if let summary = job.lastRunSummary {
                Text(summary).font(.caption).foregroundStyle(.secondary)
            }
            if !job.sources.isEmpty {
                Text(job.sources.prefix(4).joined(separator: ", ") + (job.sources.count > 4 ? ", …" : ""))
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .textSelection(.enabled)
            }
            if let next = job.nextRun {
                Text("Next \(next, format: .relative(presentation: .named))").font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var stateWords: String {
        switch job.state {
        case "ok": "Backed up"
        case "failed": "Failed"
        case "stale": "Out of date"
        default: "Not run yet"
        }
    }

    private var icon: String {
        switch job.state {
        case "ok": "checkmark.circle.fill"
        case "failed": "xmark.octagon.fill"
        case "stale": "exclamationmark.triangle.fill"
        default: "circle.dashed"
        }
    }

    private var tint: Color {
        switch job.state {
        case "ok": .green
        case "failed": .red
        case "stale": .orange
        default: .secondary
        }
    }
}

private struct CopyRow: View {
    let copy: BackupCopy

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundStyle(tint)
                .accessibilityLabel(stateWords)
            VStack(alignment: .leading, spacing: 2) {
                Text(copy.name)
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
                if copy.shrank {
                    Text("Less than half the night before's \(copy.before, format: .byteCount(style: .file)): check that \(copy.name) still has its data.")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            Spacer(minLength: 0)
            if copy.size > 0 {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(copy.size, format: .byteCount(style: .file))
                    if !copy.shrank, copy.sizeChanged {
                        Text("was \(copy.before, format: .byteCount(style: .file))")
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
        if copy.shrank { return .red }
        return switch copy.state {
        case "fresh": .green
        case "stale": .orange
        default: .secondary
        }
    }
}
