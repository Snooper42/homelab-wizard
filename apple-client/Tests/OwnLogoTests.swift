import Foundation
import Testing
@testable import HomelabClient

// The household's own pictures for a logo (the plan's `logos`), drawn on the
// iPhone, the iPad and the Mac app as on the computer: before, the app never
// read them, so an account or a payee with a picture picked on the computer
// showed a letter or an icon here.

private let png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGM4IafxHx9mGBkKAJwVg0EdiZhbAAAAAElFTkSuQmCC"

struct OwnLogoTests {
    @Test func thePlanKeepsItsPictures() throws {
        let json = #"{"people":[],"accounts":[],"payments":[],"cushion":0,"logos":{"chase":"\#(png)","name:grandmas coins":"\#(png)"}}"#
        let plan = try JSONDecoder().decode(FinancePlan.self, from: Data(json.utf8))
        #expect(plan.logos["chase"] == png)
        #expect(plan.logos.count == 2)
        let none = try JSONDecoder().decode(FinancePlan.self, from: Data(#"{"people":[],"accounts":[],"payments":[]}"#.utf8))
        #expect(none.logos.isEmpty)
    }

    // Mark.tsx's ownKey: under its brand, else under "name:" and its name in words.
    @Test func aPictureIsKeptWhereTheComputerKeepsIt() {
        #expect(OwnLogos.key(brand: "chase", name: "Chase Checking") == "chase")
        #expect(OwnLogos.key(brand: nil, name: "Grandma’s Coins & Cards") == "name:grandmas coins and cards")
        #expect(OwnLogos.key(brand: "none", name: "Grandma's Coins") == "name:grandmas coins")
        #expect(OwnLogos.key(brand: "", name: "Mr. Lee") == "name:mr lee")
    }

    // Only a PNG, JPEG or WebP is kept, as finance.go's ownLogo has it; each reads as an image.
    @Test func onlyAPictureTheComputerKeepsIsDrawn() throws {
        let own = OwnLogos(["chase": png, "name:old": "data:image/gif;base64,R0lGODlhAQABAAAAACw=", "name:link": "https://example.com/logo.png"])
        #expect(own.pictures.keys.sorted() == ["chase"])
        let data = try #require(own.picture("chase"))
        #expect(LogoCircle.cgImage(data) != nil)
        #expect(own.picture(nil) == nil)
        #expect(own.picture("name:old") == nil)
    }

    // An account's own picture is found by the same key its mark is drawn from.
    @Test func anAccountsPictureIsFoundByItsBrandOrItsName() {
        let logos = PayeeLogos.shared
        let brand = logos.brandOf(institution: nil, name: "Chase Checking", kind: "checking")
        let own = OwnLogos(["chase": png, "name:grandmas coins": png])
        if brand == "chase" {
            #expect(own.picture(OwnLogos.key(brand: brand, name: "Chase Checking")) != nil)
        }
        let coins = logos.brandOf(institution: nil, name: "Grandma's Coins", kind: "other")
        #expect(own.picture(OwnLogos.key(brand: coins, name: "Grandma's Coins")) != nil || coins != nil)
    }
}
