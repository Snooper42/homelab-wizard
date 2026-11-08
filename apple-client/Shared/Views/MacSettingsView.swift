#if os(macOS)
import SwiftUI

/// Homelab › Settings… (⌘,) on the Mac. It holds only how long the app may
/// sit behind other apps before it locks: nothing about the homelab, so it
/// opens the same whether the app is locked or not.
struct MacSettingsView: View {
    @AppStorage(BackgroundLock.key) private var minutes = BackgroundLock.defaultMinutes

    var body: some View {
        Form {
            Picker("Lock when behind other apps for", selection: $minutes) {
                ForEach(BackgroundLock.choices, id: \.self) { choice in
                    Text(choice == 1 ? "1 minute" : "\(choice) minutes").tag(choice)
                }
            }
            .pickerStyle(.menu)

            Section {
                Text("It also locks at once when it's hidden, when its window closes, when the screen locks or the Mac sleeps, and when you switch users. Changes ask for Touch ID or your password again after two minutes.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .formStyle(.grouped)
        .frame(width: 440)
        .padding(.vertical, 8)
    }
}
#endif
