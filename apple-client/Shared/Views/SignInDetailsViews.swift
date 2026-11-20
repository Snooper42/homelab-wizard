import SwiftUI

/// An app's page › Sign-in Details (the owner's yes, Nov 20, on the canvas's
/// *Idea: Sign-in details*), as the computer's ⚙: the row, with a dot while
/// one isn't ticked Saved. Nothing for an app with none, or when the computer
/// doesn't say (over plain Wi-Fi it sends none).
struct SignInDetailsSection: View {
    let app: AppStatus
    @Environment(AppActionsViewModel.self) private var actions
    @State private var rows: [SignInDetail]?
    @State private var failed = false
    @State private var showing = false

    var body: some View {
        Group {
            if let rows {
                if !rows.isEmpty {
                    Section {
                        Button { showing = true } label: {
                            HStack {
                                Label("Sign-in Details", systemImage: "key")
                                Spacer(minLength: 8)
                                if rows.contains(where: { !$0.saved }) {
                                    Circle().fill(Theme.accent).frame(width: 8, height: 8)
                                        .accessibilityLabel("Not all saved in your password manager")
                                }
                            }
                        }
                    } footer: {
                        Text(signInFooter(rows))
                    }
                }
            } else if !failed {
                // A row while it's read: a Section with nothing in it never runs its task.
                Section { ProgressView().frame(maxWidth: .infinity) }
            }
        }
        // Group hands the task to the row it shows: read once.
        .task(id: app.id) {
            guard rows == nil, !failed else { return }
            do {
                rows = try await actions.signIns(for: app)
            } catch is CancellationError {
            } catch {
                failed = true
            }
        }
        .sheet(isPresented: $showing) {
            SignInDetailsSheet(app: app, rows: Binding(get: { rows ?? [] }, set: { rows = $0 }))
        }
    }
}

/// "Its 3 passwords and keys, to copy into your password manager: 1 not saved yet."
func signInFooter(_ rows: [SignInDetail]) -> String {
    let left = rows.filter { !$0.saved }.count
    let what = rows.count == 1 ? "Its password or key" : "Its \(rows.count) passwords and keys"
    if left == 0 { return "\(what), all saved in your password manager." }
    return "\(what), to copy into your password manager: \(left) not saved yet."
}

/// The sheet: each section's rows as •••, Copy (Face ID first; 90 seconds on
/// this device's clipboard, never shown) and, after a copy, the Saved tick.
struct SignInDetailsSheet: View {
    let app: AppStatus
    @Binding var rows: [SignInDetail]
    @Environment(AppActionsViewModel.self) private var actions
    @Environment(\.dismiss) private var dismiss
    /// The row just copied, for its button's words.
    @State private var copied: String?
    @State private var problem: String?
    @State private var busy: String?

    var body: some View {
        NavigationStack {
            Form {
                ForEach(SignInDetail.sections(rows)) { part in
                    Section {
                        ForEach(part.rows) { row in rowView(row) }
                    } header: {
                        Text(part.section.title)
                    } footer: {
                        if part.section == .keepSafe {
                            Text("Without these the backups can't be opened.")
                        }
                    }
                }
                Section {
                } footer: {
                    if let problem {
                        Text(verbatim: problem).foregroundStyle(Theme.danger)
                    } else if actions.canCopySignIns {
                        Text("Face ID asks before each copy. The copy stays on this device, clears after 90 seconds, and is never shown. The computer keeps each copy in \(app.name)'s history.")
                    } else {
                        Text("Copy them on the computer (\(app.name)'s ⚙), or from a phone allowed to make changes.")
                    }
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
            .navigationTitle("\(app.name)'s Sign-in Details")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    @ViewBuilder
    private func rowView(_ row: SignInDetail) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: row.what)
                Text(verbatim: "••••••••••").font(.footnote).foregroundStyle(.secondary).accessibilityHidden(true)
            }
            Spacer(minLength: 8)
            if actions.canCopySignIns {
                if copied == row.id {
                    Text("Copied. Paste it into Proton Pass")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.success)
                        .multilineTextAlignment(.trailing)
                } else {
                    Button("Copy") { Task { await copy(row) } }
                        .buttonStyle(.borderless)
                        .disabled(busy != nil)
                        .accessibilityLabel("Copy \(row.what)")
                }
            }
        }
        .accessibilityElement(children: .contain)
        if actions.canCopySignIns, copied == row.id || row.saved {
            Toggle("Saved in Proton Pass", isOn: Binding(get: { row.saved }, set: { on in Task { await mark(row, on) } }))
                .disabled(busy != nil)
        }
    }

    private func copy(_ row: SignInDetail) async {
        busy = row.id
        defer { busy = nil }
        do {
            if try await actions.copySignIn(row, appName: app.name) {
                copied = row.id
                problem = nil
            }
        } catch {
            problem = APIError.from(error).errorDescription
        }
    }

    private func mark(_ row: SignInDetail, _ saved: Bool) async {
        busy = row.id
        defer { busy = nil }
        do {
            try await actions.markSignIn(row, saved: saved)
            if let i = rows.firstIndex(where: { $0.id == row.id }) { rows[i].saved = saved }
            problem = nil
        } catch {
            problem = APIError.from(error).errorDescription
        }
    }
}
