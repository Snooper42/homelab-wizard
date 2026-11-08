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
        #if os(macOS)
        .defaultSize(width: 1040, height: 700)
        .windowToolbarStyle(.unified)
        #endif
        .commands {
            HomelabCommands(coordinator: coordinator)
            AppMenuCommands()
            ScreenCommands()
        }

        #if os(macOS)
        MenuBarExtra {
            MenuBarView()
                .environment(coordinator)
                .tint(Theme.accent)
        } label: {
            MenuBarIcon()
                .environment(coordinator)
        }
        .menuBarExtraStyle(.menu)

        Settings {
            MacSettingsView()
                .tint(Theme.accent)
        }
        #endif
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
