import Foundation
import Testing
@testable import HomelabClient

/// What an update brings on the phone, in the computer's words
/// (web/src/status/ReleaseNotes.tsx's `summary`), on made-up releases; and
/// Update only behind them, never on a swipe, a menu or a group.
@Suite("Release notes")
struct ReleasePreviewTests {
    static func preview(_ json: String) throws -> ReleasePreview {
        try JSONDecoder.homelab().decode(ReleasePreview.self, from: Data(json.utf8))
    }

    @Test func whatAnUpdateBringsInTheComputersWords() throws {
        let two = try Self.preview(#"""
        {"app":"vaultwarden","repo":"dani-garcia/vaultwarden","running":"1.32.5","placed":true,"page":"https://github.com/dani-garcia/vaultwarden/releases",
         "releases":[{"tag":"1.33.1","when":"2026-11-12T18:04:11.123456Z","url":"https://github.com/x/1","notes":"Fixes a sign-in loop."},
                     {"tag":"1.33.0","name":"Passkeys","when":"2026-10-30T09:00:00Z","url":"https://github.com/x/0"}]}
        """#)
        #expect(two.summary(name: "Vaultwarden") == "Vaultwarden runs 1.32.5; updating brings 2 releases, up to 1.33.1.")
        #expect(two.releases[1].title == "1.33.0 — Passkeys" && two.releases[0].title == "1.33.1")
        #expect(two.releases[0].day != nil && two.more == 0)

        let one = try Self.preview(#"{"app":"a","repo":"o/a","running":"2.0","placed":true,"releases":[{"tag":"2.1","when":"0001-01-01T00:00:00Z","url":""}]}"#)
        #expect(one.summary(name: "A") == "A runs 2.0; updating brings 2.1.")
        // Go's zero time is no day.
        #expect(one.releases[0].day == nil)

        #expect(try Self.preview(#"{"app":"a","repo":"o/a","running":"2.1","placed":true,"releases":[]}"#).summary(name: "A")
                == "A runs 2.1, the newest release. Updating pulls that release's newest build.")
        #expect(try Self.preview(#"{"app":"a","placed":false,"releases":[]}"#).summary(name: "A")
                == "A's image doesn't say where its releases are published. Updating pulls its newest image.")
        #expect(try Self.preview(#"{"app":"a","repo":"o/a","placed":false,"releases":[]}"#).summary(name: "A") == "A's project has published no releases.")
        #expect(try Self.preview(#"{"app":"a","repo":"o/a","running":"1.0","placed":false,"releases":[{"tag":"3.0","url":""}]}"#).summary(name: "A")
                == "A runs 1.0; the newest release is 3.0.")
        #expect(try Self.preview(#"{"app":"a","repo":"o/a","placed":false,"releases":[{"tag":"3.0","url":""}]}"#).summary(name: "A")
                == "The newest release of A is 3.0. Its image doesn't say which version it runs now.")
    }

    @Test func theNewestFiveThenHowManyMore() throws {
        let many = (1...8).map { #"{"tag":"v\#($0)","url":""}"# }.joined(separator: ",")
        let p = try Self.preview(#"{"app":"a","repo":"o/a","running":"v0","placed":true,"releases":[\#(many)]}"#)
        #expect(p.shown.map(\.tag) == ["v1", "v2", "v3", "v4", "v5"] && p.more == 3)
    }

    @Test func updateOnlyBehindItsNotes() throws {
        let json = #"{"id":"immich","name":"Immich","state":"running","updatedAt":"2026-11-04T03:00:00Z"}"#
        let app = try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
        #expect(!AppAction.available(for: app).contains(.update))
        #expect(!AppAction.update.isEveryday && !AppAction.update.needsConfirmation)
        #expect(AppAction.groupTargets(.update, in: [app]).isEmpty)
        #expect(AppAction.update.rawValue == "update")
    }
}
