import SwiftUI

/// Transactions › ⋯ › Rules, as the owner approved the mock, Nov 15: what
/// each payee becomes as it comes in, each changeable, a swipe to remove one.
/// Every import follows them, before anything is guessed (import 4 of 4).
struct RulesView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(Array(finances.rules.enumerated()), id: \.offset) { i, rule in
                        NavigationLink {
                            RuleEditor(finances: finances, index: i, rule: rule)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(verbatim: rule.prefix ? "\(rule.match) \u{2026}" : rule.match)
                                    .lineLimit(1)
                                Text(verbatim: PayeeRules.becomes(rule))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                        }
                        .swipeActions {
                            Button("Remove", role: .destructive) {
                                var next = finances.rules
                                guard next.indices.contains(i) else { return }
                                next.remove(at: i)
                                Task { _ = await finances.saveRules(next) }
                            }
                            .disabled(!finances.canChangeRules)
                        }
                    }
                } footer: {
                    if let error = finances.saveError {
                        Text(verbatim: error).foregroundStyle(Theme.danger)
                    } else if finances.rules.isEmpty {
                        Text("No rules yet. Change a transaction's payee or category and turn on Always do this for….")
                    } else if !finances.canChangeRules {
                        Text("Rules change the plan for every device, so they're changed once the Homelab answers.")
                    }
                }
            }
            .navigationTitle("Rules")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear { finances.clearSaveError() }
        }
    }
}

/// One rule: the name it's for (and names starting so), the name it gives, and its category.
private struct RuleEditor: View {
    let finances: FinancesViewModel
    let index: Int
    @State var rule: BankImport.Rule
    @Environment(\.dismiss) private var dismiss
    @State private var saving = false

    private var categories: [FinanceCategory] { finances.plan?.categories ?? [] }

    var body: some View {
        Form {
            Section {
                TextField("Name it's for", text: $rule.match)
                    .autocorrectionDisabled()
                Toggle("And Names Starting So", isOn: $rule.prefix)
            } header: {
                Text("For")
            } footer: {
                Text(rule.prefix ? "Every payee whose name starts with these words." : "Only a payee by this name, in any capitals.")
            }
            Section {
                TextField("Its name as it comes in", text: Binding(get: { rule.payee ?? "" }, set: { rule.payee = $0 }))
                    .autocorrectionDisabled()
                Picker("Category", selection: Binding(get: { rule.category ?? "" }, set: { rule.category = $0.isEmpty ? nil : $0 })) {
                    Text("None").tag("")
                    ForEach(categories) { c in
                        Text(verbatim: c.parent.map { "\($0) › \(c.name)" } ?? c.name).tag(c.name)
                    }
                    if let c = rule.category, !categories.contains(where: { $0.name == c }) {
                        Text(verbatim: c).tag(c)
                    }
                }
            } header: {
                Text("Becomes")
            } footer: {
                if let error = finances.saveError, !saving {
                    Text(verbatim: error).foregroundStyle(Theme.danger)
                } else if let problem = PayeeRules.problem([rule]) {
                    Text(verbatim: problem)
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Rule")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    var next = finances.rules
                    guard next.indices.contains(index) else { return }
                    next[index] = PayeeRules.tidy(rule)
                    saving = true
                    Task {
                        let ok = await finances.saveRules(next)
                        saving = false
                        if ok { dismiss() }
                    }
                }
                .disabled(!finances.canChangeRules || PayeeRules.problem([rule]) != nil || saving)
            }
        }
        .onAppear { finances.clearSaveError() }
    }
}
