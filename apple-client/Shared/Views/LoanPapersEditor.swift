import SwiftUI

/// A loan's papers typed in on its page (the owner's yes, Nov 19, on the
/// canvas's *Idea: a loan's papers*), as the computer's account form takes
/// them: what was borrowed, the rate, the first payment's day and each
/// payment, and, if the papers say, the number of payments and the finance
/// charge. What it owes today is read from them as they're typed
/// (`LoanPapers.reading`, the computer's own reading), so there's no
/// balance to type. Save asks Face ID; away from home it waits as other changes do.
struct LoanPapersEditor: View {
    let account: FinanceAccount
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var original = ""
    @State private var rate = ""
    @State private var firstDue = Date()
    @State private var payment = ""
    @State private var term = ""
    @State private var charge = ""
    @State private var filled = false

    private var planMonthly: Double { finances.planMonthly(into: account) }
    private var today: String { FinancePlanEdit.todayString() }
    private var currency: String { finances.plan?.plan.currency ?? "USD" }

    /// What's typed, as papers; nil while a number doesn't read as one.
    private var papers: LoanPapersTyped? {
        func amount(_ s: String) -> Double?? {
            let t = s.trimmingCharacters(in: .whitespaces)
            if t.isEmpty { return .some(nil) }
            return FinancePlanEdit.parseAmount(t).map { .some($0) }
        }
        guard let borrowed = amount(original), let apr = amount(rate), let each = amount(payment), let fee = amount(charge) else { return nil }
        let count = term.trimmingCharacters(in: .whitespaces)
        guard count.isEmpty || Int(count) != nil else { return nil }
        return LoanPapersTyped(original: borrowed ?? 0, rate: apr ?? 0, firstDue: FinancePlanEdit.todayString(firstDue),
                               payment: each, term: Int(count), charge: fee)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    field("Borrowed at the start", text: $original, hint: "12,000.00")
                    field("Interest (APR), % a year", text: $rate, hint: "6.5")
                    DatePicker("First payment due", selection: $firstDue, displayedComponents: .date)
                    field("Each payment", text: $payment, hint: planMonthly > 0 ? amountText(planMonthly, currency, finances) : "367.79")
                } header: {
                    Text("From the loan's papers")
                } footer: {
                    if planMonthly > 0 {
                        Text("Leave Each payment empty for what the plan pays into it a month.")
                    }
                }
                Section {
                    field("Number of payments", text: $term, hint: "36", whole: true)
                    field("Finance charge", text: $charge, hint: "968.39")
                } header: {
                    Text("If the papers say")
                } footer: {
                    Text("The finance charge counts the days before the first payment, so what it owes comes out to the cent.")
                }
                Section {
                    readingView
                } header: {
                    Text("What it owes")
                }
                if let error = finances.saveError {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Theme.danger)
                    }
                }
            }
            .formStyle(.grouped)
            .themedCanvas()
            .navigationTitle("Its Papers")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if finances.isSaving {
                        ProgressView()
                    } else {
                        Button("Save", action: save)
                            .disabled(papers.map { $0.problem(planMonthly: planMonthly, today: today) != nil } ?? true)
                    }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 520)
        #endif
        .onAppear(perform: fill)
    }

    /// What it owes today from what's typed, in the computer's form's words.
    @ViewBuilder
    private var readingView: some View {
        if let p = papers, let read = p.reading(planMonthly: planMonthly, today: today), let last = read.rows.last {
            let off = FinanceCalendar.shown(last.date).map { $0.formatted(.dateTime.month(.abbreviated).year()) } ?? last.date
            let check = (p.term ?? 0) > 0 && p.term != read.rows.count ? " The papers say \(p.term ?? 0): check the payment and the rate." : ""
            VStack(alignment: .leading, spacing: 4) {
                Money(value: read.owed, currency: currency, finances: finances)
                    .font(.title2.weight(.semibold))
                Text(verbatim: "Today, after \(read.made) of \(read.rows.count) payments; paid off \(off).\(check) Finances takes each payment off on the day after it's due, so there's no balance to type.")
                    .font(.subheadline)
                    .foregroundStyle(check.isEmpty ? Theme.secondaryInk : Theme.warning)
            }
            .accessibilityElement(children: .combine)
        } else if let p = papers, p.original > 0, p.monthly(planMonthly: planMonthly) > 0 {
            Text("At that payment it is never paid off: check the payment and the rate.")
                .font(.subheadline).foregroundStyle(Theme.warning)
        } else {
            Text("Type what was borrowed and each payment to read it from its papers.")
                .font(.subheadline).foregroundStyle(Theme.secondaryInk)
        }
    }

    private func field(_ title: String, text: Binding<String>, hint: String, whole: Bool = false) -> some View {
        LabeledContent(title) {
            TextField(hint, text: text)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .privacySensitive()
                #if os(iOS)
                .keyboardType(whole ? .numberPad : .decimalPad)
                #endif
        }
    }

    /// What the plan holds, filled in once; the amounts only while they're showing here.
    private func fill() {
        guard !filled else { return }
        filled = true
        finances.clearSaveError()
        guard let p = finances.typedPapers(of: account) else { return }
        if let day = LocalDay.parse(p.firstDue) { firstDue = day }
        if p.rate > 0 { rate = p.rate.formatted(.number.precision(.fractionLength(0...3)).grouping(.never)) }
        if let n = p.term, n > 0 { term = String(n) }
        guard finances.amountsShown, !finances.amountsHiddenByPlan else { return }
        func typed(_ v: Double) -> String { v.formatted(.number.precision(.fractionLength(0...2)).grouping(.never)) }
        original = typed(p.original)
        if let v = p.payment, v > 0 { payment = typed(v) }
        if let v = p.charge, v > 0 { charge = typed(v) }
    }

    private func save() {
        guard let papers else { return }
        Task {
            if await finances.setPapers(of: account, papers) { dismiss() }
        }
    }
}
