import SwiftUI

/// Shown whenever the app is paired but locked. Nothing about the homelab
/// is in memory while this is on screen (see `AppCoordinator.lock`).
struct LockScreenView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        VStack(spacing: 28) {
            AppMark(size: 84, badge: "lock.fill")

            VStack(spacing: 8) {
                Text("Homelab Is Locked")
                    .font(.title2.weight(.bold))
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
        }
        .padding(32)
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
