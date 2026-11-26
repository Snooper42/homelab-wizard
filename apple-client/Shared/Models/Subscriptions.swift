import Foundation

// Status › Subscriptions, as the computer's (web/src/status/Subscriptions.tsx): each paid service the apps you run
// stand in for, once, at its price (docs/Savings.md through `SavingsRows`), then what more the others could replace.
// Library services (a saving only if you own the media) stay out of the total.

/// One row of docs/Savings.md (`savings.Offer`): the apps that together replace a paid service, and its price.
struct SubscriptionOffer: Decodable, Sendable, Equatable {
    /// The apps that together replace it, by id.
    var apps: [String]
    let replaces: String
    /// Direct (the same thing), Equivalent (does the same job) or Library (only if you own the media).
    let kind: String
    var monthly: Double
    let annual: Double
    /// What it takes for the saving to be real.
    let condition: String
    /// The row the computer counts for its service.
    let counted: Bool

    enum CodingKeys: String, CodingKey { case apps, replaces, kind, monthly, annual, condition, counted }

    init(apps: [String], replaces: String, kind: String, monthly: Double, annual: Double, condition: String = "", counted: Bool = true) {
        self.apps = apps
        self.replaces = replaces
        self.kind = kind
        self.monthly = monthly
        self.annual = annual
        self.condition = condition
        self.counted = counted
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        apps = try c.decodeIfPresent([String].self, forKey: .apps) ?? []
        replaces = try c.decodeIfPresent(String.self, forKey: .replaces) ?? ""
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? ""
        monthly = try c.decodeIfPresent(Double.self, forKey: .monthly) ?? 0
        annual = try c.decodeIfPresent(Double.self, forKey: .annual) ?? 0
        condition = try c.decodeIfPresent(String.self, forKey: .condition) ?? ""
        counted = try c.decodeIfPresent(Bool.self, forKey: .counted) ?? false
    }

    /// The service by its name, without the note in brackets: "Spotify Premium Family".
    var service: String {
        replaces.replacingOccurrences(of: #"\s*\(.*\)$"#, with: "", options: .regularExpression)
    }

    var isLibrary: Bool { kind == "Library" }
}

/// The page's figures and lists, from the offers and the apps running, so they can be tested without a screen.
struct SubscriptionsSummary: Equatable {
    /// Each paid service replaced now, dearest first.
    let now: [SubscriptionOffer]
    /// Each one the apps you don't run could replace, dearest first.
    let more: [SubscriptionOffer]
    /// The counted services (Library apart): a year, a month, how many.
    let year: Double
    let month: Double
    let counted: Int
    /// What the apps you don't run could save more a year (Library apart).
    let could: Double
    /// Where the year comes from: each catalog category's share, largest first.
    let parts: [Part]

    struct Part: Equatable, Identifiable {
        let id: String
        let label: String
        let amount: Double
    }

    static func from(offers: [SubscriptionOffer], running: Set<String>, catalog: AppCatalog?) -> SubscriptionsSummary {
        // A service priced only by the year is a twelfth of it a month.
        let all = offers.filter { $0.annual.isFinite }.map { o -> SubscriptionOffer in
            var o = o
            if !(o.monthly.isFinite && o.monthly > 0) { o.monthly = o.annual / 12 }
            return o
        }
        .enumerated().sorted { $0.element.annual != $1.element.annual ? $0.element.annual > $1.element.annual : $0.offset < $1.offset }
        .map(\.element)
        func runs(_ o: SubscriptionOffer) -> Bool { o.apps.allSatisfy(running.contains) }
        let now = perService(all.filter(runs))
        let replaced = Set(now.map(key))
        let more = perService(all.filter { !runs($0) && !replaced.contains(key($0)) })
        let counted = now.filter { !$0.isLibrary }
        let year = counted.reduce(0) { $0 + $1.annual }
        var byCategory: [(id: String, amount: Double)] = []
        for o in counted {
            let id = o.apps.first.flatMap { catalog?.entry($0)?.category } ?? "other"
            if let i = byCategory.firstIndex(where: { $0.id == id }) { byCategory[i].amount += o.annual } else { byCategory.append((id, o.annual)) }
        }
        let parts = byCategory.enumerated()
            .sorted { $0.element.amount != $1.element.amount ? $0.element.amount > $1.element.amount : $0.offset < $1.offset }
            .map { item in
                Part(id: item.element.id, label: catalog?.categories.first(where: { $0.id == item.element.id })?.label ?? "Your own", amount: item.element.amount)
            }
        return SubscriptionsSummary(
            now: now, more: more, year: year, month: counted.reduce(0) { $0 + $1.monthly }, counted: counted.count,
            could: more.filter { !$0.isLibrary }.reduce(0) { $0 + $1.annual }, parts: parts)
    }

    /// Two apps that replace one service count it once: by its name, whatever its note or case.
    static func key(_ o: SubscriptionOffer) -> String { o.service.trimmingCharacters(in: .whitespaces).lowercased() }

    /// One offer per service with every app that stands in for it; its price and kind the counted row's, else the
    /// dearest's (`perService`).
    static func perService(_ list: [SubscriptionOffer]) -> [SubscriptionOffer] {
        var order: [String] = []
        var out: [String: SubscriptionOffer] = [:]
        for o in list {
            let k = key(o)
            guard var had = out[k] else {
                order.append(k)
                out[k] = o
                continue
            }
            var apps = had.apps
            for id in o.apps where !apps.contains(id) { apps.append(id) }
            if o.counted && !had.counted { had = o }
            had.apps = apps
            out[k] = had
        }
        return order.compactMap { out[$0] }
    }

    /// The line under the title: "$1,457 a year · $150 a month".
    var lead: String { "\(Self.money(year)) a year · \(Self.money(month)) a month" }

    /// "$1,457", "$21.99", as the computer writes them.
    static func money(_ n: Double) -> String {
        n >= 100 ? "$" + Int(n.rounded()).formatted(.number.locale(Locale(identifier: "en_US"))) : "$" + String(format: "%.2f", n)
    }
}
