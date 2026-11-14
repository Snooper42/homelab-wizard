import SwiftUI

/// Shown whenever the app is paired but locked. Nothing about the homelab
/// is in memory while this is on screen (see `AppCoordinator.lock`).
struct LockScreenView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 40)
            // The app's icon, white with its violet rack, and a lock on it.
            AppMark(size: 112, badge: "lock.fill")

            VStack(spacing: 8) {
                Text("Homelab Is Locked")
                    .font(.title.weight(.bold))
                Text("Your servers stay hidden until you unlock.")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Spacer(minLength: 40)

            if let error = coordinator.unlockError {
                Label {
                    Text(verbatim: error)
                } icon: {
                    Image(systemName: "exclamationmark.circle.fill")
                }
                .font(.callout)
                .foregroundStyle(Theme.danger)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.danger.opacity(0.1), in: RoundedRectangle(cornerRadius: Theme.radius, style: .continuous))
                .frame(maxWidth: 380)
            }

            Button {
                Task { await coordinator.unlock() }
            } label: {
                Label(coordinator.unlockMethod.unlockLabel, systemImage: coordinator.unlockMethod.systemImage)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: 420)
                    .frame(height: 54)
                    .background(Theme.accentFill, in: Capsule())
                    .shadow(color: Theme.accent.opacity(0.32), radius: 12, y: 8)
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(coordinator.isAuthenticating)
            .keyboardShortcut(.defaultAction)
            .padding(.bottom, 12)
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { HeroBackground() }
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
            HeroBackground()
            AppMark(size: 72)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}
