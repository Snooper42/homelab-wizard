import SwiftUI

struct AppDetailView: View {
    /// Nil when the app left the status (uninstalled meanwhile).
    let app: AppStatus?

    var body: some View {
        if let app {
            Form {
                Section {
                    HStack(spacing: 14) {
                        AppStateIcon(app: app)
                            .font(.system(size: 40))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(app.name)
                                .font(.title2.bold())
                            Text(app.detailLine)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                if let problem = app.notAnswering, !problem.isEmpty {
                    Section("Problem") {
                        Label("The container runs, but the app doesn't answer: \(problem)", systemImage: "bolt.horizontal.circle")
                            .foregroundStyle(.orange)
                    }
                }

                Section("Details") {
                    LabeledContent("State", value: app.stateLabel)
                    if let health = app.health, !health.isEmpty {
                        LabeledContent("Health", value: health.capitalized)
                    }
                    if app.isRunning, let started = app.startedAt {
                        LabeledContent("Started") {
                            Text(started, format: .relative(presentation: .named))
                        }
                    }
                    if let restarts = app.restarts, restarts > 0 {
                        LabeledContent("Restarts", value: restarts.formatted())
                    }
                    if let container = app.container, !container.isEmpty {
                        LabeledContent("Container") {
                            Text(container).textSelection(.enabled)
                        }
                    }
                    if let drive = app.waitingFor, !drive.isEmpty {
                        LabeledContent("Waiting for drive", value: drive)
                    }
                }

                if app.address != nil || app.url != nil {
                    Section("Addresses") {
                        if let address = app.address, let url = Self.httpsURL(address) {
                            Link(destination: url) {
                                LabeledContent("Homelab domain", value: address)
                            }
                        }
                        if let local = app.url, !local.isEmpty {
                            LabeledContent("On the computer") {
                                Text(local).textSelection(.enabled)
                            }
                        }
                    }
                }

                if app.settingsChanged == true || app.held == true || app.quiet == true {
                    Section("Notes") {
                        if app.settingsChanged == true {
                            Label("Settings changed. It keeps the old ones until it's recreated.", systemImage: "gearshape.arrow.triangle.2.circlepath")
                        }
                        if app.held == true {
                            Label("Updates are held after a rollback.", systemImage: "pause.circle")
                        }
                        if app.quiet == true {
                            Label("Watchdog alerts are muted.", systemImage: "bell.slash")
                        }
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(app.name)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
        } else {
            ContentUnavailableView("App Not Found", systemImage: "questionmark.app", description: Text("It's no longer in the status."))
        }
    }

    /// Only https links open. The address may come without a scheme.
    private static func httpsURL(_ address: String) -> URL? {
        let text = address.contains("://") ? address : "https://" + address
        guard let url = URL(string: text), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }
}
