import CoreGraphics
import Foundation
import ImageIO
import Testing
@testable import HomelabClient

/// The Collection on the iPhone and iPad (finance.Collected): the cards as
/// the computer sends them, what they're worth and the gain on what was
/// paid, a picture's bytes, and what Update Prices says.
@Suite("Collection")
struct CollectionTests {
    @Test func theCardsAsTheComputerSendsThem() throws {
        let plan = try JSONDecoder.homelab().decode(FinancePlan.self, from: Data(#"""
        {"accounts":[{"id":"pokemon-cards","name":"Pokémon cards","kind":"collectible","balance":399.4}],
         "collection":[
          {"id":"ember-fox","account":"pokemon-cards","name":"Ember Fox","set":"Set A","number":"4/102","grade":"Near mint","paid":45,"price":182.4,"priceOn":"2026-11-13","ref":"seta-4","picture":"abababababababababababababababab.jpg"},
          {"id":"tide-turtle","account":"pokemon-cards","name":"Tide Turtle","count":2,"paid":30,"price":64.1},
          {"id":"moon-moth","account":"pokemon-cards","name":"Moon Moth","price":150,"typed":true}]}
        """#.utf8))
        #expect(plan.collection.count == 3)
        let ember = plan.collection[0]
        #expect(ember.line == "Set A · 4/102 · Near mint")
        #expect(ember.worth == 182.4 && ember.ref == "seta-4" && ember.priceOn != nil)
        let tide = plan.collection[1]
        #expect(tide.count == 2 && tide.worth == 128.2 && tide.paidTotal == 60 && tide.line == "×2")
        #expect(plan.collection[2].typed && plan.collection[2].line == "A card")
        let gain = try #require(FinanceCollected.gain(worth: 182.4, paid: 45))
        #expect(abs(gain - 3.0533) < 0.001)
        #expect(FinanceCollected.gain(worth: 10, paid: 0) == nil)
    }

    @Test func anOlderPlanHasNoCollection() throws {
        let plan = try JSONDecoder.homelab().decode(FinancePlan.self, from: Data(#"{"accounts":[]}"#.utf8))
        #expect(plan.collection.isEmpty)
    }

    @Test func aPictureIsOnlyAPicture() {
        #expect(FinanceCollected.pictureData("data:image/png;base64,iVBORw0KGgo=") != nil)
        #expect(FinanceCollected.pictureData("data:text/html;base64,PGI+") == nil)
        #expect(FinanceCollected.pictureData("https://example.com/card.png") == nil)
    }

    @Test func whatUpdatePricesSays() throws {
        let read = try JSONDecoder.homelab().decode(CardPricesRead.self, from: Data(#"{"updated":3,"kept":1,"notFound":["Leaf Lizard"],"unclear":["Volt Mouse"]}"#.utf8))
        #expect(read.words == "Updated 3 cards from TCGplayer's prices. Not found: Leaf Lizard (check its name and number). More than one printing: Volt Mouse (add its set). 1 card keeps your own price.")
        let none = try JSONDecoder.homelab().decode(CardPricesRead.self, from: Data("{}".utf8))
        #expect(none.words == "No price changed.")
    }
}

/// Add a Card on the iPhone and iPad (the owner, Nov 13): the card goes
/// into the plan as the computer sent it, in an account that holds cards
/// already, or a new Pokémon cards account when none does; the computer
/// gives it its id. What the form doesn't show (TCGdex's id) is kept.
@Suite("Add a card")
struct AddCardTests {
    private func plan(_ json: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
    }

    private func cards(_ plan: JSONValue?) -> [[String: JSONValue]] {
        guard case .array(let list)? = plan?["collection"] else { return [] }
        return list.compactMap { if case .object(let o) = $0 { return o } else { return nil } }
    }

    @Test func theFirstCardStartsItsOwnAccount() throws {
        let raw = try plan(#"{"rev":"r1","accounts":[{"id":"pokemon-cards","name":"Old","kind":"checking","balance":5}],"mystery":true}"#)
        var draft = CardDraft()
        draft.name = "  Ember Fox "
        draft.set = "Set A"
        draft.number = "4/102"
        draft.count = 2
        draft.paid = 45.004
        draft.paidOn = "2026-10-01"
        draft.price = 182.4
        let edited = try #require(FinancePlanEdit.settingCard(id: nil, to: draft, today: "2026-11-13", in: raw))
        #expect(edited["rev"] == .string("r1") && edited["mystery"] == .bool(true))
        guard case .array(let accounts)? = edited["accounts"], case .object(let fresh)? = accounts.last else {
            Issue.record("no account"); return
        }
        #expect(accounts.count == 2)
        #expect(fresh["id"] == .string("pokemon-cards-2")) // its own id: one is taken
        #expect(fresh["name"] == .string("Pokémon cards") && fresh["kind"] == .string("collectible"))
        let card = try #require(cards(edited).first)
        #expect(card["id"] == nil) // the computer gives it one
        #expect(card["account"] == .string("pokemon-cards-2"))
        #expect(card["name"] == .string("Ember Fox"))
        #expect(card["set"] == .string("Set A") && card["number"] == .string("4/102") && card["grade"] == nil)
        #expect(card["count"] == .number(2))
        #expect(card["paid"] == .number(45) && card["paidOn"] == .string("2026-10-01"))
        #expect(card["price"] == .number(182.4) && card["priceOn"] == .string("2026-11-13"))
        #expect(card["typed"] == nil && card["picture"] == nil)
    }

    @Test func aNewCardJoinsTheAccountThatHoldsCards() throws {
        let raw = try plan(#"""
        {"accounts":[{"id":"art","name":"Art","kind":"collectible","balance":900},{"id":"binder","name":"Binder","kind":"collectible","balance":10}],
         "collection":[{"id":"volt-mouse","account":"binder","name":"Volt Mouse","price":10}]}
        """#)
        var draft = CardDraft()
        draft.name = "Moon Moth"
        draft.grade = "Graded 9"
        draft.price = 150
        draft.typed = true
        draft.picture = "abababababababababababababababab.jpg"
        let edited = try #require(FinancePlanEdit.settingCard(id: nil, to: draft, today: "2026-11-13", in: raw))
        guard case .array(let accounts)? = edited["accounts"] else { Issue.record("no accounts"); return }
        #expect(accounts.count == 2) // no new account
        let added = try #require(cards(edited).last)
        #expect(cards(edited).count == 2)
        #expect(added["account"] == .string("binder")) // never Art, whose worth was typed in
        #expect(added["typed"] == .bool(true) && added["count"] == nil)
        #expect(added["picture"] == .string("abababababababababababababababab.jpg"))
    }

    @Test func changingACardKeepsWhatTheFormDoesNotShow() throws {
        let raw = try plan(#"""
        {"accounts":[{"id":"binder","name":"Binder","kind":"collectible","balance":182.4}],
         "collection":[{"id":"ember-fox","account":"binder","name":"Ember Fox","count":3,"paid":45,"price":182.4,"priceOn":"2026-11-01","ref":"seta-4","later":"kept"}]}
        """#)
        let card = try JSONDecoder.homelab().decode(FinancePlan.self, from: Data(#"""
        {"accounts":[],"collection":[{"id":"ember-fox","account":"binder","name":"Ember Fox","count":3,"paid":45,"price":182.4,"priceOn":"2026-11-01","ref":"seta-4"}]}
        """#.utf8)).collection[0]
        var draft = CardDraft(card)
        #expect(draft.name == "Ember Fox" && draft.count == 3 && draft.paid == 45 && draft.price == 182.4)
        draft.count = 1
        draft.grade = "Near mint"
        let same = try #require(FinancePlanEdit.settingCard(id: "ember-fox", to: draft, today: "2026-11-13", in: raw))
        let kept = try #require(cards(same).first)
        #expect(kept["id"] == .string("ember-fox") && kept["ref"] == .string("seta-4") && kept["later"] == .string("kept"))
        #expect(kept["count"] == nil && kept["grade"] == .string("Near mint"))
        #expect(kept["priceOn"] == .string("2026-11-01")) // the price didn't change
        draft.price = 190
        let repriced = try #require(FinancePlanEdit.settingCard(id: "ember-fox", to: draft, today: "2026-11-13", in: raw))
        #expect(cards(repriced).first?["priceOn"] == .string("2026-11-13"))
        draft.paid = 0
        draft.paidOn = nil
        let unpaid = try #require(FinancePlanEdit.settingCard(id: "ember-fox", to: draft, today: "2026-11-13", in: raw))
        #expect(cards(unpaid).first?["paid"] == nil && cards(unpaid).first?["paidOn"] == nil)
        #expect(FinancePlanEdit.settingCard(id: "gone", to: draft, today: "2026-11-13", in: raw) == nil)

        let removed = try #require(FinancePlanEdit.removingCard(id: "ember-fox", in: raw))
        #expect(cards(removed).isEmpty)
        guard case .array(let accounts)? = removed["accounts"] else { Issue.record("no accounts"); return }
        #expect(accounts.count == 1) // its account stays
        #expect(FinancePlanEdit.removingCard(id: "gone", in: raw) == nil)
    }

    @Test func refusesWhatTheComputerWouldNot() throws {
        let raw = try plan(#"{"accounts":[]}"#)
        var good = CardDraft()
        good.name = "Leaf Lizard"
        #expect(FinancePlanEdit.cardProblem(good) == nil)
        #expect(FinancePlanEdit.settingCard(id: nil, to: good, today: "2026-11-13", in: raw) != nil)
        var bad = good
        bad.name = " "
        #expect(FinancePlanEdit.cardProblem(bad) == "Give it a name: what's on the card.")
        bad = good; bad.count = 0
        #expect(FinancePlanEdit.cardProblem(bad) == "How many: 1 or more.")
        bad = good; bad.price = -1
        #expect(FinancePlanEdit.cardProblem(bad) == "A price is nothing or more.")
        bad = good; bad.paid = .nan
        #expect(FinancePlanEdit.cardProblem(bad) == "A price is nothing or more.")
        bad = good; bad.paidOn = "soon"
        #expect(FinancePlanEdit.cardProblem(bad) != nil)
        bad = good; bad.picture = "../plan.json"
        #expect(FinancePlanEdit.cardProblem(bad) != nil)
        bad = good; bad.name = String(repeating: "a", count: 121)
        #expect(FinancePlanEdit.cardProblem(bad) != nil)
        #expect(FinancePlanEdit.settingCard(id: nil, to: bad, today: "2026-11-13", in: raw) == nil)
        #expect(FinancePlanEdit.settingCard(id: nil, to: good, today: "soon", in: raw) == nil)
    }

    @Test func aCardPhotoIsSentSmall() throws {
        let context = try #require(CGContext(data: nil, width: 1200, height: 1680, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(CGColor(red: 0.2, green: 0.4, blue: 0.9, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 1200, height: 1680))
        let out = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(out, "public.png" as CFString, 1, nil))
        CGImageDestinationAddImage(destination, try #require(context.makeImage()), nil)
        #expect(CGImageDestinationFinalize(destination))
        let url = try #require(ReceiptCodec.preparePhoto(out as Data, pixels: CardDraft.photoPixels))
        let jpeg = try #require(FinanceCollected.pictureData(url))
        let source = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
        let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] ?? [:]
        let height = props[kCGImagePropertyPixelHeight] as? Int ?? 0
        #expect(height <= CardDraft.photoPixels && height >= CardDraft.photoPixels - 1)
        #expect(CardDraft.photoPixels == 800)
    }

    @Test func aSavedCardPictureNameIsOnlyAName() {
        #expect(CardDraft.isPictureName("abababababababababababababababab.webp"))
        #expect(!CardDraft.isPictureName("abababababababababababababababab.pdf")) // a receipt may be; a card picture isn't
        #expect(!CardDraft.isPictureName("../abababababababababababababababab.jpg"))
        #expect(!CardDraft.isPictureName("ABABABABABABABABABABABABABABABAB.jpg"))
    }
}
