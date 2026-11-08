import SwiftUI

/// The app's window ids, apart from the @main file so the Swift package
/// (which leaves that file out) builds too.
enum AppWindows {
    static let main = "main"
}

/// What the App menu acts on: the app selected in the window in front,
/// with that window's actions. Set by the dashboard's detail pane.
struct SelectedAppFocus {
    let app: AppStatus
    let actions: AppActionsViewModel
    let showLogs: @MainActor () -> Void
}

/// Picks a screen in the window in front (Mac and iPad): set by the dashboard.
struct ScreenChoice {
    let canSeeFinances: Bool
    let pick: @MainActor (DashboardViewModel.SidebarItem) -> Void
}

extension FocusedValues {
    @Entry var selectedApp: SelectedAppFocus?
    @Entry var screenChoice: ScreenChoice?
}

/// ⌘2 to ⌘6 pick a screen, the same numbers as on the computer (Choose apps
/// is its ⌘1 and Tidy Up its ⌘7, there only). In the View menu, as there.
struct ScreenCommands: Commands {
    @FocusedValue(\.screenChoice) private var choice

    var body: some Commands {
        CommandGroup(after: .sidebar) {
            Divider()
            button(.status(.all))
            button(.backups)
            button(.setup)
            button(.settings)
            button(.finances)
                .disabled(!(choice?.canSeeFinances ?? false))
            Divider()
        }
    }

    private func button(_ screen: DashboardViewModel.SidebarItem) -> some View {
        Button(screen.title) { choice?.pick(screen) }
            .keyboardShortcut(KeyEquivalent(screen.shortcut))
            .disabled(choice == nil)
    }
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
