import Foundation
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
