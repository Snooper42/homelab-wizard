import SwiftUI

/// The computer's Settings form (`.env`), as its Settings screen draws it:
/// each setting by its name for people with its key beside it, a switch for
/// one that is on or off, its help, and the everyday ones first. A device
/// allowed changes may change the everyday ones; a secret shows only
/// whether it is set, and secrets and the settings this device connects
/// through are changed on the computer (main #491).
struct SettingsFormView: View {
    let computer: ComputerViewModel
    /// One section, or nil for every setting.
    let section: String?
    @Environment(DashboardViewModel.self) private var dashboard
    /// What was typed and not saved, by key: gone when the screen goes.
    @State private var edits: [String: String] = [:]
    @State private var search = ""
    @State private var showAll = false

    var body: some View {
        Form {
            if let form = computer.form {
                let rows = shown(in: form)
                ForEach(SettingGroup.grouping(rows)) { group in
                    Section {
                        ForEach(group.settings) { setting in
                            row(setting, in: form)
                        }
                    } header: {
                        if section == nil || !search.isEmpty {
                            Text(verbatim: SettingWords.section(group.name))
                        }
                    }
                }
                if rows.isEmpty {
                    Section {
                        Text(search.isEmpty ? "No settings here." : "No setting matches.")
                            .foregroundStyle(.secondary)
                    }
                }
                let more = hiddenCount(in: form)
                if search.isEmpty, more > 0 || showAll {
                    Section {
                        Button(showAll ? "Show the Everyday Settings Only" : "Show All Settings (\(more) more)") {
                            showAll.toggle()
                        }
                    }
                }
            } else if let error = computer.formError {
                Section { Text(error).foregroundStyle(.secondary) }
            }
            if let error = computer.formSaveError {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(Theme.danger)
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .overlay {
            if computer.form == nil, computer.formError == nil, computer.isLoadingForm {
                ProgressView("Reading the settings…")
            }
        }
        .searchable(text: $search, prompt: "Search Settings")
        .navigationTitle(section.map(SettingWords.section) ?? "All Settings")
        .toolbar {
            if !edits.isEmpty {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Revert") { edits = [:] }
                        .disabled(computer.isSavingForm)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(edits.count == 1 ? "Save 1 Change" : "Save \(edits.count) Changes") {
                        Task {
                            if await computer.saveForm(edits) { edits = [:] }
                        }
                    }
                    .disabled(computer.isSavingForm)
                }
            }
        }
        .sensoryFeedback(.success, trigger: computer.formSavedCount)
        .task { if computer.form == nil { await computer.loadForm() } }
        .refreshable { await computer.loadForm() }
    }

    // MARK: Which settings show

    private var apps: [CatalogEntry] { dashboard.catalog?.apps ?? [] }

    /// The section's settings, or every setting matching each word searched
    /// (in its name, key, help, or section); without a search, the everyday
    /// ones first and the rest behind Show All, where a section has both.
    private func shown(in form: HomelabSettingsForm) -> [HomelabSetting] {
        let words = search.lowercased().split(separator: " ").map(String.init)
        if !words.isEmpty {
            return form.settings.filter { setting in
                let text = [SettingWords.label(setting.key, apps: apps), setting.key, setting.help, SettingWords.section(setting.section)]
                    .joined(separator: " ").lowercased()
                return words.allSatisfy { text.contains($0) }
            }
        }
        let mine = form.settings.filter { section == nil || $0.section == section }
        if showAll || !mine.contains(where: { SettingWords.everyday.contains($0.key) }) { return mine }
        return mine.filter { SettingWords.everyday.contains($0.key) || edits[$0.key] != nil }
    }

    private func hiddenCount(in form: HomelabSettingsForm) -> Int {
        guard !showAll else { return 0 }
        let mine = form.settings.filter { section == nil || $0.section == section }
        guard mine.contains(where: { SettingWords.everyday.contains($0.key) }) else { return 0 }
        return mine.filter { !SettingWords.everyday.contains($0.key) }.count
    }

    // MARK: A setting

    @ViewBuilder
    private func row(_ setting: HomelabSetting, in form: HomelabSettingsForm) -> some View {
        let label = SettingWords.label(setting.key, apps: apps)
        let editable = computer.canChange && form.phoneMayChange(setting)
        VStack(alignment: .leading, spacing: 6) {
            if setting.isToggle {
                Toggle(isOn: toggle(setting)) { Text(verbatim: label) }
                    .disabled(!editable || computer.isSavingForm)
            } else if setting.secret {
                LabeledContent {
                    Text(setting.set ? "Set" : "Not set").foregroundStyle(.secondary)
                } label: {
                    Text(verbatim: label)
                }
            } else if editable {
                Text(verbatim: label)
                TextField(text: text(setting), prompt: Text("Empty")) { Text(verbatim: label) }
                    .labelsHidden()
                    .autocorrectionDisabled()
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif
                    .font(.body.monospaced())
                    .disabled(computer.isSavingForm)
            } else {
                LabeledContent {
                    Text(verbatim: setting.value.isEmpty ? "Empty" : setting.value)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .multilineTextAlignment(.trailing)
                } label: {
                    Text(verbatim: label)
                }
            }
            Text(verbatim: setting.key)
                .font(.caption2.monospaced())
                .foregroundStyle(.tertiary)
            let help = SettingWords.plainHelp(setting.help, toggle: setting.isToggle)
            if !help.isEmpty {
                Text(verbatim: help)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if !form.phoneMayChange(setting) {
                Label(setting.secret ? "A secret: changed on the computer" : "Changed on the computer: this device connects through it",
                      systemImage: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if edits[setting.key] != nil {
                Label("Changed, not saved yet", systemImage: "pencil.circle.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.accent)
            }
        }
        .padding(.vertical, 2)
    }

    private func text(_ setting: HomelabSetting) -> Binding<String> {
        Binding(
            get: { edits[setting.key] ?? setting.value },
            set: { typed in edits[setting.key] = typed == setting.value ? nil : typed }
        )
    }

    private func toggle(_ setting: HomelabSetting) -> Binding<Bool> {
        Binding(
            get: { (edits[setting.key] ?? setting.value).lowercased() == "true" },
            set: { on in
                let typed = on ? "true" : "false"
                edits[setting.key] = typed == setting.value.lowercased() ? nil : typed
            }
        )
    }
}
