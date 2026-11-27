import SwiftUI

/// A loan's page from Loans:
/// what's owed and its rate, and where its papers are typed in on the
/// computer, the ring of payments made, what's paid down of what was
/// borrowed, the next payment split, who pays it each month, when it's half
/// paid and paid off, and every payment (`LoanPapers`, as the computer's Loans).
/// Where Finances may change, Type In Its Papers… (or Change Its Papers…)
/// opens `LoanPapersEditor`.
struct LoanPage: View {
    let loan: FinancePayoff
    @Bindable var finances: FinancesViewModel
    @State private var papers: LoanPapers?
    @State private var typing = false

    private var account: FinanceAccount? { finances.plan?.plan.accounts.first { $0.id == loan.account } }

    var body: some View {
        Form {
            if let view = finances.plan {
                let currency = view.plan.currency
                Section {
                    LabeledContent("Owed") { Money(value: loan.balance, currency: currency, finances: finances) }
                    if loan.rate > 0 {
                        LabeledContent("Rate", value: "\(loan.rate.formatted(.number.precision(.fractionLength(0...2))))% a year")
                    }
                    LabeledContent("Each month") { Money(value: loan.monthly, currency: currency, finances: finances) }
                    if loan.never {
                        Label("The payment doesn't keep up with the interest. At this pace it's never paid off.", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.danger)
                    } else if let paidOff = loan.paidOff, loan.balance > 0.005 {
                        LabeledContent("Paid off", value: paidOff.formatted(.dateTime.month(.wide).year()))
                    }
                }
                if let papers {
                    Section { LoanPapersSummary(papers: papers, currency: currency, finances: finances) }
                    if let next = papers.next {
                        Section {
                            LabeledContent("Payment") { Money(value: next.payment, currency: currency, finances: finances) }
                            LabeledContent("Pays it down") { Money(value: next.principal, currency: currency, finances: finances) }
                            if next.interest > 0.005 {
                                LabeledContent("Interest") { Money(value: next.interest, currency: currency, finances: finances) }
                            }
                        } header: {
                            Text(verbatim: "Next payment, \(LoanPapersSummary.day(next.date))")
                        }
                    }
                    if papers.saysWhoPays {
                        Section("Each month") {
                            ForEach(Array(papers.into.enumerated()), id: \.offset) { _, payer in
                                LabeledContent(payer.name) { Money(value: payer.amount, currency: currency, finances: finances) }
                            }
                            if papers.rest > 0.005 {
                                LabeledContent("Paid another way") {
                                    Money(value: papers.rest, currency: currency, finances: finances).foregroundStyle(Theme.secondaryInk)
                                }
                            }
                        }
                    }
                    Section {
                        NavigationLink {
                            LoanPaymentsList(papers: papers, title: finances.accountName(loan.account) ?? "Loan", currency: currency, finances: finances)
                        } label: {
                            LabeledContent("Every Payment", value: "\(papers.rows.count)")
                        }
                    }
                } else {
                    Section {
                        Text(finances.canEditPlan
                             ? "Type in its papers to see each payment, what's paid down, and when it's half paid. What it owes is then read from them: no balance to type."
                             : "Its papers, typed in on a device that may change Finances, show each payment, what's paid down, and when it's half paid.")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryInk)
                    }
                }
                if finances.canEditPlan, account != nil {
                    Section {
                        Button(papers == nil ? "Type In Its Papers…" : "Change Its Papers…") {
                            finances.clearSaveError()
                            typing = true
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $typing) {
            if let account { LoanPapersEditor(account: account, finances: finances) }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .navigationTitle(finances.accountName(loan.account) ?? "Loan")
        .task(id: finances.wholeVersion) { papers = finances.loanPapers(for: loan.account) }
    }
}

/// The ring of payments made, what's paid down of what was borrowed, and
/// when it's half paid and paid off.
struct LoanPapersSummary: View {
    let papers: LoanPapers
    let currency: String
    let finances: FinancesViewModel

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            ZStack {
                Circle().stroke(Theme.separator, lineWidth: 10)
                Circle()
                    .trim(from: 0, to: papers.rows.isEmpty ? 0 : CGFloat(papers.made) / CGFloat(papers.rows.count))
                    .stroke(Theme.accent, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text(verbatim: "\(papers.made)").font(.title2.weight(.bold)).monospacedDigit()
                    Text(verbatim: "of \(papers.rows.count)").font(.caption2).foregroundStyle(Theme.secondaryInk)
                    Text("payments").font(.caption2).foregroundStyle(Theme.secondaryInk)
                }
            }
            .frame(width: 96, height: 96)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(papers.made) of \(papers.rows.count) payments made")
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 4) {
                    Money(value: papers.down, currency: currency, finances: finances).fontWeight(.semibold)
                    Text(verbatim: "of \(amountText(papers.original, currency, finances, whole: true)) paid down, \(Int((papers.share * 100).rounded()))%")
                }
                .font(.subheadline)
                ProgressView(value: papers.share)
                    .tint(Theme.accent)
                    .accessibilityHidden(true)
                Text(verbatim: whenWords)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
        }
        .padding(.vertical, 6)
    }

    /// "Half paid off on Mar 1, 2042. Paid off Nov 1, 2053, after 323 more payments; $331,400 of interest still to pay ($52,900 paid so far)."
    private var whenWords: String {
        var out = ""
        if let half = papers.half {
            out += (papers.halfMade ? "Half paid off " : "Half paid off on ") + Self.day(half.date) + ". "
        }
        if let last = papers.last {
            out += "Paid off \(Self.day(last.date)), after \(papers.left == 1 ? "1 more payment" : "\(papers.left) more payments")"
            if papers.interest > 0.005 { out += "; \(amountText(papers.interest, currency, finances, whole: true)) of interest still to pay" }
            if papers.paidIn > 0.005 { out += " (\(amountText(papers.paidIn, currency, finances, whole: true)) paid so far)" }
            out += "."
        }
        return out
    }

    static func day(_ date: String) -> String {
        FinanceCalendar.shown(date).map { $0.formatted(.dateTime.month(.abbreviated).day().year()) } ?? date
    }
}

/// Every payment on the papers: its day, what pays it down and its
/// interest, what's owed after; the ones made greyed, the next one marked.
struct LoanPaymentsList: View {
    let papers: LoanPapers
    let title: String
    let currency: String
    let finances: FinancesViewModel

    var body: some View {
        List {
            ForEach(Array(papers.rows.enumerated()), id: \.offset) { i, row in
                let made = i < papers.made
                let next = i == papers.made
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(verbatim: "\(i + 1). \(LoanPapersSummary.day(row.date))")
                            .fontWeight(next ? .semibold : .regular)
                        if next {
                            Text("Next").font(.caption2.weight(.bold)).foregroundStyle(Theme.accent)
                        }
                        Spacer()
                        Money(value: row.payment, currency: currency, finances: finances)
                    }
                    HStack(spacing: 4) {
                        Text("Pays down")
                        Money(value: row.principal, currency: currency, finances: finances)
                        Text(verbatim: "·")
                        Text("interest")
                        Money(value: row.interest, currency: currency, finances: finances)
                        Spacer()
                        Text("owed after")
                        Money(value: row.after, currency: currency, finances: finances)
                    }
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                }
                .opacity(made ? 0.55 : 1)
                .accessibilityElement(children: .combine)
                .accessibilityValue(made ? "Made" : next ? "Next" : "")
            }
        }
        .navigationTitle("Every Payment")
        .accessibilityLabel(Text(verbatim: "\(title): every payment"))
    }
}
