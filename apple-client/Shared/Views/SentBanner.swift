import SwiftUI

/// A page the computer sent this phone (Send to my phone): what it is,
/// Open, and a close button, over the bottom of the dashboard. Open goes
/// where a `homelab://` link goes (IntentInbox), so it changes nothing.
struct SentBanner: View {
    let page: SentPage
    let open: () -> Void
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "desktopcomputer")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text(verbatim: page.words)
                .font(.subheadline)
                .lineLimit(2)
            Spacer(minLength: 8)
            Button("Open", action: open)
                .buttonStyle(.borderedProminent)
                .tint(Theme.accentFill)
            Button(action: dismiss) {
                Image(systemName: "xmark")
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Close")
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Theme.radius))
        .shadow(color: Design.shadow.opacity(0.12), radius: 10, y: 4)
        .padding(.horizontal, 16)
        #if os(iOS)
        .padding(.bottom, 56) // above the tab bar
        #else
        .padding(.bottom, 16)
        #endif
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
