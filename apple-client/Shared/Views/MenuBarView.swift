#if os(macOS)
import AppKit
import SwiftUI

/// The menu bar item (Mac): the homelab at a glance, Open, and Lock Now.
///
/// It shows only what the unlocked app already holds. While the app is
/// locked, which also happens whenever its window closes, it shows
/// nothing about the homelab: locking drops every reading from memory.
struct MenuBarView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        if coordinator.route == .unlocked, let status = coordinator.liveEvents.status {
            let attention = status.apps.filter(\.needsAttention)
            Text("\(status.apps.filter(\.isRunning).count) running")
            if attention.isEmpty {
                Text("All well")
            } else {
                Section("Needs a look") {
                    ForEach(attention.prefix(6)) { app in
                        Button {
                            // Opens on this app's page.
                            coordinator.requestedAppID = app.id
                            open()
                        } label: {
                            Text(verbatim: "\(app.name): \(app.detailLine)")
                        }
                    }
                }
            }
            Text(coordinator.liveEvents.connection.label)
            Divider()
            Button("Open Homelab") { open() }
            Button("Lock Now") { coordinator.lock() }
                .keyboardShortcut("l")
        } else {
            Text(coordinator.route == .pairing ? "Not paired" : "Homelab is locked")
            Divider()
            Button("Open Homelab") { open() }
        }
        Divider()
        Button("Quit Homelab") { NSApplication.shared.terminate(nil) }
            .keyboardShortcut("q")
    }

    private func open() {
        openWindow(id: AppWindows.main)
        NSApplication.shared.activate()
    }
}

/// The menu bar icon: a warning while unlocked with something to look at.
struct MenuBarIcon: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        let attention = coordinator.route == .unlocked
            && (coordinator.liveEvents.status?.apps.contains(where: \.needsAttention) ?? false)
        Image(systemName: attention ? "exclamationmark.triangle.fill" : "server.rack")
            .accessibilityLabel(attention ? "Homelab: something needs a look" : "Homelab")
    }
}
#endif
