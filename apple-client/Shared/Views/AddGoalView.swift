import SwiftUI

/// A new goal, as the computer's Add a goal makes one (the owner's pick,
/// Nov 14): its name and what it needs, the day it's wanted by (or none:
/// whenever), and the share of each account that counts toward it: one or
/// several (the owner's yes, Nov 19), each no more than other goals leave.
struct AddGoalView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var targetText = ""
    @State private var byADay = false
    @State private var date = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
    @State private var shares: [GoalShare] = []
    @State private var saving = false
    @FocusState private var focused: Bool

    private var target: Double? { FinancePlanEdit.parseAmount(targetText) }
    private var currency: String { finances.plan?.plan.currency ?? "USD" }

    /// What can count toward it: accounts that hold money to put by.
    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { FinancePlanEdit.goalFromKinds.contains($0.kind) }
    }

    /// The accounts not counted yet that other goals leave something of.
    private var addable: [FinanceAccount] {
        accounts.filter { a in !shares.contains { $0.account == a.id } && finances.goalShareLeft(of: a.id) >= 5 }
    }

    private func accountName(_ account: String) -> String { accounts.first { $0.id == account }?.name ?? "the account" }

    /// The most of `account` this goal can count, in steps of 5%.
    private func most(of account: String) -> Double { min(100, (finances.goalShareLeft(of: account) / 5).rounded(.down) * 5) }

    /// What the shares hold together today.
    private var together: Double {
        shares.reduce(0) { sum, share in
            sum + (accounts.first { $0.id == share.account }?.balance ?? 0) * share.percent / 100
        }
    }

    private func adding(_ account: String) -> GoalShare { GoalShare(account: account, percent: max(5, most(of: account))) }

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
                    ForEach($shares) { $share in
                        Stepper(value: $share.percent, in: 5...max(5, most(of: share.account)), step: 5) {
                            LabeledContent {
                                Text(share.percent / 100, format: .percent.precision(.fractionLength(0)))
                                    .monospacedDigit()
                            } label: {
                                Text(verbatim: accountName(share.account))
                            }
                        }
                    }
                    .onDelete { at in
                        // One account stays: a goal counts something.
                        if shares.count > 1 { shares.remove(atOffsets: at) }
                    }
                    if !addable.isEmpty {
                        Menu {
                            ForEach(addable) { a in
                                Button { shares.append(adding(a.id)) } label: { Text(verbatim: a.name) }
                            }
                        } label: {
                            Label("Add an Account", systemImage: "plus")
                        }
                    }
                } header: {
                    Text("Counts toward it")
                } footer: {
                    if let error = finances.saveError, !saving {
                        Text(verbatim: error).foregroundStyle(Theme.danger)
                    } else if shares.isEmpty {
                        Text("No account here holds money to put by, or other goals count all of it.")
                    } else if let target, target > 0 {
                        Text(verbatim: "Together that's \(amountText(together, currency, finances)) of \(amountText(target, currency, finances)) today.")
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
                                                            shares: shares)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || (target ?? 0) <= 0
                              || shares.isEmpty || saving)
                }
            }
            .onAppear {
                finances.clearSaveError()
                // Savings first, as goals usually are; then whatever holds money to put by.
                if shares.isEmpty, let first = addable.first(where: { $0.kind == "savings" }) ?? addable.first {
                    shares = [adding(first.id)]
                }
                focused = true
            }
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
