import SwiftUI

/// A new goal, as the computer's Add a goal makes one (the owner's pick,
/// Nov 14): its name and what it needs, the day it's wanted by (or none:
/// whenever), and the share of one account that counts toward it. A goal over
/// several accounts is the computer's for now.
struct AddGoalView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var targetText = ""
    @State private var byADay = false
    @State private var date = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
    @State private var account = ""
    @State private var percent = 100.0
    @State private var saving = false
    @FocusState private var focused: Bool

    private var target: Double? { FinancePlanEdit.parseAmount(targetText) }

    /// What can count toward it: accounts that hold money to put by.
    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { FinancePlanEdit.goalFromKinds.contains($0.kind) }
    }

    private var left: Double { account.isEmpty ? 0 : finances.goalShareLeft(of: account) }
    private var accountName: String { accounts.first { $0.id == account }?.name ?? "the account" }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name, like Emergency fund", text: $name)
                        .focused($focused)
                        #if os(iOS)
                        .textInputAutocapitalization(.sentences)
                        #endif
                    TextField("What it needs", text: $targetText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .monospacedDigit()
                }
                Section {
                    Toggle("By a day", isOn: $byADay)
                    if byADay {
                        DatePicker("By", selection: $date, in: Date()..., displayedComponents: .date)
                    }
                } header: {
                    Text("When")
                } footer: {
                    Text("Off: whenever. On: what it needs a month shows on Goals.")
                }
                Section {
                    if !accounts.isEmpty {
                        Picker("Account", selection: $account) {
                            ForEach(accounts) { a in
                                Text(verbatim: a.name).tag(a.id)
                            }
                        }
                        Stepper(value: $percent, in: 5...100, step: 5) {
                            LabeledContent("Share") {
                                Text(percent / 100, format: .percent.precision(.fractionLength(0)))
                                    .monospacedDigit()
                            }
                        }
                    }
                } header: {
                    Text("Counts toward it")
                } footer: {
                    if let error = finances.saveError, !saving {
                        Text(verbatim: error).foregroundStyle(Theme.danger)
                    } else if left < 100 {
                        Text(verbatim: left > 0
                             ? "\(Int(left.rounded()))% of \(accountName) is left: other goals count the rest."
                             : "Other goals count all of \(accountName): pick another account.")
                    } else {
                        Text(verbatim: "That share of what \(accountName) holds counts toward it.")
                    }
                }
            }
            .navigationTitle("Add Goal")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let target else { return }
                        saving = true
                        Task {
                            let ok = await finances.addGoal(name: name, target: target, by: byADay ? date : nil,
                                                            account: account, percent: percent)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || (target ?? 0) <= 0
                              || account.isEmpty || percent > left + 1e-9 || saving)
                }
            }
            .onAppear {
                finances.clearSaveError()
                // Savings first, as goals usually are; then whatever holds money to put by.
                if account.isEmpty { account = accounts.first { $0.kind == "savings" }?.id ?? accounts.first?.id ?? "" }
                percent = min(100, max(5, (left / 5).rounded(.down) * 5))
                focused = true
            }
            .onChange(of: account) { percent = min(100, max(5, (left / 5).rounded(.down) * 5)) }
        }
        .presentationDetents([.large])
    }
}

/// A + that opens Add Goal on Goals, where this device may change Finances.
struct AddGoalButton: ViewModifier {
    let finances: FinancesViewModel
    @State private var adding = false

    func body(content: Content) -> some View {
        content
            .toolbar {
                if finances.canEditPlan {
                    ToolbarItem(placement: .primaryAction) {
                        Button { adding = true } label: {
                            Label("Add Goal", systemImage: "plus")
                        }
                    }
                }
            }
            .sheet(isPresented: $adding) {
                AddGoalView(finances: finances)
            }
    }
}
