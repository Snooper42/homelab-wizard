import Foundation
import Testing
@testable import HomelabClient

/// Away mode (ADR-0023): which apps it lists, and what counts as answering.
/// What it keeps and asks over the network is in NetworkTests (one stub,
/// one serialized suite).
@Suite("Away mode")
struct AwayModeTests {
    private static func status(_ json: String) throws -> HomelabStatus {
        try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(json.utf8))
    }

    private static func catalog(_ json: String) throws -> AppCatalog {
        try JSONDecoder.homelab().decode(AppCatalog.self, from: Data(json.utf8))
    }

    @Test func onlyAppsOnTheInternetWithAnHttpsAddressByName() throws {
        let status = try Self.status(#"""
        {"apps":[
          {"id":"immich","name":"Immich","state":"running","address":"photos.example.com"},
          {"id":"vaultwarden","name":"Vaultwarden","state":"running","address":"https://vault.example.com"},
          {"id":"jellyfin","name":"Jellyfin","state":"running","address":"http://tv.example.com"},
          {"id":"audiobookshelf","name":"Audiobookshelf","state":"running","address":"https://books.example.com"},
          {"id":"seerr","name":"Seerr","state":"running"}
        ],"missing":0,"unmatched":0,"savings":0}
        """#)
        let catalog = try Self.catalog(#"""
        {"categories":[],"apps":[
          {"id":"immich","public":true},{"id":"vaultwarden"},{"id":"jellyfin","public":true},
          {"id":"audiobookshelf","public":true},{"id":"seerr","public":true}
        ]}
        """#)
        let apps = AwayApp.list(from: status, catalog: catalog)
        // Vaultwarden stays home; Jellyfin's address isn't https; Seerr has none.
        #expect(apps.map(\.id) == ["audiobookshelf", "immich"])
        #expect(apps.last?.address.absoluteString == "https://photos.example.com")
    }

    @Test func anAddressIsHttpsWithNoNameOrPassword() {
        #expect(AwayApp.httpsURL("photos.example.com")?.absoluteString == "https://photos.example.com")
        #expect(AwayApp.httpsURL("https://photos.example.com/share")?.absoluteString == "https://photos.example.com/share")
        #expect(AwayApp.httpsURL("http://photos.example.com") == nil)
        #expect(AwayApp.httpsURL("ftp://photos.example.com") == nil)
        #expect(AwayApp.httpsURL("https://me:secret@photos.example.com") == nil)
    }

    @Test func answeringIsAnythingButAServerError() {
        #expect(AwayApp.answers(status: 200))
        #expect(AwayApp.answers(status: 401)) // its own sign-in
        #expect(AwayApp.answers(status: 404))
        #expect(!AwayApp.answers(status: 502))
        #expect(!AwayApp.answers(status: 530)) // Cloudflare: the computer behind it doesn't answer
    }
}
