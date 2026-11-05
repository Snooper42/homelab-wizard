import SwiftUI

/// The app's entry point. Replace the `@main` App file that Xcode's
/// Multiplatform template creates with this one.
@main
struct HomelabClientApp: App {
    @State private var coordinator = AppCoordinator()

    var body: some Scene {
        WindowGroup {
            AppCoordinatorView()
                .environment(coordinator)
        }
        #if os(macOS)
        .defaultSize(width: 1040, height: 700)
        .windowToolbarStyle(.unified)
        #endif
        .commands {
            HomelabCommands(coordinator: coordinator)
        }
    }
}

/// The Homelab menu on the Mac. On iPad, it appears in the hardware
/// keyboard's shortcut list.
struct HomelabCommands: Commands {
    let coordinator: AppCoordinator

    var body: some Commands {
        CommandMenu("Homelab") {
            Button("Refresh") {
                Task { await coordinator.liveEvents.refreshNow() }
            }
            .keyboardShortcut("r")
            .disabled(coordinator.route != .unlocked)

            Divider()

            Button("Lock Now") {
                coordinator.lock()
            }
            .keyboardShortcut("l")
            .disabled(coordinator.route != .unlocked)
        }
    }
}
