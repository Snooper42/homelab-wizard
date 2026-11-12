import SwiftUI

/// Investments' Watchlist (the owner, Nov 12), as the computer's card has it:
/// tickers followed without owning them, each with its price as last read and
/// how far it has moved since it was followed; never counted in the worth.
/// Follow a Ticker looks one up in Ghostfolio and follows it, after Face ID;
/// swipe, or the menu, to unfollow. A phone that may only look sees the list.
struct WatchlistCard: View {
    let view: FinancesPlanView
    let finances: FinancesViewModel
    @State private var adding = false
    @State private var problem: String?

    var body: some View {
        let list = view.plan.watch
        if !list.isEmpty || finances.canEdit {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Watchlist")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    if finances.canEdit {
                        Button("Follow a Ticker") { adding = true }
                            .font(.subheadline.weight(.semibold))
                    }
                }
                Text("Followed, not owned: priced by Ghostfolio at each read, never counted in your worth.")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
                    .padding(.bottom, 6)
                if list.isEmpty {
                    Text("Follow a ticker to see its price here without owning it.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
                ForEach(Array(list.enumerated()), id: \.element.id) { i, w in
                    if i > 0 { Divider().padding(.leading, 54) }
                    row(w)
                }
                if let problem {
                    Text(verbatim: problem)
                        .font(.footnote)
                        .foregroundStyle(Theme.danger)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .card(radius: 24)
            .sheet(isPresented: $adding) { FollowTickerView(finances: finances) }
        }
    }

    private func row(_ w: FinanceWatched) -> some View {
        HStack(spacing: 12) {
            LogoCircle(payee: w.symbol, size: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: w.symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(verbatim: w.name.isEmpty ? Self.sinceWords(w) : "\(w.name) · \(Self.sinceWords(w))")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryInk)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(w.price, format: .currency(code: w.currency ?? view.plan.currency))
                    .font(.body.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                if let change = w.changeSince {
                    Text(verbatim: Self.changeWords(change))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(change < 0 ? Theme.danger : Theme.success)
                }
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .contextMenu {
            if finances.canEdit {
                Button("Unfollow \(w.symbol)", systemImage: "minus.circle", role: .destructive) {
                    Task { problem = await finances.unfollow(w.symbol) ? nil : (finances.saveError ?? "Couldn't take it off.") }
                }
            }
        }
    }

    /// "followed since Oct 2", or "followed today".
    static func sinceWords(_ w: FinanceWatched) -> String {
        guard let since = w.since else { return "followed today" }
        return "followed since " + since.formatted(.dateTime.month(.abbreviated).day())
    }

    /// "+6.0%" or "−3.2%": how far it has moved since it was followed.
    static func changeWords(_ change: Double) -> String {
        (change < 0 ? "−" : "+") + String(format: "%.1f%%", abs(change * 100))
    }
}

/// Follow a Ticker: what's typed looked up in Ghostfolio, and one picked followed.
private struct FollowTickerView: View {
    let finances: FinancesViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var found: [InvestmentSymbol] = []
    @State private var looking = false
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Ticker or name", text: $query)
                        .autocorrectionDisabled()
                        #if os(iOS)
                        .textInputAutocapitalization(.characters)
                        #endif
                        .onSubmit { Task { await look() } }
                    Button(looking ? "Looking…" : "Look It Up") { Task { await look() } }
                        .disabled(looking || query.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                if !found.isEmpty {
                    Section("Found") {
                        ForEach(found) { s in
                            Button {
                                Task {
                                    problem = await finances.follow(s)
                                    if problem == nil { dismiss() }
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(verbatim: s.symbol).font(.body.weight(.semibold))
                                    Text(verbatim: s.name).font(.caption).foregroundStyle(Theme.secondaryInk)
                                }
                            }
                            .disabled(finances.isSaving)
                        }
                    }
                }
                if let problem {
                    Section { Text(verbatim: problem).foregroundStyle(Theme.danger) }
                }
            }
            .navigationTitle("Follow a Ticker")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }

    private func look() async {
        looking = true
        defer { looking = false }
        do {
            found = try await finances.findSymbols(query)
            problem = found.isEmpty ? "Ghostfolio found nothing by that." : nil
        } catch {
            problem = APIError.from(error).errorDescription ?? "Ghostfolio couldn't look it up."
        }
    }
}
