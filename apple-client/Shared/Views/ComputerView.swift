import SwiftUI

/// The computer: what it runs, the nightly updates, Look for problems,
/// and a diagnostics report for whoever helps.
struct ComputerView: View {
    let computer: ComputerViewModel
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        @Bindable var computer = computer
        Form {
            hostSection
            updatesSection
            fixSection
            reportSection
            deviceSection
        }
        .formStyle(.grouped)
        .task { await computer.load() }
        .refreshable { await computer.load() }
        .sheet(item: $computer.report) { report in
            ReportView(report: report)
        }
        .navigationTitle("Computer")
    }

    // MARK: Sections

    @ViewBuilder
    private var hostSection: some View {
        Section("This Computer") {
            if let host = computer.host {
                LabeledContent("System", value: [host.os, host.machine].filter { !$0.isEmpty }.joined(separator: " · "))
                LabeledContent("Containers") {
                    HStack(spacing: 6) {
                        Text(host.runtime.isEmpty ? "Unknown" : host.runtime)
                        Image(systemName: host.runtimeOK ? "checkmark.circle.fill" : "xmark.octagon.fill")
                            .foregroundStyle(host.runtimeOK ? .green : .red)
                            .accessibilityLabel(host.runtimeOK ? "Running" : "Not answering")
                    }
                }
                if !host.scheduler.isEmpty {
                    LabeledContent("Scheduler", value: host.scheduler)
                }
                LabeledContent("Homelab Wizard", value: host.version)
                if !host.supported {
                    Label("This system isn't one Homelab Wizard supports.", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            } else if let error = computer.hostError {
                Text(error).foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        }
    }

    @ViewBuilder
    private var updatesSection: some View {
        if let updates = computer.updates {
            Section {
                Toggle(isOn: Binding(
                    get: { !updates.paused },
                    set: { on in Task { await computer.setNightlyUpdates(on: on) } }
                )) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Update apps nightly")
                        if !updates.schedule.isEmpty {
                            Text(updates.schedule.prefix(1).uppercased() + updates.schedule.dropFirst())
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .disabled(!computer.canChange || computer.isSavingUpdates)
                if let error = computer.updatesError {
                    Text(error).font(.callout).foregroundStyle(.red)
                }
            } header: {
                Text("Updates")
            } footer: {
                if !computer.canChange {
                    Text("This device can only look.")
                } else if updates.paused {
                    Text("Paused: apps keep the versions they run now until you turn this back on.")
                }
            }
        }
    }

    private var fixSection: some View {
        Section {
            TaskButton(task: .fix)
        } header: {
            Text("Problems")
        } footer: {
            Text("This only looks, and shows what it would do. Nothing changes until you tap Fix These.")
        }
    }

    private var reportSection: some View {
        Section {
            Button {
                Task { await computer.makeReport() }
            } label: {
                HStack {
                    Label("Make a Diagnostics Report", systemImage: "doc.text.below.ecg")
                    if computer.isMakingReport {
                        Spacer()
                        ProgressView().controlSize(.small)
                    }
                }
            }
            .disabled(computer.isMakingReport)
            if let error = computer.reportError {
                Text(error).font(.callout).foregroundStyle(.red)
            }
        } header: {
            Text("Help")
        } footer: {
            Text("The computer removes every password, token and key first. You see the report before you share it.")
        }
    }

    private var deviceSection: some View {
        Section("This Device") {
            if let device = coordinator.device {
                LabeledContent("Paired as", value: device.name)
                LabeledContent("Can", value: device.canChange ? "Look and make changes" : "Only look")
                LabeledContent("ID") {
                    Text(verbatim: device.id).font(.body.monospaced()).textSelection(.enabled)
                }
            }
            if let server = coordinator.serverName {
                LabeledContent("Computer") {
                    Text(verbatim: server).textSelection(.enabled)
                }
            }
        }
    }
}

/// A button that runs a whole-homelab job, with its progress and its error.
struct TaskButton: View {
    @Environment(HomelabTasksViewModel.self) private var tasks
    let task: HomelabTask

    var body: some View {
        if tasks.canRun {
            Button {
                tasks.start(task)
            } label: {
                HStack {
                    Label(task.title, systemImage: task.systemImage)
                    if tasks.running == task {
                        Spacer()
                        ProgressView().controlSize(.small)
                        Text(task.progressTitle).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .disabled(tasks.running != nil)
            if let error = tasks.errors[task] {
                Text(error).font(.callout).foregroundStyle(.red)
            }
        } else {
            Label(task.title, systemImage: task.systemImage)
                .foregroundStyle(.secondary)
            Text("This device can only look.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// What a job printed. For a fix plan, it also offers Fix These.
struct TaskOutputView: View {
    let output: HomelabTasksViewModel.Output
    @Environment(HomelabTasksViewModel.self) private var tasks
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if output.failed {
                        Label("It didn't work", systemImage: "xmark.octagon.fill")
                            .foregroundStyle(.red)
                            .font(.headline)
                    }
                    Text(verbatim: output.lines.joined(separator: "\n"))
                        .font(.system(.footnote, design: .monospaced))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .privacySensitive()
                }
                .padding()
            }
            .safeAreaInset(edge: .bottom) {
                if output.isFixPreview {
                    VStack(spacing: 6) {
                        Button(role: .destructive) {
                            tasks.start(.fix, apply: true)
                        } label: {
                            Text("Fix These").fontWeight(.semibold).frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .disabled(tasks.running != nil)
                        Text("Nothing has changed yet.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(.bar)
                }
            }
            .navigationTitle(output.title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 560, minHeight: 400)
        #endif
    }
}

/// The diagnostics report, shown in full before it's shared.
struct ReportView: View {
    let report: DiagnosticsReport
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(verbatim: report.text)
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .safeAreaInset(edge: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Secrets are removed. Read it through before you share it.", systemImage: "eye")
                    if let helper = report.helper, !helper.isEmpty {
                        Text("Your helper: \(helper)").foregroundStyle(.secondary)
                    }
                }
                .font(.callout)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(.bar)
            }
            .navigationTitle("Diagnostics Report")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: report.text, subject: Text("Homelab diagnostics report"), message: Text("Here's my homelab's diagnostics report.")) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 640, minHeight: 480)
        #endif
    }
}
