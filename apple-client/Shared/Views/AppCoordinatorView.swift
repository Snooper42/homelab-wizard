import SwiftUI
#if os(macOS)
import AppKit
#endif

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
                DashboardView(liveEvents: coordinator.liveEvents)
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
        .modifier(MacLockTriggers(coordinator: coordinator))
        #endif
    }
}

#if os(macOS)
/// A Mac can be walked away from without the app ever going to the
/// background, so it also locks when the app is hidden, the screen locks,
/// the screens or the Mac sleep, or the user session switches away.
private struct MacLockTriggers: ViewModifier {
    let coordinator: AppCoordinator

    func body(content: Content) -> some View {
        let workspace = NSWorkspace.shared.notificationCenter
        let distributed = DistributedNotificationCenter.default()
        return content
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didHideNotification)) { _ in
                coordinator.lock(promptOnReturn: true)
            }
            .onReceive(workspace.publisher(for: NSWorkspace.willSleepNotification)) { _ in
                coordinator.lock()
            }
            .onReceive(workspace.publisher(for: NSWorkspace.screensDidSleepNotification)) { _ in
                coordinator.lock()
            }
            .onReceive(workspace.publisher(for: NSWorkspace.sessionDidResignActiveNotification)) { _ in
                coordinator.lock()
            }
            .onReceive(distributed.publisher(for: Notification.Name("com.apple.screenIsLocked"))) { _ in
                coordinator.lock()
            }
            .onReceive(distributed.publisher(for: Notification.Name("com.apple.screenIsUnlocked"))) { _ in
                coordinator.rearmAndRequestUnlock()
            }
            .onReceive(workspace.publisher(for: NSWorkspace.screensDidWakeNotification)) { _ in
                coordinator.rearmAndRequestUnlock()
            }
    }
}
#endif
