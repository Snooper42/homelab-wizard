import SwiftUI

/// An app's page › Who Uses It (the owner's yes, Nov 20, on the canvas's
/// *Idea: Who uses it*), as the computer's page: the household members who
/// sign in to it, by name, with where to add someone. Nothing for an app
/// people don't sign in to, or when the computer doesn't say (over plain
/// Wi-Fi it sends none).
struct WhoUsesItSection: View {
    let app: AppStatus
    @Environment(AppActionsViewModel.self) private var actions
    @State private var read: AppPeople?
    @State private var failed = false

    var body: some View {
        Group {
            if let read {
                if read.household {
                    Section {
                        if read.people.isEmpty {
                            Text("No one in the household uses it yet.").foregroundStyle(.secondary)
                        }
                        ForEach(Array(read.people.enumerated()), id: \.offset) { _, person in
                            HStack(spacing: 12) {
                                Text(verbatim: person.initial)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 30, height: 30)
                                    .background(Theme.accent.opacity(0.14), in: Circle())
                                    .accessibilityHidden(true)
                                Text(verbatim: person.name)
                            }
                        }
                    } header: {
                        Text("Who Uses It")
                    } footer: {
                        Text("The people in the household who sign in to \(app.name). Add someone or change what they use on the computer's Settings › People.")
                    }
                }
            } else if !failed {
                // A row while it's read: a Section with nothing in it never runs its task.
                Section("Who Uses It") {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
        }
        // Group hands the task to the row it shows, so it runs again when the answer replaces the
        // row being read: read once.
        .task(id: app.id) {
            guard read == nil, !failed else { return }
            do {
                read = try await actions.appPeople(for: app)
            } catch is CancellationError {
            } catch {
                failed = true
            }
        }
    }
}
