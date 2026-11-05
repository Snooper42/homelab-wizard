import SwiftUI

/// What the App menu acts on: the app selected in the window in front,
/// with that window's actions. Set by the dashboard's detail pane.
struct SelectedAppFocus {
    let app: AppStatus
    let actions: AppActionsViewModel
    let showLogs: @MainActor () -> Void
}

extension FocusedValues {
    @Entry var selectedApp: SelectedAppFocus?
}

/// The App menu (Mac, and iPad with a keyboard): the selected app's
/// actions with shortcuts. Each goes through the same path as its button:
/// Stop is confirmed, and every change authenticates.
struct AppMenuCommands: Commands {
    @FocusedValue(\.selectedApp) private var selected

    var body: some Commands {
        CommandMenu("App") {
            let available = selected.map { $0.actions.available(for: $0.app) } ?? []
            let busy = selected?.actions.isBusy ?? true

            Button("Start") { run(.start) }
                .keyboardShortcut("s", modifiers: [.command, .option])
                .disabled(busy || !available.contains(.start))
            Button("Restart") { run(.restart) }
                .keyboardShortcut("r", modifiers: [.command, .option])
                .disabled(busy || !available.contains(.restart))
            Button("Stop…") { run(.stop) }
                .keyboardShortcut(".", modifiers: [.command, .option])
                .disabled(busy || !available.contains(.stop))
            Divider()
            Button("Roll Back…") { run(.rollback) }
                .disabled(busy || !available.contains(.rollback))
            Divider()
            Button("Show Logs") { selected?.showLogs() }
                .keyboardShortcut("l", modifiers: [.command, .option])
                .disabled(!(selected?.app.hasLogs ?? false))
        }
    }

    private func run(_ action: AppAction) {
        guard let selected else { return }
        selected.actions.request(action, on: selected.app)
    }
}
