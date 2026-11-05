import SwiftUI

/// Start, Stop and Restart on a list row. A right-click or long press opens
/// a context menu (Mac, iPad and iPhone). On iPhone, a swipe shows them too.
struct AppActionControls: ViewModifier {
    @Environment(AppActionsViewModel.self) private var actions
    let app: AppStatus

    func body(content: Content) -> some View {
        let available = actions.available(for: app)
        content
            .contextMenu {
                ForEach(available) { action in
                    Button(role: action.needsConfirmation ? .destructive : nil) {
                        actions.request(action, on: app)
                    } label: {
                        Label(action.title, systemImage: action.systemImage)
                    }
                    .disabled(actions.isBusy)
                }
            }
            #if os(iOS)
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                ForEach(available.reversed()) { action in
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
        }
    }
}

/// Everything about actions that sits above the lists: the Stop
/// confirmation, the Undo banner, the Details sheet, and haptics.
struct AppActionsPresenter: ViewModifier {
    @Bindable var actions: AppActionsViewModel

    func body(content: Content) -> some View {
        content
            .confirmationDialog(
                actions.stopCandidate.map { "Stop \($0.name)?" } ?? "Stop?",
                isPresented: stopConfirmation,
                titleVisibility: .visible,
                presenting: actions.stopCandidate
            ) { app in
                Button("Stop \(app.name)", role: .destructive) { actions.confirmStop() }
                Button("Cancel", role: .cancel) { actions.stopCandidate = nil }
            } message: { app in
                Text("\(app.name) stays stopped until you start it again. Anyone using it right now loses it.")
            }
            .sheet(item: $actions.details) { details in
                ActionLogView(details: details)
            }
            .overlay(alignment: .bottom) {
                if let offer = actions.undo {
                    UndoBanner(name: offer.app.name, undo: { actions.performUndo() }, close: { actions.dropUndo() })
                        .padding()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.snappy, value: actions.undo)
            .sensoryFeedback(.success, trigger: actions.successCount)
            .sensoryFeedback(.error, trigger: actions.failureCount)
    }

    private var stopConfirmation: Binding<Bool> {
        Binding(
            get: { actions.stopCandidate != nil },
            set: { if !$0 { actions.stopCandidate = nil } }
        )
    }
}

private struct UndoBanner: View {
    let name: String
    let undo: @MainActor () -> Void
    let close: @MainActor () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "stop.circle.fill")
                .foregroundStyle(.secondary)
            Text("Stopped \(name)")
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
