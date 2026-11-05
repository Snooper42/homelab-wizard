import SwiftUI

/// The root view. It shows exactly one of pairing, locked or the dashboard,
/// following `AppCoordinator.route`, and passes on lifecycle signals.
struct AppCoordinatorView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            switch coordinator.route {
            case .launching:
                ProgressView()
            case .pairing:
                PairingView(api: coordinator.api, notice: coordinator.pairingNotice) { device in
                    coordinator.didPair(device)
                }
                .transition(.opacity)
            case .locked:
                LockScreenView()
                    .transition(.opacity)
            case .unlocked:
                DashboardView(coordinator: coordinator)
                    .transition(.opacity)
            }
        }
        .animation(.default, value: coordinator.route)
        #if os(iOS)
        // The app switcher takes its snapshot after the scene goes
        // inactive, so cover everything before that happens.
        .overlay {
            if scenePhase != .active {
                PrivacyShieldView()
            }
        }
        #endif
        .task { coordinator.bootstrap() }
        .onChange(of: scenePhase, initial: true) { _, phase in
            coordinator.scenePhaseChanged(to: phase)
        }
        #if os(macOS)
        // Closing the window locks: the menu bar item stays, but shows
        // nothing about the homelab until the next unlock.
        .onDisappear { coordinator.lock(promptOnReturn: true) }
        #endif
    }
}
