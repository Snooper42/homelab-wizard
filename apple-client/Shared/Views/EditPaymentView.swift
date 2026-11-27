import SwiftUI

/// Edit a Payment (on the canvas's *Idea: Bills*):
/// a tap on a bill changes all of it, as the computer's form does: its name
/// and kind, what it costs and whether that's about, how often and its next
/// day, whether it ends, the account it comes out of, or Delete. Money from
/// someone keeps who sends it; a card's payoff keeps the card it pays.
struct EditPaymentView: View {
    let payment: FinancePayment
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var kind = "other"
    @State private var amountText = ""
    @State private var estimate = false
    /// An `every` id, or "paycheck:" (whoever is paid) and "paycheck:<person>".
    @State private var often = "month"
    @State private var start = Date()
    @State private var day2 = 15
    @State private var ends = false
    @State private var endDate = Date()
    @State private var from = ""
    @State private var saving = false
    @State private var confirmingDelete = false
    @State private var filled = false

    private var amount: Double? { FinancePlanEdit.parseAmount(amountText) }
    private var people: [FinancePerson] { finances.plan?.plan.people ?? [] }
    private var withPaychecks: Bool { often.hasPrefix("paycheck:") }
    private var fromSomeone: Bool { !(payment.payer ?? "").isEmpty }
    private var paysACard: Bool { !(payment.card ?? "").isEmpty }

    /// What it can come out of: checking, savings, or a card it's charged to (never the card it pays off).
    private var accounts: [FinanceAccount] {
        (finances.plan?.plan.accounts ?? []).filter { FinancePlanEdit.paymentFromKinds.contains($0.kind) && $0.id != payment.card }
    }

    private var edited: NewPayment {
        var p = NewPayment(name: name, amount: amount ?? 0, every: withPaychecks ? "paycheck" : often,
                           start: FinancePlanEdit.todayString(start), kind: kind)
        if often == "twice a month" { p.day2 = day2 }
        if ends, often != "once" { p.until = FinancePlanEdit.todayString(endDate) }
        if withPaychecks { p.person = String(often.dropFirst("paycheck:".count)) }
        // Checking is the computer's default: kept as none, as its form does.
        p.from = from == (finances.plan?.checking ?? "") ? "" : from
        p.estimate = estimate
        return p
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !saving && (paysACard ? (amount ?? 0) >= 0 : (amount ?? 0) > 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                        #if os(iOS)
                        .textInputAutocapitalization(.words)
                        #endif
                    Picker("Kind", selection: $kind) {
                        ForEach(FinancePlanEdit.paymentKinds, id: \.id) { k in
                            Text(k.title).tag(k.id)
                        }
                    }
                    if fromSomeone, let payer = payment.payer {
                        LabeledContent("From") { Text(verbatim: payer) }
                    }
                } header: {
                    Text("What it is")
                }
                Section {
                    TextField(paysACard ? "Other spending on it each time" : "What it costs", text: $amountText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .monospacedDigit()
                        .privacySensitive()
                    Toggle("About this much", isOn: $estimate)
                } header: {
                    Text("Each time")
                } footer: {
                    Text(paysACard ? "It pays the card's balance; this is what else goes on the card each time."
                                   : "On: it changes from time to time, and Bills marks it ≈.")
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
                        DatePicker(often == "once" ? "On" : "Starting", selection: $start, displayedComponents: .date)
                    }
                    if often == "twice a month" {
                        Stepper(value: $day2, in: 1...31) {
                            LabeledContent("And on day") { Text("\(day2)").monospacedDigit() }
                        }
                    }
                    if often != "once" {
                        Toggle("It Ends", isOn: $ends)
                        if ends {
                            DatePicker("Ends", selection: $endDate, in: (withPaychecks ? Date.distantPast : start)..., displayedComponents: .date)
                        }
                    }
                } header: {
                    Text("When")
                }
                if !fromSomeone, !accounts.isEmpty {
                    Section {
                        Picker("Comes out of", selection: $from) {
                            ForEach(accounts) { account in
                                Text(verbatim: account.name).tag(account.id)
                            }
                        }
                    } header: {
                        Text("Paid from")
                    } footer: {
                        Text("Every one still to come changes. One already in your transactions stays as it was.")
                    }
                }
                if let error = finances.saveError, !saving {
                    Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.danger) }
                }
                Section {
                    Button("Delete Payment", role: .destructive) { confirmingDelete = true }
                        .frame(maxWidth: .infinity)
                        .disabled(saving)
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
            .navigationTitle(payment.name)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else { Button("Save", action: save).disabled(!canSave) }
                }
            }
            .confirmationDialog("Delete \(payment.name)?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    saving = true
                    Task {
                        let ok = await finances.removePayment(payment)
                        saving = false
                        if ok { dismiss() }
                    }
                }
            } message: {
                Text("It comes off Bills and what's left on every device. Its transactions stay as they are.")
            }
            .onAppear(perform: fill)
        }
        .presentationDetents([.large])
    }

    private func save() {
        saving = true
        Task {
            let ok = await finances.updatePayment(payment, with: edited)
            saving = false
            if ok { dismiss() }
        }
    }

    /// The payment as it is, once: what the sheet opens on.
    private func fill() {
        guard !filled else { return }
        filled = true
        finances.clearSaveError()
        name = payment.name
        kind = payment.kind ?? "other"
        if let a = payment.amount { amountText = FinancePlanEdit.roundedToCents(a).formatted(.number.precision(.fractionLength(2)).grouping(.never)) }
        estimate = payment.estimate ?? false
        let schedule = payment.schedule
        if schedule?.every == "paycheck" {
            often = "paycheck:" + (schedule?.person ?? "")
        } else if let every = schedule?.every {
            often = every
        }
        if let first = LocalDay.parse(schedule?.start) { start = first }
        if let d = schedule?.day2 { day2 = d }
        if let until = LocalDay.parse(schedule?.until) {
            ends = true
            endDate = until
        }
        let checking = finances.plan?.checking ?? ""
        from = payment.from.flatMap { id in accounts.contains { $0.id == id } ? id : nil }
            ?? (accounts.contains { $0.id == checking } ? checking : accounts.first?.id ?? "")
    }
}
