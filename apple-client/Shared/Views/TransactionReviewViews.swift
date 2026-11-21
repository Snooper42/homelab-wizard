import SwiftUI

/// The top of Transactions while something needs sorting (the owner's yes,
/// Nov 20, on the canvas's *Idea: Sort these on Transactions*), as the
/// computer's: rows that look like a planned payment (Link, Not It, Link
/// All) and pairs that look like a transfer (Join, Not One Transfer, Join
/// All), then Undo for what was just sorted. Only where the ledger may be
/// changed; each saves after Face ID, or waits while away.
struct TransactionReviewSections: View {
    @Bindable var finances: FinancesViewModel
    @State private var busy = false
    @Environment(\.dynamicTypeSize) private var typeSize

    private var currency: String { finances.plan?.plan.currency ?? "USD" }

    var body: some View {
        let review = finances.transactionReview()
        let rows = Dictionary((finances.ledger?.newestFirst ?? []).map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let links = review.links.filter { rows[$0.id] != nil }
        let pairs = review.pairs.filter { rows[$0.out] != nil && rows[$0.into] != nil }
        if let undo = finances.reviewUndo {
            Section {
                HStack {
                    Label(undo.words, systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Theme.success)
                    Spacer(minLength: 8)
                    Button("Undo") { act { await finances.undoReview() } }
                        .buttonStyle(.bordered)
                        .disabled(busy || finances.isSaving)
                }
                .task(id: undo) {
                    try? await Task.sleep(for: .seconds(10))
                    if finances.reviewUndo == undo { finances.dismissReviewUndo() }
                }
            }
        }
        if !links.isEmpty {
            Section {
                ForEach(links) { link in
                    if let t = rows[link.id] { linkRow(link, t) }
                }
            } header: {
                header("These Look Like Planned Payments", all: links.count > 1 ? "Link All \(links.count)" : nil) {
                    act { _ = await finances.linkSuggested(links) }
                }
            } footer: {
                Text("Linked, one counts as paying it, so the plan doesn't take it out again on its day.")
            }
        }
        if !pairs.isEmpty {
            Section {
                ForEach(pairs) { pair in
                    if let out = rows[pair.out], let into = rows[pair.into] { pairRow(pair, out, into) }
                }
            } header: {
                header("These Look Like Transfers", all: pairs.count > 1 ? "Join All \(pairs.count)" : nil) {
                    act { _ = await finances.join(pairs) }
                }
            } footer: {
                Text("Money out of one of your accounts and the same into another: joined, it's one transfer, neither spending nor income.")
            }
        }
    }

    private func act(_ work: @escaping @MainActor () async -> Void) {
        guard !busy else { return }
        busy = true
        Task {
            await work()
            busy = false
        }
    }

    private func header(_ title: String, all: String?, _ run: @escaping () -> Void) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).foregroundStyle(Theme.secondaryInk)
                Spacer(minLength: 8)
                if let all { Button(all, action: run).disabled(busy || finances.isSaving) }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(title).foregroundStyle(Theme.secondaryInk)
                if let all { Button(all, action: run).disabled(busy || finances.isSaving) }
            }
        }
        .textCase(nil)
        // At the largest text the heading took the whole screen in a faint grey
        // (large-transactions): no larger than the first accessibility size.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
    }

    private func linkRow(_ link: TransactionReview.Link, _ t: FinanceTransaction) -> some View {
        let payment = finances.plan?.plan.payments.first { $0.id == link.payment }
        let name = payment?.name ?? "a planned payment"
        let planned = payment?.amount.map { " \(amountText($0, currency, finances))" } ?? ""
        let due = LocalDay.parse(link.due)?.formatted(.dateTime.month(.abbreviated).day()) ?? link.due
        return VStack(alignment: .leading, spacing: 8) {
            rowLayout {
                LogoCircle(payee: t.payee, institution: t.institution, size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: t.payee.isEmpty ? "No payee" : t.payee).font(.subheadline.weight(.semibold))
                    Text(verbatim: "\(dayText(t.date)) · looks like \(name), planned\(planned) for \(due)")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                if !typeSize.isAccessibilitySize { Spacer(minLength: 8) }
                Money(value: t.amount, currency: currency, finances: finances, signed: true)
                    .font(.subheadline).monospacedDigit()
            }
            .accessibilityElement(children: .combine)
            HStack(spacing: 8) {
                Button("Link") { act { _ = await finances.linkSuggested([link]) } }
                    .buttonStyle(.bordered).tint(Theme.accent)
                    .accessibilityLabel("Link \(t.payee) to \(name)")
                Button("Not It") { act { _ = await finances.notIt(link) } }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("\(t.payee) is not \(name)")
            }
            .disabled(busy || finances.isSaving)
            .padding(.leading, typeSize.isAccessibilitySize ? 0 : 46)
        }
        .padding(.vertical, 2)
    }

    private func pairRow(_ pair: TransactionReview.Pair, _ out: FinanceTransaction, _ into: FinanceTransaction) -> some View {
        let from = accountName(out.account), to = accountName(into.account)
        return VStack(alignment: .leading, spacing: 8) {
            rowLayout {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Theme.success, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: "\(from) → \(to)").font(.subheadline.weight(.semibold))
                    Text(verbatim: "\(out.payee.isEmpty ? "Out" : out.payee), \(dayText(out.date)) · \(into.payee.isEmpty ? "in" : into.payee), \(dayText(into.date))")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                if !typeSize.isAccessibilitySize { Spacer(minLength: 8) }
                Money(value: -out.amount, currency: currency, finances: finances)
                    .font(.subheadline).monospacedDigit()
            }
            .accessibilityElement(children: .combine)
            HStack(spacing: 8) {
                Button("Join") { act { _ = await finances.join([pair]) } }
                    .buttonStyle(.bordered).tint(Theme.accent)
                    .accessibilityLabel("Join, from \(from) to \(to)")
                Button("Not One Transfer") { act { _ = await finances.notOneTransfer(pair) } }
                    .buttonStyle(.bordered)
            }
            .disabled(busy || finances.isSaving)
            .padding(.leading, typeSize.isAccessibilitySize ? 0 : 46)
        }
        .padding(.vertical, 2)
    }

    /// A row's logo, words and amount side by side; at the largest text one
    /// under another, so the payee isn't broken mid-word ("Cost- co",
    /// large-transactions).
    private func rowLayout<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 6))
                                      : AnyLayout(HStackLayout(spacing: 12))) {
            content()
        }
    }

    private func accountName(_ id: String) -> String {
        finances.plan?.plan.accounts.first { $0.id == id }?.name ?? id
    }

    private func dayText(_ d: Date?) -> String {
        d?.formatted(.dateTime.month(.abbreviated).day()) ?? ""
    }
}
