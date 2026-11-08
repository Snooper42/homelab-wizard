import SwiftUI

/// The computer's Settings form (`.env`), as iPhone Settings lists its
/// own: each setting by its name for people with its value, a switch for
/// one that is on or off (flipped in place), and the everyday ones first.
/// A setting opens its own page, with what it does, its key, and the field
/// to change it. A device allowed changes may change the everyday ones; a
/// secret shows only whether it is set, and secrets and the settings this
/// device connects through are changed on the computer (main #491).
struct SettingsFormView: View {
    let computer: ComputerViewModel
    /// One section, or nil for every setting.
    let section: String?
    @Environment(DashboardViewModel.self) private var dashboard
    @State private var search = ""
    @State private var showAll = false
    /// A switch's own page, opened from its ⓘ.
    @State private var about: String?

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
                        Button(showAll ? "Show Fewer" : "Show All (\(more) more)") {
                            withAnimation(.snappy) { showAll.toggle() }
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
                ProgressView()
            }
        }
        .searchable(text: $search, prompt: "Search")
        .navigationDestination(item: $about) { key in
            SettingDetailView(computer: computer, key: key, label: SettingWords.label(key, apps: apps))
        }
        .navigationTitle(section.map(SettingWords.section) ?? "All Settings")
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
        return mine.filter { SettingWords.everyday.contains($0.key) }
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
        if setting.isToggle {
            // A switch, flipped in place, as iPhone Settings has them; its ⓘ opens what it does.
            HStack(spacing: 10) {
                Text(verbatim: label)
                Button {
                    about = setting.key
                } label: {
                    Image(systemName: "info.circle")
                        .foregroundStyle(Theme.accent)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(Text(verbatim: "About \(label)"))
                Spacer(minLength: 8)
                Toggle(isOn: Binding(
                    get: { setting.value.lowercased() == "true" },
                    set: { on in Task { _ = await computer.saveForm([setting.key: on ? "true" : "false"]) } }
                )) {
                    Text(verbatim: label)
                }
                .labelsHidden()
                .disabled(!editable || computer.isSavingForm)
            }
        } else {
            NavigationLink {
                SettingDetailView(computer: computer, key: setting.key, label: label)
            } label: {
                LabeledContent {
                    HStack(spacing: 6) {
                        Text(verbatim: Self.shownValue(setting))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        if !editable {
                            Image(systemName: "lock.fill")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                                .accessibilityLabel("Changed on the computer")
                        }
                    }
                } label: {
                    Text(verbatim: label)
                }
            }
        }
    }

    /// A value as its row shows it: "Set" or "Not set" for a secret, "None" when empty.
    nonisolated static func shownValue(_ setting: HomelabSetting) -> String {
        if setting.secret { return setting.set ? "Set" : "Not set" }
        let value = setting.value.trimmingCharacters(in: .whitespaces)
        return value.isEmpty ? "None" : value
    }
}

/// One setting on a page of its own, as iPhone Settings opens one: the
/// field to change it, then what it does, its key, and why it can't be
/// changed here when it can't.
private struct SettingDetailView: View {
    let computer: ComputerViewModel
    let key: String
    let label: String
    @State private var typed: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            if let form = computer.form, let setting = form.settings.first(where: { $0.key == key }) {
                let editable = computer.canChange && form.phoneMayChange(setting)
                Section {
                    if setting.isToggle {
                        Toggle(isOn: Binding(
                            get: { setting.value.lowercased() == "true" },
                            set: { on in Task { _ = await computer.saveForm([key: on ? "true" : "false"]) } }
                        )) {
                            Text(verbatim: label)
                        }
                        .disabled(!editable || computer.isSavingForm)
                    } else if setting.secret {
                        LabeledContent(label) {
                            Text(setting.set ? "Set" : "Not set").foregroundStyle(.secondary)
                        }
                    } else if editable {
                        TextField(text: Binding(get: { typed ?? setting.value }, set: { typed = $0 }), prompt: Text("None")) {
                            Text(verbatim: label)
                        }
                        .autocorrectionDisabled()
                        #if os(iOS)
                        .textInputAutocapitalization(.never)
                        #endif
                        .disabled(computer.isSavingForm)
                        .submitLabel(.done)
                        .onSubmit { save(setting) }
                    } else {
                        Text(verbatim: setting.value.isEmpty ? "None" : setting.value)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                } footer: {
                    VStack(alignment: .leading, spacing: 8) {
                        let help = SettingWords.plainHelp(setting.help, toggle: setting.isToggle)
                        if !help.isEmpty { Text(verbatim: help) }
                        if !form.phoneMayChange(setting) {
                            Label(setting.secret ? "Secrets are changed on the computer." : "This device connects through it, so it's changed on the computer.",
                                  systemImage: "lock.fill")
                        }
                        Text(verbatim: setting.key)
                            .font(.caption2.monospaced())
                            .foregroundStyle(.tertiary)
                            .textSelection(.enabled)
                    }
                }
                if let error = computer.formSaveError {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(Theme.danger)
                    }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle(Text(verbatim: label))
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            if let typed, let setting = computer.form?.settings.first(where: { $0.key == key }), typed != setting.value {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save(setting) }
                        .disabled(computer.isSavingForm)
                }
            }
        }
        .sensoryFeedback(.success, trigger: computer.formSavedCount)
    }

    private func save(_ setting: HomelabSetting) {
        guard let typed, typed != setting.value else { return }
        Task {
            if await computer.saveForm([key: typed]) { self.typed = nil }
        }
    }
}
