import Foundation
import Testing
@testable import HomelabClient

// Siri and Shortcuts: which app a spoken name means, and what Siri says.
@Suite("Siri and Shortcuts")
struct IntentsTests {
    private func apps() throws -> [AppStatus] {
        try JSONDecoder.homelab().decode([AppStatus].self, from: Data(#"""
        [{"id":"jellyfin","name":"Jellyfin","state":"running"},
         {"id":"jellyseerr","name":"Jellyseerr","state":"running"},
         {"id":"immich-server","name":"Immich","state":"running"},
         {"id":"audiobookshelf","name":"Audiobookshelf","state":"stopped"}]
        """#.utf8))
    }

    @Test func aSpokenNameFindsItsApp() throws {
        let apps = try apps()
        #expect(IntentInbox.match("jellyfin", in: apps)?.id == "jellyfin")
        #expect(IntentInbox.match(" Immich ", in: apps)?.id == "immich-server")
        #expect(IntentInbox.match("immich-server", in: apps)?.id == "immich-server")
        #expect(IntentInbox.match("audio", in: apps)?.id == "audiobookshelf")
        // Two apps start with it: none is guessed.
        #expect(IntentInbox.match("jelly", in: apps) == nil)
        #expect(IntentInbox.match("jellys", in: apps)?.id == "jellyseerr")
        #expect(IntentInbox.match("j", in: apps) == nil)
        #expect(IntentInbox.match("", in: apps) == nil)
        #expect(IntentInbox.match("plex", in: apps) == nil)
    }

    @Test func whatSiriSays() {
        let now = Date()
        #expect(CheckHomelabIntent.answer(nil, enabled: false, available: false) == "Open Homelab to read your apps.")
        #expect(CheckHomelabIntent.answer(nil, enabled: false, available: true).contains("turn on the widget"))
        #expect(CheckHomelabIntent.answer(WidgetSummary(needALook: 0, at: now), enabled: true, available: true)
            .hasPrefix("All your apps are well"))
        #expect(CheckHomelabIntent.answer(WidgetSummary(needALook: 1, at: now), enabled: true, available: true)
            .hasPrefix("One app needs a look"))
        #expect(CheckHomelabIntent.answer(WidgetSummary(needALook: 3, at: now), enabled: true, available: true)
            .hasPrefix("3 apps need a look"))
        // Never an app's name.
        #expect(!CheckHomelabIntent.answer(WidgetSummary(needALook: 3, at: now), enabled: true, available: true).contains("Jellyfin"))
    }

    @Test func theActionsSiriOffers() {
        #expect(IntentAppAction.allCases.map(\.action) == [.restart, .start, .stop])
    }
}
