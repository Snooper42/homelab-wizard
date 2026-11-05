import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Puts text on the clipboard, on either platform.
enum Clipboard {
    @MainActor static func copy(_ text: String) {
        #if canImport(UIKit)
        UIPasteboard.general.string = text
        #elseif canImport(AppKit)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        #endif
    }
}

/// Start, Stop and Restart on a list row. A right-click or long press opens
/// a context menu (Mac, iPad and iPhone). On iPhone, a swipe shows them too.
struct AppActionControls: ViewModifier {
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(DashboardViewModel.self) private var dashboard
    @Environment(\.openURL) private var openURL
    let app: AppStatus

    func body(content: Content) -> some View {
        let available = actions.available(for: app)
        content
            .contextMenu {
                // As the computer's row menu: Open while it runs, and Copy Address.
                if let address = app.address, let url = AppDetailView.httpsURL(address) {
                    if app.isRunning {
                        Button {
                            openURL(url)
                        } label: {
                            Label("Open", systemImage: "safari")
                        }
                    }
                    Button {
                        Clipboard.copy(url.absoluteString)
                    } label: {
                        Label("Copy Address", systemImage: "doc.on.doc")
                    }
                    Divider()
                }
                ForEach(available) { action in
                    Button(role: action.needsConfirmation ? .destructive : nil) {
                        actions.request(action, on: app)
                    } label: {
                        Label(action.title, systemImage: action.systemImage)
                    }
                    .disabled(actions.isBusy)
                }
                if available.contains(.stop) {
                    StopForAWhileMenu(app: app)
                }
                if actions.canChange {
                    Divider()
                    let pinned = actions.value(of: .pinned, for: app)
                    Button {
                        Task { await actions.set(.pinned, on: !pinned, for: app) }
                    } label: {
                        Label(pinned ? "Unpin" : "Pin to the Top", systemImage: pinned ? "pin.slash" : "pin")
                    }
                    .disabled(actions.isBusy)
                }
                if app.hasLogs {
                    Divider()
                    Button {
                        dashboard.logsApp = app
                    } label: {
                        Label("Logs", systemImage: "doc.text")
                    }
                }
            }
            // VoiceOver: the same actions in the Actions rotor, no swipe or long press needed.
            .accessibilityActions {
                if !actions.isBusy {
                    ForEach(available) { action in
                        Button(action.needsConfirmation ? "\(action.title)…" : action.title) {
                            actions.request(action, on: app)
                        }
                    }
                }
                if app.hasLogs {
                    Button("Logs") { dashboard.logsApp = app }
                }
            }
            #if os(iOS)
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                ForEach(available.filter(\.isEveryday).reversed()) { action in
                    Button {
                        actions.request(action, on: app)
                    } label: {
                        Label(action.title, systemImage: action.systemImage)
                    }
                    .tint(action.tint)
                    .disabled(actions.isBusy)
                }
            }
            #endif
    }
}

extension View {
    func appActionControls(for app: AppStatus) -> some View {
        modifier(AppActionControls(app: app))
    }
}

extension AppAction {
    var tint: Color {
        switch self {
        case .start: .green
        case .stop: .red
        case .restart: .blue
        case .rollback: .orange
        }
    }
}

/// Stop for a while, as a submenu of times.
struct StopForAWhileMenu: View {
    @Environment(AppActionsViewModel.self) private var actions
    let app: AppStatus

    var body: some View {
        Menu {
            // Worked out when the menu opens, so "tonight" is still right.
            ForEach(StopChoice.choices()) { choice in
                Button(choice.label) { actions.stop(app, until: choice) }
            }
        } label: {
            Label("Stop for a While", systemImage: "timer")
        }
        .disabled(actions.isBusy)
    }
}

/// Everything about actions that sits above the lists: the Stop
/// confirmation, the Undo banner, the Details sheet, and haptics.
struct AppActionsPresenter: ViewModifier {
    @Bindable var actions: AppActionsViewModel

