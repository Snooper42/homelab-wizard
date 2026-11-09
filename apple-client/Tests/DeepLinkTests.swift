import Foundation
import Testing
@testable import HomelabClient

/// Links into the app (`homelab://`): every form, and what's refused.
@Suite("Links into the app")
struct DeepLinkTests {
    private static func parse(_ text: String) throws -> DeepLink {
        DeepLink.parse(try #require(URL(string: text)))
    }

    @Test func everyForm() throws {
        #expect(try Self.parse("homelab://status") == .status)
        #expect(try Self.parse("homelab://backups") == .backups)
        #expect(try Self.parse("homelab://finances") == .finances(page: nil))
        #expect(try Self.parse("homelab://finances/budgets") == .finances(page: .budgets))
        #expect(try Self.parse("homelab://tidy/inbox") == .tidyInbox)
        #expect(try Self.parse("homelab://app/immich") == .app(id: "immich", then: nil))
        #expect(try Self.parse("homelab://app/radarr?do=restart") == .app(id: "radarr", then: .restart))
        #expect(try Self.parse("homelab://app/radarr?do=start") == .app(id: "radarr", then: .start))
        #expect(try Self.parse("homelab://app/radarr?do=stop") == .app(id: "radarr", then: .stop))
        #expect(try Self.parse("homelab://app/radarr?do=logs") == .app(id: "radarr", then: .logs))
        // Case doesn't matter, but the id is kept as written.
        #expect(try Self.parse("HOMELAB://App/Radarr?do=RESTART") == .app(id: "Radarr", then: .restart))
    }

    @Test func onlyRestartStartAndStopWaitForATap() {
        #expect(DeepLink.Then.restart.change == .restart)
        #expect(DeepLink.Then.start.change == .start)
        #expect(DeepLink.Then.stop.change == .stop)
        #expect(DeepLink.Then.logs.change == nil)
    }

    @Test func unknownOrMalformedOpensStatus() throws {
        for text in [
            "https://homelab.example.com/app/immich", // not our scheme
            "homelab://",                              // nothing
            "homelab://settings",                      // not a link we take
            "homelab://app",                           // no app
            "homelab://app/immich/logs",               // too long
            "homelab://app/..%2Fsecrets",              // not an id
            "homelab://app/-immich",                   // not an id
            "homelab://user:pw@app/immich",            // a name and password
            "homelab://app:8080/immich",               // a port
            "homelab://status/extra",                  // too long
            "homelab://tidy/elsewhere",                // not the Inbox
        ] {
            #expect(try Self.parse(text) == .status, "\(text)")
        }
    }

    @Test func anActionItDoesntKnowOnlyOpensThePage() throws {
        #expect(try Self.parse("homelab://app/radarr?do=rollback") == .app(id: "radarr", then: nil))
        #expect(try Self.parse("homelab://app/radarr?do=delete") == .app(id: "radarr", then: nil))
        #expect(try Self.parse("homelab://app/radarr?do=") == .app(id: "radarr", then: nil))
        // Two asks: neither.
        #expect(try Self.parse("homelab://app/radarr?do=logs&do=stop") == .app(id: "radarr", then: nil))
        // An unknown Finances page opens Finances.
        #expect(try Self.parse("homelab://finances/elsewhere") == .finances(page: nil))
    }

    @Test @MainActor func aLinkOnlyAsksAndIsMarkedAsALink() {
        let inbox = IntentInbox()
        inbox.open(.app(id: "radarr", then: .restart))
        #expect(inbox.pending == IntentInbox.Request(app: "radarr", action: .restart, fromLink: true, logs: false))
        inbox.open(.app(id: "radarr", then: .logs))
        #expect(inbox.pending == IntentInbox.Request(app: "radarr", action: nil, fromLink: true, logs: true))
        inbox.open(.backups)
        #expect(inbox.screen == .backups)
        inbox.open(.finances(page: .budgets))
        #expect(inbox.screen == .finances && inbox.financePage == .budgets)
        inbox.open(.tidyInbox)
        #expect(inbox.screen == .status(.all))
    }

    @Test func appIDs() {
        #expect(DeepLink.isAppID("immich"))
        #expect(DeepLink.isAppID("home-assistant"))
        #expect(DeepLink.isAppID("a.b_c-1"))
        #expect(!DeepLink.isAppID(""))
        #expect(!DeepLink.isAppID(".hidden"))
        #expect(!DeepLink.isAppID("im mich"))
        #expect(!DeepLink.isAppID("immich/../x"))
        #expect(!DeepLink.isAppID("ïmmich"))
        #expect(!DeepLink.isAppID(String(repeating: "a", count: 65)))
    }
}
