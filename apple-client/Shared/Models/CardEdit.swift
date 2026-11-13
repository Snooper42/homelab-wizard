import Foundation

/// A card as Add a Card holds it while it's typed in (the computer's
/// `finance.Collected`, less what only the computer sets).
struct CardDraft: Equatable, Sendable {
    var name = ""
    var set = ""
    var number = ""
    /// Its condition or grade, as the household says it: "Near mint", "Graded 9".
    var grade = ""
    var count = 1
    /// What one cost (0: not typed in), on `paidOn` (YYYY-MM-DD).
    var paid = 0.0
    var paidOn: String?
    /// What one is worth now; `typed`, kept at this price and never looked up.
    var price = 0.0
    var typed = false
    /// Its picture's name on the computer (SaveFinancesCardPicture gives it).
    var picture: String?

    init() {}

    init(_ card: FinanceCollected) {
        name = card.name
        set = card.set ?? ""
        number = card.number ?? ""
        grade = card.grade ?? ""
        count = card.count
        paid = card.paid
        paidOn = card.paidOnText
        price = card.price
        typed = card.typed
        picture = card.picture
    }

    /// The longest side a card's photo is sent at (as the computer's form does).
    static let photoPixels = 800

    /// A card picture's name as the computer gives one (`finance.pictureName`):
    /// its content's hash and kind, nothing that could reach outside its folder.
    static func isPictureName(_ name: String) -> Bool {
        let parts = name.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 2, ["jpg", "png", "webp"].contains(String(parts[1])) else { return false }
        return parts[0].count == 32 && parts[0].allSatisfy { $0.isHexDigit && ($0.isNumber || $0.isLowercase) }
    }
}

extension FinancePlanEdit {
    /// As long as a card's name, set, number or grade may be
    /// (`finance.maxCollectedText`), and as many of one as are kept.
    static let maxCardText = 120
    static let maxCardCount = 99_999

    /// What's wrong with `draft`, in words for the form, or nil when the
    /// computer would keep it.
    static func cardProblem(_ draft: CardDraft) -> String? {
        let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty { return "Give it a name: what's on the card." }
        if [name, draft.set, draft.number, draft.grade].contains(where: { $0.trimmingCharacters(in: .whitespacesAndNewlines).count > maxCardText }) {
            return "A name, set, number or grade is at most \(maxCardText) letters."
        }
        if draft.count < 1 || draft.count > maxCardCount { return "How many: 1 or more." }
        for amount in [draft.paid, draft.price] {
            if !amount.isFinite || amount < 0 { return "A price is nothing or more." }
            if amount * Double(draft.count) >= maxBalance { return "That's more than the computer keeps." }
        }
        if let day = draft.paidOn, LocalDay.parse(day) == nil { return "Paid on isn't a day." }
        if let picture = draft.picture, !CardDraft.isPictureName(picture) { return "That photo isn't one the computer kept." }
        return nil
    }

    /// `plan` with the card `id` changed to `draft`, or with a new card
    /// when `id` is nil (the computer gives it its id). A new card goes in
    /// the collectible account that holds cards already, else a new
    /// Pokémon cards account; never one whose worth was typed in, which
    /// the cards' total would replace. What the form doesn't show (TCGdex's
    /// id, anything newer) is kept. A price changed here is set `today`.
    /// Nil for a draft the computer would refuse, or an unknown card.
    static func settingCard(id: String?, to draft: CardDraft, today: String, in plan: JSONValue) -> JSONValue? {
        guard cardProblem(draft) == nil, LocalDay.parse(today) != nil, case .object(var root) = plan else { return nil }
        var collection: [JSONValue] = []
        if case .array(let have)? = root["collection"] { collection = have }
        var accounts: [JSONValue] = []
        if case .array(let have)? = root["accounts"] { accounts = have }

        var card: [String: JSONValue] = [:]
        var index: Int?
        if let id {
            guard let at = collection.firstIndex(where: { $0["id"] == .string(id) }), case .object(let have) = collection[at] else { return nil }
            card = have
            index = at
        } else {
            card["account"] = .string(cardsAccount(collection: collection, accounts: &accounts, today: today))
        }

        let trimmed = { (s: String) in s.trimmingCharacters(in: .whitespacesAndNewlines) }
        let text = { (s: String) -> JSONValue? in trimmed(s).isEmpty ? nil : .string(trimmed(s)) }
        card["name"] = .string(trimmed(draft.name))
        card["set"] = text(draft.set)
        card["number"] = text(draft.number)
        card["grade"] = text(draft.grade)
        card["count"] = draft.count > 1 ? .number(Double(draft.count)) : nil
        let paid = roundedToCents(draft.paid)
        card["paid"] = paid > 0 ? .number(paid) : nil
        card["paidOn"] = draft.paidOn.map { JSONValue.string($0) }
        let price = roundedToCents(draft.price)
        var before = 0.0
        if case .number(let n)? = card["price"] { before = n }
        card["price"] = price > 0 ? .number(price) : nil
        if price != before || (price > 0 && card["priceOn"] == nil) {
            card["priceOn"] = .string(today)
        }
        card["typed"] = draft.typed ? .bool(true) : nil
        card["picture"] = draft.picture.map { JSONValue.string($0) }

        if let index { collection[index] = .object(card) } else { collection.append(.object(card)) }
        root["collection"] = .array(collection)
        if id == nil { root["accounts"] = .array(accounts) }
        return .object(root)
    }

    /// `plan` without the card `id`; its account stays. Nil for an unknown card.
    static func removingCard(id: String, in plan: JSONValue) -> JSONValue? {
        guard case .object(var root) = plan, case .array(let collection)? = root["collection"] else { return nil }
        let kept = collection.filter { $0["id"] != .string(id) }
        guard kept.count < collection.count else { return nil }
        root["collection"] = .array(kept)
        return .object(root)
    }

    /// The account a new card goes in: the first collectible account
    /// holding a card already, else a new Pokémon cards account (added to
    /// `accounts`) with an id no account has.
    private static func cardsAccount(collection: [JSONValue], accounts: inout [JSONValue], today: String) -> String {
        let holding = Set(collection.compactMap { card -> String? in
            if case .string(let a)? = card["account"] { return a }
            return nil
        })
        for account in accounts {
            if case .string(let id)? = account["id"], account["kind"] == .string("collectible"), holding.contains(id) { return id }
        }
        let taken = Set(accounts.compactMap { account -> String? in
            if case .string(let id)? = account["id"] { return id }
            return nil
        })
        var id = "pokemon-cards"
        var n = 2
        while taken.contains(id) {
            id = "pokemon-cards-\(n)"
            n += 1
        }
        accounts.append(.object([
            "id": .string(id),
            "name": .string("Pokémon cards"),
            "kind": .string("collectible"),
            "balance": .number(0),
            "updated": .string(today),
        ]))
        return id
    }
}
