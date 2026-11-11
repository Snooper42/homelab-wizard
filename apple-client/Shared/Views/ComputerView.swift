import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// The computer app's Setup and Settings screens, with what a phone can
/// reach of them. Setup: what still needs you, and how this machine is
/// doing (its system, Look for problems). Settings, laid out as the
/// system's own: the homelab on top (this device's page behind it), the
/// switches, the homelab's settings a section a row, then help and About.
struct ComputerView: View {
    enum Page {
        case setup, settings
    }

    let computer: ComputerViewModel
    var page: Page = .settings
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(AppActionsViewModel.self) private var actions
    /// The widget, on this device (WidgetSummaryStore).
    @State private var widgetOn = WidgetSummaryStore.isEnabled
    /// Who notifies this device of alerts (AlertNotifications).
    @State private var alertSource = AlertNotifications().source
    @State private var alertSourceProblem: String?

    var body: some View {
        @Bindable var computer = computer
        Form {
            switch page {
            case .setup:
                ScreenLead(text: "What still needs you, and how this machine is doing.")
                hostSection
                fixSection
            case .settings:
                homelabCard
                // What used to be Status's Saved tile, one line here now.
                if let savings = dashboard.yearlySavings {
                    Section {
                        LabeledContent {
                            Text(verbatim: savings.formatted(.currency(code: "USD").precision(.fractionLength(0))) + " a year")
                                .monospacedDigit()
                        } label: {
                            IconTileLabel(title: "Subscriptions you don’t pay", systemImage: "dollarsign.circle", tint: TileColour.green)
                        }
                    }
                }
                switchesSection
                if actions.computerAnswers("AlertLog") {
                    alertsSection
                }
                homelabSettingsSection
                helpSection
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .task {
            await computer.load()
            if page == .settings { await computer.loadForm() }
        }
        .refreshable {
            await computer.load()
            if page == .settings { await computer.loadForm() }
        }
        .sheet(item: $computer.report) { report in
            ReportView(report: report)
        }
        .navigationTitle(page == .setup ? "Setup" : "Settings")
    }

    // MARK: Setup

    @ViewBuilder
    private var hostSection: some View {
        Section("This Machine") {
            if let host = computer.host {
                LabeledContent("System", value: [host.os, host.machine].filter { !$0.isEmpty }.joined(separator: " · "))
                LabeledContent("Containers") {
                    HStack(spacing: 6) {
                        Text(host.runtime.isEmpty ? "Unknown" : host.runtime)
                        Image(systemName: host.runtimeOK ? "checkmark.circle.fill" : "xmark.octagon.fill")
                            .foregroundStyle(host.runtimeOK ? Theme.success : Theme.danger)
                            .accessibilityLabel(host.runtimeOK ? "Running" : "Not answering")
                    }
                }
                if !host.scheduler.isEmpty {
                    LabeledContent("Scheduler", value: host.scheduler)
                }
                LabeledContent("Homelab Wizard", value: host.version)
                if !host.supported {
                    Label("This system isn't one Homelab Wizard supports.", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(Theme.warning)
                }
            } else if let error = computer.hostError {
                Text(error).foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        }
    }

    private var fixSection: some View {
        Section {
            TaskButton(task: .fix)
        } header: {
            Text("Problems")
        } footer: {
            Text("Nothing changes until you tap Fix These.")
        }
    }

    // MARK: Settings

    /// "iPhone", "iPad" or "Mac", for "This iPhone can make changes".
    private var deviceWord: String {
        #if os(iOS)
        UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone"
        #else
        "Mac"
        #endif
    }

    /// The homelab this device is paired with, and what it may do; this
    /// device's own page behind it.
    private var homelabCard: some View {
        Section {
            NavigationLink {
                ThisDevicePage()
            } label: {
                HStack(spacing: 14) {
                    AppMark(size: 56)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Homelab Wizard")
                            .font(.headline)
                        if let server = coordinator.serverName {
                            Text(verbatim: server)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        if let device = coordinator.device {
                            Text(device.canChange ? "This \(deviceWord) can make changes" : "This \(deviceWord) can only look")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(device.canChange ? Theme.success : Theme.secondaryInk)
                        }
                    }
                }
                .padding(.vertical, 6)
            }
        }
    }

    private var widgetName: String {
        #if os(macOS)
        "Desktop widget"
        #else
        "Home Screen widget"
        #endif
    }

    private var lockName: String {
        #if os(macOS)
        "Touch ID lock"
        #else
        "Face ID lock"
        #endif
    }

    /// Nightly updates, the lock, and the widget.
    private var switchesSection: some View {
        Section {
            if let updates = computer.updates {
                Toggle(isOn: Binding(
                    get: { !updates.paused },
                    set: { on in Task { await computer.setNightlyUpdates(on: on) } }
                )) {
                    IconTileLabel(title: "Update apps nightly", systemImage: "arrow.triangle.2.circlepath", tint: TileColour.green,
                                  subtitle: updates.schedule.isEmpty ? nil : updates.schedule.prefix(1).uppercased() + updates.schedule.dropFirst())
                }
                .disabled(!computer.canChange || computer.isSavingUpdates)
                if let error = computer.updatesError {
                    Text(error).font(.callout).foregroundStyle(Theme.danger)
                }
            }
            LabeledContent {
                Text("On")
            } label: {
                IconTileLabel(title: lockName, systemImage: "faceid", tint: TileColour.indigo)
            }
            .accessibilityHint("The app locks when it leaves the screen, and asks again before any change.")
            if WidgetSummaryStore.isAvailable {
                Toggle(isOn: Binding(get: { widgetOn }, set: { on in Task { await setWidget(on) } })) {
                    IconTileLabel(title: widgetName, systemImage: "square.grid.2x2", tint: TileColour.blue)
                }
            }
        } footer: {
            if computer.updates != nil, !computer.canChange {
                Text("This device can only look.")
            } else if computer.updates?.paused == true {
                Text("Apps keep their versions until this is back on.")
            }
        }
    }

    /// Alerts From: the ntfy app, or this app, on this device only.
    private var alertsSection: some View {
        Section {
            Picker(selection: Binding(get: { alertSource }, set: { source in Task { await setAlertSource(source) } })) {
                ForEach(AlertSource.allCases) { source in
                    Text(source.label).tag(source)
                }
            } label: {
                IconTileLabel(title: "Alerts From", systemImage: "bell.badge", tint: TileColour.red)
            }
            if let alertSourceProblem {
                Text(alertSourceProblem).font(.callout).foregroundStyle(Theme.danger)
            }
        } footer: {
            switch alertSource {
            case .ntfy:
                Text("The ntfy app notifies this device of the homelab's alerts. Every Alert, under Recent Alerts, lists them here.")
            case .thisApp:
                Text("This app notifies while it's open. Turn off the ntfy app's notifications on this device so nothing arrives twice. A locked phone hears only from the ntfy app until the paid Apple program.")
            }
        }
    }

    /// This app notifying asks to show notifications first; no means the
    /// ntfy app goes on notifying.
    private func setAlertSource(_ source: AlertSource) async {
        alertSourceProblem = nil
        if source == .thisApp, !(await LocalAlerts.ask()) {
            alertSourceProblem = "Notifications are off for Homelab: turn them on in the Settings app, then pick This App again."
            return
        }
        AlertNotifications().source = source
        alertSource = source
    }

    /// Turning the widget on lets a line show without unlocking, so it asks
    /// the owner first. Turning it off clears the line at once.
    private func setWidget(_ on: Bool) async {
        if on {
            guard await coordinator.authorizeChange(reason: "Show the homelab's health on the widget.") else { return }
            WidgetSummaryStore.isEnabled = true
            WidgetSummaryStore.save(WidgetSummary(needALook: dashboard.attentionCount, at: Date()))
        } else {
            WidgetSummaryStore.isEnabled = false
        }
        widgetOn = WidgetSummaryStore.isEnabled
        WidgetSummaryStore.reloadWidget()
    }

    /// The Settings form, a row a section with its icon, as the computer's
    /// Settings lists its pages (main #491).
    @ViewBuilder
    private var homelabSettingsSection: some View {
        Section {
            if let form = computer.form {
                ForEach(form.sections) { section in
                    let look = Self.look(of: section.name)
                    NavigationLink {
                        SettingsFormView(computer: computer, section: section.name)
                    } label: {
                        IconTileLabel(title: SettingWords.section(section.name), systemImage: look.symbol, tint: look.tint) {
                            Text("\(section.settings.count)")
                        }
                    }
                }
                NavigationLink {
                    SettingsFormView(computer: computer, section: nil)
                } label: {
                    IconTileLabel(title: "Search all settings", systemImage: "magnifyingglass", tint: TileColour.grey)
                }
            } else if computer.formNotServed {
                Text("Update Homelab Wizard on the computer to see its settings here.")
                    .foregroundStyle(.secondary)
            } else if let error = computer.formError {
                Text(error).foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        } header: {
            Text("Homelab Settings")
        } footer: {
            if computer.form != nil, !computer.canChange {
                Text("This device can only look.")
            }
        }
    }

    /// Each section of the computer's Settings, by its name, as an icon on a tile.
    nonisolated static func look(of section: String) -> (symbol: String, tint: Color) {
        let name = section.lowercased()
        if name.hasPrefix("this mac") || name.hasPrefix("this machine") { return ("desktopcomputer", TileColour.grey) }
        if name.hasPrefix("storage") { return ("externaldrive.fill", TileColour.orange) }
        if name.hasPrefix("domain") { return ("globe", TileColour.blue) }
        if name.contains("proxy") || name.contains("crowdsec") { return ("lock.shield.fill", TileColour.green) }
        if name.hasPrefix("adguard") { return ("hand.raised.fill", TileColour.teal) }
        if name.hasPrefix("notification") { return ("bell.fill", TileColour.red) }
        if name.hasPrefix("tidy") { return ("sparkles", TileColour.purple) }
        if name.contains("port") { return ("number", TileColour.indigo) }
        if name.contains("secret") || name.hasPrefix("app settings") { return ("key.fill", TileColour.indigo) }
        return ("gearshape.fill", TileColour.grey)
    }

    /// A diagnostics report, and where the logos come from.
    private var helpSection: some View {
        Section {
            Button {
                Task { await computer.makeReport() }
            } label: {
                IconTileLabel(title: "Send a report", systemImage: "doc.text.fill", tint: TileColour.teal) {
                    if computer.isMakingReport { ProgressView().controlSize(.small) }
                }
            }
            .foregroundStyle(Theme.ink)
            .disabled(computer.isMakingReport)
            if let error = computer.reportError {
                Text(error).font(.callout).foregroundStyle(Theme.danger)
            }
            NavigationLink {
                AboutPage()
            } label: {
                IconTileLabel(title: "About", systemImage: "info", tint: TileColour.grey)
            }
        } footer: {
            Text("Passwords and keys are removed first, and you see it before it's shared.")
        }
    }
}

/// This device: how it's paired, what it may do, and Unpair.
struct ThisDevicePage: View {
    @Environment(AppCoordinator.self) private var coordinator
    @State private var confirmingUnpair = false

    var body: some View {
        Form {
            Section {
                if let device = coordinator.device {
                    LabeledContent("Paired as", value: device.name)
                    LabeledContent("Can", value: device.canChange ? "Look and make changes" : "Only look")
                    if let paired = device.paired {
                        LabeledContent("Paired on") { Text(paired, format: .dateTime.year().month().day()) }
                    }
                    if device.unencrypted {
                        Label("Paired without https: look-only for good.", systemImage: "lock.open.fill")
                            .foregroundStyle(Theme.warning)
                    }
                    LabeledContent("ID") {
                        Text(verbatim: device.id).font(.body.monospaced()).textSelection(.enabled)
                    }
                }
                if let server = coordinator.serverName {
                    LabeledContent("Computer") {
                        Text(verbatim: server).textSelection(.enabled)
                    }
                }
            } footer: {
                Text("Lost it? Remove it on the computer, in Settings › Phones.")
            }
            Section {
                Button("Unpair This Device…", role: .destructive) { confirmingUnpair = true }
                    .confirmationDialog("Unpair this device?", isPresented: $confirmingUnpair, titleVisibility: .visible) {
                        Button("Unpair", role: .destructive) { coordinator.unpair() }
                    } message: {
                        Text("It forgets the homelab. Remove it on the computer too, in Settings › Phones.")
                    }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle("This Device")
    }
}

/// Where the apps' and payees' logos come from (licenses/THIRD-PARTY.md).
private struct AboutPage: View {
    var body: some View {
        Form {
            Section {
                VStack(spacing: 8) {
                    AppMark(size: 72)
                    Text("Homelab Wizard").font(.title3.weight(.semibold))
                    Text("Your apps, at home").font(.subheadline).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }
            Section("Logos") {
                Text("App logos from dashboard-icons by homarr-labs, under the Apache License 2.0. Payee logos from simple-icons, under CC0. Product names and logos belong to their owners, and are here only to tell the apps and payees apart.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle("About")
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
                Text(error).font(.callout).foregroundStyle(Theme.danger)
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
                            .foregroundStyle(Theme.danger)
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
