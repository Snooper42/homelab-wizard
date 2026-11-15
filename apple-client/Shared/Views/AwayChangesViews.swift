import SwiftUI

// Changes made to Finances away from home (offline Finances 2 of 3, the
// owner's "build it out", Nov 14): the banner that says they wait, their list
// with Undo, "Sent" once home, and the one question, when another device
// changed the same thing differently.

/// A change in words, with names from the plan: "Electric: $95.00 each time".
@MainActor
func awayWords(_ change: FinanceChange, view: FinancesPlanView?, finances: FinancesViewModel) -> String {
    let currency = view?.plan.currency ?? "USD"
    func money(_ v: Double) -> String { amountText(v, currency, finances) }
    switch change {
    case .balance(let account, let to, _, _):
        let name = view?.plan.accounts.first { $0.id == account }?.name ?? "An account"
        return "\(name)'s balance: \(money(to))"
    case .cushion(let to, _):
        return "The cushion: \(money(to))"
    case .budget(let category, let to, _):
        return "The \(category) budget: \(money(to))"
    case .goalTarget(let id, let to, _):
        let name = view?.goals.first { $0.id == id }?.name ?? "A goal"
        return "\(name): \(money(to))"
    case .paymentAmount(let id, let to, _):
        let name = view?.paymentTitle(id) ?? "A payment"
        return "\(name): \(money(to)) each time"
    case .waiting(_, let waiting):
        return waiting ? "Marked as not in the balances yet" : "Marked as in the balances"
    case .addAccount(let name, _, _, _):
        return "Added \(name)"
    case .addPayment(let name, let amount, _, _, _, _, _):
        return "Added \(name), \(money(amount))"
    case .addGoal(let name, _, _, _, _):
        return "Added the goal \(name)"
    case .addNewPayment(let p):
        return "Added \(p.name), \(money(p.amount))"
    }
}

/// Over Finances away from home, where changes can be made: when what's
/// shown was read, and what waits for the Homelab (it opens their list).
struct AwayBanner: View {
    let asOf: Date
    @Bindable var finances: FinancesViewModel
    @State private var listing = false

    private var waiting: Int { finances.awayCount }

    var body: some View {
        Button { listing = true } label: {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: "wifi.slash")
                    .foregroundStyle(Theme.secondaryInk)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: OfflineFinances.asOf(asOf))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text(verbatim: waiting == 0
                         ? "The Homelab isn't answering, so this device works out today's Finances. Changes stay here and go to the Homelab once it answers."
                         : waiting == 1 ? "1 change waits for the Homelab." : "\(waiting) changes wait for the Homelab.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryInk)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                if waiting > 0 {
                    Image(systemName: "chevron.right").accessibilityHidden(true)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(waiting == 0)
        .sheet(isPresented: $listing) {
            AwayChangesList(finances: finances)
        }
    }
}

/// A transaction's change in words: "Added Example Bakery, $12.50".
@MainActor
func awayWords(_ change: LedgerChange, finances: FinancesViewModel) -> String {
    let currency = finances.plan?.plan.currency ?? "USD"
    func payee(_ id: String) -> String {
        finances.ledger?.newestFirst.first { $0.id == id }?.payee ?? "A transaction"
    }
    switch change {
    case .add(let t): return "Added \(t.payee.trimmingCharacters(in: .whitespaces)), \(amountText(t.amount, currency, finances))"
    case .update(_, let t): return "Changed \(t.payee.trimmingCharacters(in: .whitespaces))"
    case .category(let id, let to): return to.isEmpty ? "\(payee(id)): no category" : "\(payee(id)): \(to)"
    case .delete(let id): return "Deleted \(payee(id))"
    case .move(let id, let to):
        let name = finances.plan?.plan.accounts.first { $0.id == to }?.name ?? "another account"
        return "\(payee(id)): moved to \(name)"
    case .fix(let id, let fix):
        return fix.payee.map { "\(payee(id)): now \($0)" } ?? "\(payee(id)): \(fix.category ?? "fixed")"
    }
}

/// What waits for the Homelab, each with Undo.
struct AwayChangesList: View {
    @Bindable var finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(Array(finances.awayChanges.enumerated()), id: \.offset) { i, change in
                        Text(verbatim: awayWords(change, view: finances.plan, finances: finances))
                            .swipeActions {
                                Button("Undo", role: .destructive) { Task { await finances.undoAway(at: i) } }
                            }
                    }
                    ForEach(Array(finances.awayLedger.enumerated()), id: \.offset) { i, change in
                        Text(verbatim: awayWords(change, finances: finances))
                            .swipeActions {
                                Button("Undo", role: .destructive) { Task { await finances.undoAwayLedger(at: i) } }
                            }
                    }
                } footer: {
                    Text("They go to the Homelab by themselves once it answers. Swipe one to undo it.")
                }
            }
            .navigationTitle("Waiting")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onChange(of: finances.awayCount) { _, count in if count == 0 { dismiss() } }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Once home: what was sent, and what couldn't be (what it changed was gone).
struct AwaySentCard: View {
    let sent: Int
    let dropped: Int
    let dismiss: @MainActor () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Theme.success)
            Text(verbatim: line)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.ink)
            Spacer(minLength: 8)
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Dismiss")
        }
        .padding(14)
        .card()
    }

    private var line: String {
        let s = sent == 1 ? "Sent 1 change to the Homelab." : "Sent \(sent) changes to the Homelab."
        guard dropped > 0 else { return s }
        return s + (dropped == 1 ? " 1 couldn't go: what it changed was removed on another device."
                                 : " \(dropped) couldn't go: what they changed was removed on another device.")
    }
}

/// Asks which to keep when another device changed the same thing differently.
struct AwayClashSheet: ViewModifier {
    @Bindable var finances: FinancesViewModel

    func body(content: Content) -> some View {
        content.sheet(item: Binding(get: { finances.awayClashes.first }, set: { _ in })) { clash in
            NavigationStack {
                Form {
                    Section {
                        LabeledContent("On this device") {
                            Text(verbatim: awayWords(clash.change, view: finances.plan, finances: finances))
                        }
                        LabeledContent("On another device") {
                            Text(verbatim: clash.theirs.map { amountText($0, finances.plan?.plan.currency ?? "USD", finances) } ?? "Removed")
                        }
                    } footer: {
                        Text("Both changed this while this device was away. Pick the one to keep; the rest of what waited goes as it is.")
                    }
                    Section {
                        Button("Keep This Device's") { Task { await finances.decide(clash, keepMine: true) } }
                        Button("Keep the Other Device's") { Task { await finances.decide(clash, keepMine: false) } }
                    }
                }
                .navigationTitle("Changed Twice")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
            }
            .interactiveDismissDisabled()
            .presentationDetents([.medium])
        }
    }
}
