import Foundation
import Testing
@testable import HomelabClient

/// Status's Storage card, as the computer's "What the apps keep": the six
/// largest folders, the rest counted, made-up sizes.
@Suite("Storage card")
struct StorageCardTests {
    static func storage(_ apps: String, when: String = "2026-11-20T04:12:00Z") -> JSONValue {
        try! JSONDecoder().decode(JSONValue.self, from: Data(#"{"when":"\#(when)","apps":\#(apps)}"#.utf8))
    }

    @Test func theSixLargestAndTheRest() throws {
        let card = try #require(StorageCard.from(Self.storage(#"""
        [{"app":"mealie","bytes":400},{"app":"immich","bytes":21400},{"app":"empty","bytes":0},{"app":"nextcloud","bytes":8200},
         {"app":"paperless","bytes":4100},{"app":"jellyfin","bytes":2600},{"app":"homeassistant","bytes":1300},
         {"app":"ntfy","bytes":100},{"app":"adguard","bytes":200}]
        """#)))
        #expect(card.rows.map(\.app) == ["immich", "nextcloud", "paperless", "jellyfin", "homeassistant", "mealie"])
        #expect(card.more == 2 && card.moreBytes == 300)
        #expect(card.total == 38300)
        #expect(card.measured == ISO8601DateFormatter().date(from: "2026-11-20T04:12:00Z"))
    }

    @Test func nothingToShow() {
        #expect(StorageCard.from(nil) == nil)
        #expect(StorageCard.from(Self.storage("[]")) == nil)
        #expect(StorageCard.from(Self.storage(#"[{"app":"a","bytes":0}]"#)) == nil)
        // Go's time with fractions of a second reads too.
        #expect(StorageCard.from(Self.storage(#"[{"app":"a","bytes":5}]"#, when: "2026-11-20T04:12:00.123456Z"))?.measured != nil)
    }

    /// Between Protection and Recent Alerts, as on the computer.
    @Test func whereItGoes() {
        #expect(StorageCard.place(among: ["watchdog", "protection", "alerts", "savings"]) == 2)
        #expect(StorageCard.place(among: ["watchdog", "savings"]) == 2)
        #expect(StorageCard.place(among: []) == 0)
    }
}