    func body(content: Content) -> some View {
        content
            .confirmationDialog(
                actions.confirmation?.title ?? "",
                isPresented: confirming,
                titleVisibility: .visible,
                presenting: actions.confirmation
            ) { pending in
                Button(pending.button, role: .destructive) { actions.confirm() }
                Button("Cancel", role: .cancel) { actions.confirmation = nil }
            } message: { pending in
                Text(pending.message)
            }
            .sheet(item: $actions.details) { details in
                ActionLogView(details: details)
            }
            .overlay(alignment: .bottom) {
                if let offer = actions.undo {
                    UndoBanner(text: offer.bannerText, undo: { actions.performUndo() }, close: { actions.dropUndo() })
                        .padding()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.snappy, value: actions.undo)
            .sensoryFeedback(.success, trigger: actions.successCount)
            .sensoryFeedback(.error, trigger: actions.failureCount)
    }

    private var confirming: Binding<Bool> {
        Binding(
            get: { actions.confirmation != nil },
            set: { if !$0 { actions.confirmation = nil } }
        )
    }
}

private extension AppActionsViewModel.UndoOffer {
    var bannerText: String {
        let what = apps.count == 1 ? apps[0].name : "\(apps.count) apps"
        guard let until else { return "Stopped \(what)" }
        return "Stopped \(what) \(until.label.lowercased())"
    }
}

/// Start, restart or stop all the apps in a list at once, as the
/// computer's group menu does.
struct GroupActionsMenu: View {
    @Environment(AppActionsViewModel.self) private var actions
    let apps: [AppStatus]

    var body: some View {
        let start = AppAction.groupTargets(.start, in: apps)
        let running = AppAction.groupTargets(.restart, in: apps)
        if actions.canChange, !start.isEmpty || !running.isEmpty {
            Menu {
                if !start.isEmpty {
                    Button { actions.requestGroup(.start, on: start) } label: {
                        Label(start.count == 1 ? "Start \(start[0].name)" : AppAction.start.groupTitle(count: start.count), systemImage: AppAction.start.systemImage)
                    }
                }
                if !running.isEmpty {
                    Button { actions.requestGroup(.restart, on: running) } label: {
                        Label(running.count == 1 ? "Restart \(running[0].name)" : AppAction.restart.groupTitle(count: running.count), systemImage: AppAction.restart.systemImage)
                    }
                    Button(role: .destructive) { actions.requestGroup(.stop, on: running) } label: {
                        Label(running.count == 1 ? "Stop \(running[0].name)" : AppAction.stop.groupTitle(count: running.count), systemImage: AppAction.stop.systemImage)
                    }
                    Menu {
                        ForEach(StopChoice.choices()) { choice in
                            Button(choice.label) { actions.requestGroup(.stop, on: running, until: choice) }
                        }
                    } label: {
                        Label("Stop for a While", systemImage: "timer")
                    }
                }
            } label: {
                if let group = actions.group {
                    Text(group.label).font(.caption.monospacedDigit())
                } else {
                    Label("All of These", systemImage: "ellipsis.circle")
                }
            }
            .disabled(actions.isBusy)
            .accessibilityLabel(actions.group?.label ?? "Start, restart or stop them all")
        }
    }
}

private struct UndoBanner: View {
    let text: String
    let undo: @MainActor () -> Void
    let close: @MainActor () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "stop.circle.fill")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text(text)
                .lineLimit(1)
            Spacer(minLength: 8)
            Button("Undo") { undo() }
                .fontWeight(.semibold)
                .keyboardShortcut("z", modifiers: .command)
            Button {
                close()
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Dismiss")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: 440)
        .background(.regularMaterial, in: Capsule())
        .shadow(radius: 8, y: 2)
        .accessibilityElement(children: .contain)
    }
}

/// What the command printed, for a failure's Details.
struct ActionLogView: View {
    let details: AppActionsViewModel.Details
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(details.lines.joined(separator: "\n"))
                    .font(.system(.footnote, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .navigationTitle(details.title)
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
        .frame(minWidth: 560, minHeight: 380)
        #endif
    }
}

/// The pending state under an app's name: "Restarting…", or why it failed.
struct PendingActionLine: View {
    @Environment(AppActionsViewModel.self) private var actions
    let app: AppStatus
    let pending: AppActionsViewModel.Pending

    var body: some View {
        if let failure = pending.failure {
            HStack(spacing: 6) {
                Label("Couldn't \(pending.action.title.lowercased()): \(failure)", systemImage: "xmark.octagon.fill")
                    .foregroundStyle(.red)
                    .lineLimit(2)
                if !pending.log.isEmpty {
                    Button("Details") { actions.showDetails(for: app) }
                        .buttonStyle(.borderless)
                }
            }
        } else {
            HStack(spacing: 6) {
                ProgressView().controlSize(.mini)
                Text(pending.action.progressTitle)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
