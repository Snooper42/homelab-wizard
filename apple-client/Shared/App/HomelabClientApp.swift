import SwiftUI

/// The app's entry point. Replace the `@main` App file that Xcode's
/// Multiplatform template creates with this one.
@main
struct HomelabClientApp: App {
    #if SCREENSHOTS
    // The screenshots build: the sample homelab (Shared/Screenshots).
    @State private var coordinator = AppCoordinator(keychain: ScreenshotCredentials(), biometrics: ScreenshotOwner(),
                                                    protocolClasses: [ScreenshotURLProtocol.self])
    #else
    @State private var coordinator = AppCoordinator()
    #endif

    var body: some Scene {
        WindowGroup(id: AppWindows.main) {
            AppCoordinatorView()
                .environment(coordinator)
        }
        .commands {
            HomelabCommands(coordinator: coordinator)
            AppMenuCommands()
            ScreenCommands()
        }
    }
}

/// The Homelab menu: on iPad, it appears in the hardware keyboard's
/// shortcut list.
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
