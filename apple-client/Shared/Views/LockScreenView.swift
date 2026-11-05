import SwiftUI

/// Shown whenever the app is paired but locked. Nothing about the homelab
/// is in memory while this is on screen (see `AppCoordinator.lock`).
struct LockScreenView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "lock.shield.fill")
                .accessibilityHidden(true)
                .font(.system(size: 64))
                .foregroundStyle(.tint)
                .symbolRenderingMode(.hierarchical)

            VStack(spacing: 6) {
                Text("Homelab Is Locked")
                    .font(.title2.bold())
                Text("Your servers stay hidden until you unlock.")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task { await coordinator.unlock() }
            } label: {
                Label(coordinator.unlockMethod.unlockLabel, systemImage: coordinator.unlockMethod.systemImage)
                    .frame(minWidth: 220)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(coordinator.isAuthenticating)
            .keyboardShortcut(.defaultAction)

            if let error = coordinator.unlockError {
                Text(error)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 360)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task { coordinator.requestAutoUnlock() }
        .sensoryFeedback(trigger: coordinator.unlockError) { _, new in
            new == nil ? nil : .error
        }
    }
}

/// Covers the app while it isn't in front (iOS), so the app switcher's
/// snapshot shows nothing. It's opaque on purpose: a blur still shows layout.
struct PrivacyShieldView: View {
    var body: some View {
        ZStack {
            Rectangle().fill(.background)
            Image(systemName: "server.rack")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}
