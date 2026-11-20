import SwiftUI

/// What an update brings, before it goes ahead (the owner's yes, Nov 20, on
/// the canvas's *Idea: Update an app, notes first*), as the computer's Update
/// shows them first: one line on what it brings, the newest five releases
/// with the start of each one's notes and a link to the rest, then Update
/// after Face ID. Update stays available while they load or when none are known.
struct UpdateNotesSheet: View {
    let app: AppStatus
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var preview: ReleasePreview?
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let preview {
                        Text(verbatim: preview.summary(name: app.name))
                    } else if let problem {
                        Text(verbatim: "Its release notes couldn't be read (\(problem)). Updating still works.")
                            .foregroundStyle(Theme.secondaryInk)
                    } else {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Reading what's new…").foregroundStyle(Theme.secondaryInk)
                        }
                    }
                }
                if let preview {
                    ForEach(preview.shown) { release in
                        Section {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(verbatim: release.title).font(.headline).foregroundStyle(Theme.ink)
                                    Spacer(minLength: 8)
                                    if let day = release.day {
                                        Text(verbatim: day).font(.footnote).foregroundStyle(Theme.secondaryInk)
                                    }
                                }
                                if let notes = release.notes, !notes.isEmpty {
                                    Text(verbatim: notes)
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.ink)
                                        .lineLimit(12)
                                }
                            }
                            .accessibilityElement(children: .combine)
                            if let link = release.url.flatMap({ URL(string: $0) }), link.scheme == "https" {
                                Button("Full Notes") { openURL(link) }
                            }
                        }
                    }
                    if preview.more > 0, let page = preview.page.flatMap({ URL(string: $0) }), page.scheme == "https" {
                        Section {
                            Button(preview.more == 1 ? "And 1 Older One: All Releases" : "And \(preview.more) Older Ones: All Releases") { openURL(page) }
                        }
                    }
                }
                Section {
                    Button {
                        Task {
                            await actions.update(app)
                            dismiss()
                        }
                    } label: {
                        Text("Update").frame(maxWidth: .infinity).fontWeight(.semibold)
                    }
                    .disabled(actions.isBusy || !actions.canUpdate(app))
                } footer: {
                    Text("Face ID first. The version it runs now is kept for a week, so Roll Back on its page puts it back if something's off.")
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
            .navigationTitle("Update \(app.name)")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task {
                do {
                    preview = try await actions.releaseNotes(for: app)
                } catch {
                    problem = APIError.from(error).errorDescription ?? "the computer didn't answer"
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 440, minHeight: 480)
        #endif
    }
}
