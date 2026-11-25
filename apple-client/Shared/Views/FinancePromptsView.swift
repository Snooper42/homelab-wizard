import SwiftUI

/// Worth a look (the owner's pick on the mocks canvas, Nov 15): the
/// computer's Dashboard prompts at the top of Finances' home. A
/// subscription's new price (Update the Plan, or Keep), a bill whose average
/// is off the plan's (Use it, or Keep), and a bill not seen yet (Find It in
/// Transactions). Only what needs you shows; a Keep is remembered on this
/// phone for that amount (`PromptsKept`), so a later change asks again. A
/// device that only looks sees the words without the buttons.
struct WorthALookCard: View {
    @Bindable var finances: FinancesViewModel
    @State private var prices: [FinancePrompts.NewPrice] = []
    @State private var averages: [FinancePrompts.Average] = []
    @State private var missing: [FinancePrompts.Missing] = []
    @State private var busy = false

    var body: some View {
        Group {
            if let view = finances.plan, !shown(view).isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Worth a Look")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .padding(.bottom, 6)
                    ForEach(Array(shown(view).enumerated()), id: \.element.id) { i, row in
                        if i > 0 { Divider() }
                        rowView(row, view)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()
            }
        }
        // Worked out again when the view or the ledger behind it changes.
        .task(id: finances.wholeVersion) {
            guard let whole = finances.wholeView(), let v = await FinancesViewModel.wholeJSON(from: whole) else { return }
            prices = FinancePrompts.newPrices(v)
            averages = FinancePrompts.averages(v)
            missing = FinancePrompts.missingBills(v)
        }
    }

    private struct Row: Identifiable {
        enum Kind { case price(FinancePrompts.NewPrice), average(FinancePrompts.Average), missing(FinancePrompts.Missing) }
        let id: String
        let payment: FinancePayment
        let kind: Kind
    }

    /// What's left to ask: the plan still has the payment, and it isn't kept here.
    private func shown(_ view: FinancesPlanView) -> [Row] {
        var out: [Row] = []
        for p in prices where !finances.isKept(FinancePrompts.keptKey(p)) {
            if let x = view.payment(p.payment) { out.append(Row(id: "price:\(p.payment)", payment: x, kind: .price(p))) }
        }
        for a in averages where !finances.isKept(FinancePrompts.keptKey(a)) {
            if let x = view.payment(a.payment) { out.append(Row(id: "average:\(a.payment)", payment: x, kind: .average(a))) }
        }
        for m in missing {
            if let x = view.payment(m.payment) { out.append(Row(id: "missing:\(m.payment)", payment: x, kind: .missing(m))) }
        }
        return out
    }

    @ViewBuilder
    private func rowView(_ row: Row, _ view: FinancesPlanView) -> some View {
        let currency = view.plan.currency
        let money = { (n: Double) in amountText(n, currency, finances) }
        HStack(alignment: .top, spacing: 12) {
            LogoCircle(payment: row.payment, size: 34)
            VStack(alignment: .leading, spacing: 3) {
                switch row.kind {
                case .price(let p):
                    Text(verbatim: "\(row.payment.name) is now \(money(p.now)), was \(money(p.was)).")
                    Text(verbatim: "Charged \(money(p.now)) on \(Self.day(p.last)) and the time before.")
                        .font(.caption).foregroundStyle(Theme.secondaryInk)
                    if finances.canEditPlan {
                        buttons(title: "Update the Plan", keepTitle: "Keep \(money(p.was))",
                                use: { await finances.usePrompt(payment: p.payment, amount: p.now) },
                                keep: { finances.keepPrompt(FinancePrompts.keptKey(p)) })
                    }
                case .average(let a):
                    Text(verbatim: "\(row.payment.name) has averaged \(money(a.average)) over \(a.months == 1 ? "1 month" : "\(a.months) months").")
                    Text(verbatim: "The plan has \(money(a.planned)), from the last \(a.times) times it was paid.")
                        .font(.caption).foregroundStyle(Theme.secondaryInk)
                    if finances.canEditPlan {
                        buttons(title: "Use \(money(a.average))", keepTitle: "Keep \(money(a.planned))",
                                use: { await finances.usePrompt(payment: a.payment, amount: a.average) },
                                keep: { finances.keepPrompt(FinancePrompts.keptKey(a)) })
                    }
                case .missing(let m):
                    let ago = FinancePrompts.days(from: m.due, to: view.todayText) ?? 0
                    Text(verbatim: "\(row.payment.name) hasn't shown up yet.")
                    Text(verbatim: "It was due \(Self.day(m.due)), \(ago) days ago. Paid before, but nothing in your transactions pays it yet.")
                        .font(.caption).foregroundStyle(Theme.secondaryInk)
                    Button("Find It in Transactions") { IntentInbox.shared.open(.finances(page: .transactions)) }
                        .font(.footnote.weight(.semibold))
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 10)
    }

    private func buttons(title useTitle: String, keepTitle: String, use: @escaping () async -> Bool, keep: @escaping () -> Void) -> some View {
        HStack(spacing: 8) {
            Button(useTitle) {
                busy = true
                Task {
                    _ = await use()
                    busy = false
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accentFill)
            Button(keepTitle) { withAnimation { keep() } }
                .buttonStyle(.bordered)
        }
        .font(.footnote.weight(.semibold))
        .controlSize(.small)
        .disabled(busy)
        .padding(.top, 4)
    }

    private static func day(_ date: String) -> String {
        FinanceCalendar.shown(date).map { $0.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()) } ?? date
    }
}
