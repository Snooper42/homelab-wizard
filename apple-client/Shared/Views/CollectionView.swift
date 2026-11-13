import SwiftUI

/// The Collection (the owner's mockup, Nov 13): what the cards are worth
/// now and the gain on what was paid, then each card with its picture,
/// what it's worth and its gain; a card opens its own page, large. Update
/// Prices (a phone allowed to change Finances) has the computer read
/// TCGplayer's prices from TCGdex, after Face ID.
struct FinanceCollectionPage: View {
    @Bindable var finances: FinancesViewModel

    var body: some View {
        Form {
            if let view = finances.plan {
                let cards = view.plan.collection
                let worth = cards.reduce(0) { $0 + $1.worth }
                let paid = cards.reduce(0) { $0 + $1.paidTotal }
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(cards.count == 1 ? "1 Card" : "\(cards.count) Cards")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Money(value: worth, currency: view.plan.currency, finances: finances)
                            .font(.largeTitle.bold())
                        if let gain = FinanceCollected.gain(worth: cards.filter { $0.paid > 0 }.reduce(0) { $0 + $1.worth }, paid: paid) {
                            HStack(spacing: 4) {
                                Text(gain, format: .percent.precision(.fractionLength(0)).sign(strategy: .always()))
                                    .foregroundStyle(gain < 0 ? Theme.danger : Theme.success)
                                    .fontWeight(.semibold)
                                Text("on the")
                                Money(value: paid, currency: view.plan.currency, finances: finances)
                                Text("you paid")
                            }
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        }
                        Text("Counted in your net worth.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                }
                Section {
                    ForEach(cards) { card in
                        NavigationLink {
                            FinanceCardPage(finances: finances, cardID: card.id)
                        } label: {
                            CardRow(card: card, currency: view.plan.currency, finances: finances)
                        }
                    }
                } footer: {
                    if let said = finances.pricesSaid {
                        Text(verbatim: said)
                    } else if finances.canEdit {
                        Text("Update Prices reads TCGplayer's prices from TCGdex, sending only each card's name: never what you paid or how many.")
                    }
                }
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .refreshable { await finances.loadPlan() }
        .navigationTitle("Collection")
        .toolbar {
            if finances.canEdit {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await finances.updatePrices() }
                    } label: {
                        if finances.isUpdatingPrices { ProgressView() } else { Text("Update Prices") }
                    }
                    .disabled(finances.isUpdatingPrices || finances.plan?.plan.collection.isEmpty != false)
                }
            }
        }
    }
}

/// One card's row: its picture, its name and printing, what it's worth and its gain.
private struct CardRow: View {
    let card: FinanceCollected
    let currency: String
    let finances: FinancesViewModel

    var body: some View {
        HStack(spacing: 12) {
            CardPicture(card: card, finances: finances, width: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: card.name)
                    .font(.body.weight(.medium))
                Text(verbatim: card.line)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Money(value: card.worth, currency: currency, finances: finances)
                    .fontWeight(.semibold)
                if let gain = FinanceCollected.gain(worth: card.worth, paid: card.paidTotal) {
                    Text(gain, format: .percent.precision(.fractionLength(0)).sign(strategy: .always()))
                        .font(.caption)
                        .foregroundStyle(gain < 0 ? Theme.danger : Theme.success)
                }
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

/// A card's picture, read from the computer (never fetched from anywhere
/// else), or a plain placeholder until it has one.
struct CardPicture: View {
    let card: FinanceCollected
    let finances: FinancesViewModel
    let width: CGFloat
    @State private var image: CGImage?

    var body: some View {
        Group {
            if let image {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "rectangle.portrait")
                    .font(.system(size: width * 0.4))
                    .foregroundStyle(Theme.secondaryInk)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.canvas)
            }
        }
        .frame(width: width, height: width * 88 / 63)
        .clipShape(RoundedRectangle(cornerRadius: width > 100 ? 14 : 4))
        .overlay(RoundedRectangle(cornerRadius: width > 100 ? 14 : 4).strokeBorder(Theme.separator))
        .accessibilityLabel(image == nil ? "\(card.name): no picture yet" : card.name)
        .task(id: card.picture) {
            image = nil
            guard let name = card.picture, let data = await finances.cardPicture(name) else { return }
            image = LogoCircle.cgImage(data)
        }
    }
}

/// A card opened large: its picture, what it's worth with its gain and its
/// price over time, then how many, what was paid and where it's counted.
struct FinanceCardPage: View {
    @Bindable var finances: FinancesViewModel
    let cardID: String
    @State private var points: [FinancePoint] = []
    @State private var picked: Date?

    var body: some View {
        Form {
            if let view = finances.plan, let card = view.plan.collection.first(where: { $0.id == cardID }) {
                Section {
                    VStack(spacing: 12) {
                        CardPicture(card: card, finances: finances, width: 220)
                        Text(verbatim: card.name)
                            .font(.title2.bold())
                        Text(verbatim: card.line)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                Section("Worth Now") {
                    HStack(alignment: .firstTextBaseline) {
                        Money(value: card.worth, currency: view.plan.currency, finances: finances)
                            .font(.title.bold())
                        Spacer()
                        if let gain = FinanceCollected.gain(worth: card.worth, paid: card.paidTotal) {
                            Text(gain, format: .percent.precision(.fractionLength(0)).sign(strategy: .always()))
                                .foregroundStyle(gain < 0 ? Theme.danger : Theme.success)
                                .fontWeight(.semibold)
                        }
                    }
                    let series = points.compactMap { p in p.date.map { NetWorthPoint(date: $0, value: p.amount) } }
                    if series.count > 1, finances.amountsShown, !finances.amountsHiddenByPlan {
                        TrendChart(series: series, picked: $picked)
                            .frame(height: 140)
                            .accessibilityLabel("\(card.name)'s price on each day it was read")
                    }
                }
                Section("About It") {
                    LabeledContent("How Many", value: "\(card.count)")
                    LabeledContent("Paid") {
                        if card.paid > 0 { Money(value: card.paid, currency: view.plan.currency, finances: finances) } else { Text("Not typed in") }
                    }
                    LabeledContent("Its Price", value: card.typed ? "Your own: never looked up" : card.ref == nil ? "Typed in" : "TCGplayer's, from TCGdex")
                    LabeledContent("Counted In", value: finances.accountName(card.account) ?? "Net worth")
                }
            } else {
                ContentUnavailableView("Card Not Found", systemImage: "rectangle.portrait", description: Text("It's no longer in the Collection."))
            }
        }
        .formStyle(.grouped)
        .themedCanvas()
        .navigationTitle("Card")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task(id: finances.plan?.plan.collection.first(where: { $0.id == cardID })?.priceOnText) {
            points = await finances.cardPrices()[cardID] ?? []
        }
    }
}
