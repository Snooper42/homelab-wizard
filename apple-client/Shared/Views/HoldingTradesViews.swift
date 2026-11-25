import SwiftUI

/// A holding's buys and sales as Ghostfolio keeps them, each opening a sheet
/// to put it right or delete it (Parity gap 5, the owner's pick, Nov 14).
/// Only where this device may change Finances; Face ID asks first, and
/// Ghostfolio is read again after.
struct HoldingTradesSection: View {
    let holding: FinanceHolding
    let account: FinanceAccount
    let currency: String
    let finances: FinancesViewModel
    @State private var trades: [InvestmentTrade]?
    @State private var problem: String?
    @State private var editing: InvestmentTrade?

    var body: some View {
        Section {
            if let trades {
                if trades.isEmpty {
                    Text("Ghostfolio has no buys or sales of it in \(account.name).")
                        .foregroundStyle(.secondary)
                }
                ForEach(trades) { t in
                    Button { editing = t } label: {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(verbatim: title(t))
                                    .foregroundStyle(Theme.ink)
                                if let day = t.day {
                                    Text(day, format: .dateTime.month(.abbreviated).day().year())
                                        .font(.caption)
                                        .foregroundStyle(Theme.secondaryInk)
                                }
                            }
                            Spacer(minLength: 8)
                            Money(value: t.total, currency: currency, finances: finances)
                            Image(systemName: "chevron.right").accessibilityHidden(true)
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Change or delete it")
                }
            } else if let problem {
                Text(verbatim: problem).foregroundStyle(Theme.danger)
            } else {
                ProgressView()
            }
        } header: {
            Text("Buys and Sales")
        }
        .task(id: finances.savedCount) { await load() }
        .sheet(item: $editing) { t in
            TradeEditor(trade: t, currency: currency, finances: finances)
        }
    }

    private func load() async {
        switch await finances.trades(of: holding.symbol, in: account.id) {
        case .success(let list):
            trades = list
            problem = nil
        case .failure(let p):
            problem = p.words
        }
    }

    /// "Bought 10 shares", "Sold 2.5 shares".
    private func title(_ t: InvestmentTrade) -> String {
        let n = t.shares.formatted(.number.precision(.fractionLength(0...4)))
        return "\(t.isSale ? "Sold" : "Bought") \(n) \(t.shares == 1 ? "share" : "shares")"
    }
}

/// One buy or sale put right: how many shares, what was paid (or got) in
/// all, the day; or deleted, asked first.
private struct TradeEditor: View {
    let trade: InvestmentTrade
    let currency: String
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var sharesText = ""
    @State private var totalText = ""
    @State private var day = Date()
    @State private var problem: String?
    @State private var confirmingDelete = false

    private var shares: Double? { FinancePlanEdit.parseAmount(sharesText) }
    private var total: Double? { FinancePlanEdit.parseAmount(totalText) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Shares") {
                        TextField("Shares", text: $sharesText)
                            .multilineTextAlignment(.trailing)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .monospacedDigit()
                    }
                    LabeledContent(trade.isSale ? "Got in all" : "Paid in all") {
                        TextField("Amount", text: $totalText)
                            .multilineTextAlignment(.trailing)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .monospacedDigit()
                    }
                    DatePicker("On", selection: $day, in: ...Date(), displayedComponents: .date)
                } footer: {
                    if let problem {
                        Text(verbatim: problem).foregroundStyle(Theme.danger)
                    }
                }
                Section {
                    Button(trade.isSale ? "Delete This Sale" : "Delete This Buy", role: .destructive) { confirmingDelete = true }
                        .frame(maxWidth: .infinity)
                        .disabled(finances.isSaving)
                }
            }
            .navigationTitle(trade.isSale ? "Change Sale" : "Change Buy")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let shares, let total else { problem = "Type the shares and the amount."; return }
                        Task {
                            problem = await finances.changeTrade(trade.changed(shares: shares, total: total, on: day))
                            if problem == nil { dismiss() }
                        }
                    }
                    .disabled(shares == nil || total == nil || finances.isSaving)
                }
            }
            .confirmationDialog(trade.isSale ? "Delete this sale?" : "Delete this buy?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        problem = await finances.deleteTrade(trade)
                        if problem == nil { dismiss() }
                    }
                }
            } message: {
                Text("It's taken out of Ghostfolio, and what the account holds is read again.")
            }
            .onAppear {
                sharesText = trade.shares.formatted(.number.precision(.fractionLength(0...4)).grouping(.never))
                totalText = trade.total.formatted(.number.precision(.fractionLength(0...2)).grouping(.never))
                day = trade.day ?? Date()
            }
        }
        .presentationDetents([.medium, .large])
    }
}
