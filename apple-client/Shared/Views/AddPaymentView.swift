import SwiftUI

/// A new payment, as the computer's Add a payment makes one (the owner's
/// pick, Nov 14; money in, twice a month and with each paycheck on the mocks
/// canvas, Nov 15): money out (its name and what it's for, what it costs each
/// time, about this much for one that changes, and the account it comes out
/// of) or money in from someone outside the household (who sends it, and the
/// account it goes into); how often, from its next day, twice a month on two
/// days, or with each paycheck. Its logo comes from its name, as on the computer.
struct AddPaymentView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var comesIn = false
    @State private var name = ""
    @State private var payer = ""
    @State private var kind = "other"
    @State private var amountText = ""
    @State private var estimate = false
    /// An `every` id, or "paycheck:" (whoever is paid) and "paycheck:<person>".
    @State private var often = "month"
    @State private var start = Date()
    @State private var day2 = 15
    @State private var from = ""
    @State private var into = ""
    @State private var saving = false
    @FocusState private var focused: Bool

    private var amount: Double? { FinancePlanEdit.parseAmount(amountText) }
    private var people: [FinancePerson] { finances.plan?.plan.people ?? [] }
    private var withPaychecks: Bool { often.hasPrefix("paycheck:") }

    /// What it can come out of: checking, savings, or a card it's charged to.
    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { FinancePlanEdit.paymentFromKinds.contains($0.kind) }
    }
    /// What money from someone can go into: checking or savings.
    private var intoAccounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { FinancePlanEdit.paymentToKinds.contains($0.kind) }
    }

    private var payment: NewPayment {
        var p = NewPayment(name: name, amount: amount ?? 0, every: withPaychecks ? "paycheck" : often,
                           start: FinancePlanEdit.todayString(start), kind: kind)
        if often == "twice a month" { p.day2 = day2 }
        if withPaychecks { p.person = String(often.dropFirst("paycheck:".count)) }
        if comesIn {
            p.payer = payer
            p.to = into == (finances.plan?.checking ?? "") ? "" : into
        } else {
            p.from = from
            p.estimate = estimate
        }
        return p
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Which way", selection: $comesIn) {
                        Text("Money Out").tag(false)
                        Text("Money In").tag(true)
                    }
                    .pickerStyle(.segmented)
                    TextField(comesIn ? "Name, like Rent from the lodger" : "Name, like Netflix", text: $name)
                        .focused($focused)
                        #if os(iOS)
                        .textInputAutocapitalization(.words)
                        #endif
                    if comesIn {
                        TextField("Who sends it", text: $payer)
                            .autocorrectionDisabled()
                    } else {
                        Picker("Kind", selection: $kind) {
                            ForEach(FinancePlanEdit.paymentKinds, id: \.id) { k in
                                Text(k.title).tag(k.id)
                            }
                        }
                    }
                }
                Section {
                    TextField(comesIn ? "How much" : "What it costs", text: $amountText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .monospacedDigit()
                    if !comesIn {
                        Toggle("About this much", isOn: $estimate)
                    }
                } header: {
                    Text("Each time")
                } footer: {
                    if !comesIn { Text("For one that changes, like electric.") }
                }
                Section {
                    Picker("How often", selection: $often) {
                        ForEach(FinancePlanEdit.paymentEveries, id: \.id) { e in
                            Text(e.title).tag(e.id)
                        }
                        if !people.isEmpty {
                            Text("With each paycheck, whoever is paid").tag("paycheck:")
                            ForEach(people) { person in
                                Text(verbatim: "With each of \(person.name)\u{2019}s paychecks").tag("paycheck:" + person.id)
                            }
                        }
                    }
                    if !withPaychecks {
                        DatePicker(often == "once" ? "On" : "Next on", selection: $start, displayedComponents: .date)
                    }
                    if often == "twice a month" {
                        Stepper(value: $day2, in: 1...31) {
                            LabeledContent("And on day") { Text("\(day2)").monospacedDigit() }
                        }
                    }
                } header: {
                    Text("When")
                } footer: {
                    if withPaychecks { Text("It comes on those paydays.") }
                }
                Section {
                    if comesIn {
                        if !intoAccounts.isEmpty {
                            Picker("Goes into", selection: $into) {
                                ForEach(intoAccounts) { account in
                                    Text(verbatim: account.name).tag(account.id)
                                }
                            }
                        }
                    } else if !accounts.isEmpty {
                        Picker("Comes out of", selection: $from) {
                            ForEach(accounts) { account in
                                Text(verbatim: account.name).tag(account.id)
                            }
                        }
                    }
                } header: {
                    Text(comesIn ? "Into" : "From")
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
                        saving = true
                        Task {
                            let ok = await finances.addPayment(payment)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || (amount ?? 0) <= 0 || saving
                              || (comesIn && payer.trimmingCharacters(in: .whitespaces).isEmpty))
                }
            }
            .onAppear {
                finances.clearSaveError()
                // The first checking account, as the computer reads a payment with none named.
                let checking = finances.plan?.checking ?? ""
                if from.isEmpty { from = accounts.first { $0.kind == "checking" }?.id ?? accounts.first?.id ?? "" }
                if into.isEmpty { into = intoAccounts.contains { $0.id == checking } ? checking : intoAccounts.first?.id ?? "" }
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
                if finances.canEditPlan {
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
