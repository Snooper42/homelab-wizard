import SwiftUI

/// A new payment, as the computer's Add a payment makes one (the owner's
/// pick, Nov 14): its name and what it's for, what it costs each time (about
/// this much, for one that changes), how often from its next day, and the
/// account it comes out of. Its logo comes from its name, as on the computer.
/// Twice a month and With each paycheck are the computer's for now.
struct AddPaymentView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var kind = "other"
    @State private var amountText = ""
    @State private var estimate = false
    @State private var every = "month"
    @State private var start = Date()
    @State private var from = ""
    @State private var saving = false
    @FocusState private var focused: Bool

    private var amount: Double? { FinancePlanEdit.parseAmount(amountText) }

    /// What it can come out of: checking, savings, or a card it's charged to.
    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { FinancePlanEdit.paymentFromKinds.contains($0.kind) }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name, like Netflix", text: $name)
                        .focused($focused)
                        #if os(iOS)
                        .textInputAutocapitalization(.words)
                        #endif
                    Picker("Kind", selection: $kind) {
                        ForEach(FinancePlanEdit.paymentKinds, id: \.id) { k in
                            Text(k.title).tag(k.id)
                        }
                    }
                }
                Section {
                    TextField("What it costs", text: $amountText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .monospacedDigit()
                    Toggle("About this much", isOn: $estimate)
                } header: {
                    Text("Each time")
                } footer: {
                    Text("For one that changes, like electric.")
                }
                Section("When") {
                    Picker("How often", selection: $every) {
                        ForEach(FinancePlanEdit.paymentEveries, id: \.id) { e in
                            Text(e.title).tag(e.id)
                        }
                    }
                    DatePicker(every == "once" ? "On" : "Next on", selection: $start, displayedComponents: .date)
                }
                Section {
                    if !accounts.isEmpty {
                        Picker("Comes out of", selection: $from) {
                            ForEach(accounts) { account in
                                Text(verbatim: account.name).tag(account.id)
                            }
                        }
                    }
                } header: {
                    Text("From")
                } footer: {
                    if let error = finances.saveError, !saving {
                        Text(verbatim: error).foregroundStyle(Theme.danger)
                    } else {
                        Text("It shows in Bills and in what's left from its next day on.")
                    }
                }
            }
            .navigationTitle("Add Payment")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let amount else { return }
                        saving = true
                        Task {
                            let ok = await finances.addPayment(name: name, amount: amount, every: every, start: start,
                                                               kind: kind, from: from, estimate: estimate)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || (amount ?? 0) <= 0 || saving)
                }
            }
            .onAppear {
                finances.clearSaveError()
                // The first checking account, as the computer reads a payment with none named.
                if from.isEmpty { from = accounts.first { $0.kind == "checking" }?.id ?? accounts.first?.id ?? "" }
                focused = true
            }
        }
        .presentationDetents([.large])
    }
}

/// A + that opens Add Payment, on a page of Finances, where this device may
/// change Finances (Bills, Recurring).
struct AddPaymentButton: ViewModifier {
    let finances: FinancesViewModel
    @State private var adding = false

    func body(content: Content) -> some View {
        content
            .toolbar {
                if finances.canEdit {
                    ToolbarItem(placement: .primaryAction) {
                        Button { adding = true } label: {
                            Label("Add Payment", systemImage: "plus")
                        }
                    }
                }
            }
            .sheet(isPresented: $adding) {
                AddPaymentView(finances: finances)
            }
    }
}
