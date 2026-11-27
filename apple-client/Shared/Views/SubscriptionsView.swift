import SwiftUI

/// Status › Subscriptions: what the apps save, where it comes from, what more could be saved, then each paid service
/// replaced now as a tile, and the ones that could be, faded.
struct SubscriptionsPage: View {
    let model: DashboardViewModel

    var body: some View {
        let apps = model.liveEvents.status?.apps ?? []
        let running = Set(apps.filter(\.isRunning).map(\.id))
        let summary = model.cards.offers.map { SubscriptionsSummary.from(offers: $0, running: running, catalog: model.catalog) }
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let summary {
                    Text(verbatim: summary.lead)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12, alignment: .top)], spacing: 12) {
                        whereFrom(summary)
                        if summary.could > 0 { couldSave(summary) }
                    }
                    TileShelf(title: "Replaced now", offers: summary.now, faded: false, model: model)
                    if !summary.more.isEmpty {
                        TileShelf(title: "Could replace too", offers: summary.more, faded: true, model: model)
                            .padding(.top, 8)
                    }
                } else if let error = model.cards.offersError {
                    Text(verbatim: error)
                        .font(.subheadline)
                        .foregroundStyle(Theme.danger)
                } else {
                    Text("Reading the prices…")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .themedCanvas()
        .navigationTitle("Subscriptions")
        .task { await model.cards.readOffers() }
    }

    /// Where it comes from: each kind of app's share of the year, as a bar and a legend.
    private func whereFrom(_ s: SubscriptionsSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Where it comes from")
                .font(.headline)
                .foregroundStyle(Theme.ink)
            if s.year > 0 {
                GeometryReader { geo in
                    HStack(spacing: 2) {
                        ForEach(Array(s.parts.enumerated()), id: \.element.id) { i, part in
                            Rectangle()
                                .fill(Self.tone(i))
                                .frame(width: max(2, (geo.size.width - CGFloat(s.parts.count - 1) * 2) * part.amount / s.year))
                        }
                    }
                    .clipShape(Capsule())
                }
                .frame(height: 10)
                .accessibilityElement()
                .accessibilityLabel(Text(verbatim: s.parts.map { "\($0.label) \(SubscriptionsSummary.dollars($0.amount))" }.joined(separator: ", ")))
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                    ForEach(Array(s.parts.enumerated()), id: \.element.id) { i, part in
                        HStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 2).fill(Self.tone(i)).frame(width: 10, height: 10)
                            Text(verbatim: part.label).lineLimit(1).minimumScaleFactor(0.8)
                            Spacer(minLength: 4)
                            Text(verbatim: SubscriptionsSummary.dollars(part.amount)).fontWeight(.semibold).monospacedDigit()
                        }
                        .font(.subheadline)
                        .foregroundStyle(Theme.ink)
                    }
                }
                .accessibilityHidden(true)
            } else {
                Text("None of your apps replaces a paid service yet.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    /// Could save more: the three dearest the apps you don't run could replace.
    private func couldSave(_ s: SubscriptionsSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(verbatim: "Could save \(SubscriptionsSummary.dollars(s.could)) more a year")
                .font(.headline)
                .foregroundStyle(Theme.ink)
            let next = Array(s.more.prefix(3))
            ForEach(Array(next.enumerated()), id: \.offset) { i, o in
                HStack(spacing: 12) {
                    AppLogo(id: o.apps.first, size: 36)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(verbatim: o.apps.map(name).joined(separator: " + "))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text(verbatim: o.replaces)
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryInk)
                            .lineLimit(2)
                    }
                    Spacer(minLength: 8)
                    Text(verbatim: SubscriptionsSummary.dollars(o.annual))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                }
                .accessibilityElement(children: .combine)
                if i < next.count - 1 { Divider() }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func name(_ id: String) -> String { model.app(id: id)?.name ?? model.catalog?.entry(id)?.name ?? id }

    /// The kinds' colours, in the computer's order (`--cat-1` on).
    static func tone(_ i: Int) -> Color { Design.category(i % 8 + 1)?.base ?? TileColour.grey }
}

/// "Replaced now 27" and its tiles.
private struct TileShelf: View {
    let title: String
    let offers: [SubscriptionOffer]
    let faded: Bool
    let model: DashboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text(verbatim: title).font(.headline).foregroundStyle(Theme.ink)
                Text(verbatim: "\(offers.count)").font(.subheadline).monospacedDigit().foregroundStyle(Theme.secondaryInk)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            if offers.isEmpty {
                Text("None of your apps replaces a paid service yet.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12, alignment: .top)], spacing: 12) {
                    ForEach(Array(offers.enumerated()), id: \.offset) { _, o in
                        ServiceTile(offer: o, faded: faded, model: model)
                    }
                }
            }
        }
    }
}

/// One paid service: its logo and name, its kind, its price a month and a year, and the apps that replace it, each
/// opening its page.
private struct ServiceTile: View {
    let offer: SubscriptionOffer
    let faded: Bool
    let model: DashboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                LogoCircle(payee: offer.service, size: 48)
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: offer.service)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .lineLimit(2)
                    Text(verbatim: offer.kind)
                        .pill(offer.kind == "Direct" ? Theme.success : Theme.secondaryInk)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(verbatim: SubscriptionsSummary.money(offer.monthly))
                    .font(.title.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text("a month")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryInk)
            }
            Text(verbatim: "\(SubscriptionsSummary.dollars(offer.annual)) a year")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryInk)
            Divider()
            Text(faded ? "Could be" : "Replaced by")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryInk)
            ForEach(offer.apps, id: \.self) { id in
                if !faded, let app = model.app(id: id) {
                    NavigationLink(value: StatusPlace.app(id)) {
                        HStack(spacing: 8) {
                            AppIconView(app: app, size: 28, stateBadge: false)
                            Text(verbatim: app.name).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                } else {
                    HStack(spacing: 8) {
                        AppLogo(id: id, size: 28)
                        Text(verbatim: model.catalog?.entry(id)?.name ?? id).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
        .opacity(faded ? 0.6 : 1)
    }
}

/// Subscriptions' row on the Overview: its symbol, its name, and what the apps save.
struct SubscriptionsRow: View {
    let model: DashboardViewModel

    var body: some View {
        let running = Set((model.liveEvents.status?.apps ?? []).filter(\.isRunning).map(\.id))
        let summary = model.cards.offers.map { SubscriptionsSummary.from(offers: $0, running: running, catalog: model.catalog) }
        HStack(spacing: 12) {
            Image(systemName: "dollarsign.circle")
                .font(.title3)
                .foregroundStyle(Theme.accent)
                .frame(width: 30)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("Subscriptions")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                if let summary {
                    Text(verbatim: "\(SubscriptionsSummary.dollars(summary.year)) a year")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryInk)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .task { await model.cards.readOffers() }
    }
}
