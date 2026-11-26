import Foundation
import Testing
@testable import HomelabClient

// Status › Subscriptions (P4): each paid service once, Library services apart, as the computer's (#914).
@Suite("Subscriptions")
struct SubscriptionsTests {
    private let catalog: AppCatalog = {
        try! JSONDecoder.homelab().decode(AppCatalog.self, from: Data(#"""
        {"categories":[{"id":"security","label":"Security"},{"id":"media","label":"Media"},{"id":"documents","label":"Documents"},{"id":"cloud","label":"Cloud & Files"}],
         "apps":[{"id":"vaultwarden","name":"Vaultwarden","category":"security"},{"id":"crowdsec","name":"CrowdSec","category":"security"},
                 {"id":"navidrome","name":"Navidrome","category":"media"},{"id":"feishin","name":"Feishin","category":"media"},
                 {"id":"paperless-ngx","name":"Paperless-ngx","category":"documents"},{"id":"nextcloud","name":"Nextcloud","category":"cloud"},
                 {"id":"filebrowser","name":"File Browser","category":"cloud"}]}
        """#.utf8))
    }()

    private let offers = [
        SubscriptionOffer(apps: ["vaultwarden"], replaces: "1Password Families", kind: "Direct", monthly: 4.99, annual: 59.88),
        // Two rows for one service: counted once, its apps together, the counted row's price.
        SubscriptionOffer(apps: ["crowdsec"], replaces: "Cloudflare Pro", kind: "Equivalent", monthly: 25, annual: 240, counted: true),
        SubscriptionOffer(apps: ["vaultwarden"], replaces: "Cloudflare Pro (WAF)", kind: "Equivalent", monthly: 20, annual: 200, counted: false),
        SubscriptionOffer(apps: ["navidrome"], replaces: "Spotify Premium Family", kind: "Library", monthly: 21.99, annual: 263.88),
        SubscriptionOffer(apps: ["feishin"], replaces: "Spotify Premium Family", kind: "Library", monthly: 21.99, annual: 263.88),
        // Priced only by the year: a twelfth a month.
        SubscriptionOffer(apps: ["paperless-ngx"], replaces: "Evernote Advanced", kind: "Direct", monthly: 0, annual: 249.99),
        // Not run: could be, with both its apps.
        SubscriptionOffer(apps: ["filebrowser", "nextcloud"], replaces: "Dropbox Plus", kind: "Equivalent", monthly: 9.99, annual: 119.88),
    ]

    @Test func eachServiceOnceLibraryApart() {
        let s = SubscriptionsSummary.from(offers: offers, running: ["vaultwarden", "crowdsec", "navidrome", "feishin", "paperless-ngx"], catalog: catalog)
        #expect(s.now.map(\.service) == ["Spotify Premium Family", "Evernote Advanced", "Cloudflare Pro", "1Password Families"])
        let cloudflare = s.now.first { $0.service == "Cloudflare Pro" }
        #expect(cloudflare?.annual == 240 && cloudflare?.apps == ["crowdsec", "vaultwarden"])
        #expect(s.now.first?.apps == ["navidrome", "feishin"])
        // Library apart from the total.
        #expect(s.counted == 3 && abs(s.year - (59.88 + 240 + 249.99)) < 0.001)
        #expect(abs(s.month - (4.99 + 25 + 249.99 / 12)) < 0.001)
        #expect(s.library == 1 && s.libraryYear == 263.88)
        #expect(s.libraryLine == "+ $264 a year more if you own the media (1 like Spotify Premium Family)")
        #expect(s.lead == "$550 a year, $50.82 a month, instead of 3 subscriptions")
        #expect(s.more.map(\.service) == ["Dropbox Plus"] && s.could == 119.88)
        // Where it comes from: Security (CrowdSec and Vaultwarden) first, then Documents.
        #expect(s.parts.map(\.label) == ["Security", "Documents"])
    }

    @Test func nothingRunYet() {
        let s = SubscriptionsSummary.from(offers: offers, running: [], catalog: catalog)
        #expect(s.now.isEmpty && s.year == 0 && s.libraryLine == nil && s.parts.isEmpty)
        // A service once even among the ones that could be.
        #expect(s.more.filter { $0.service == "Spotify Premium Family" }.count == 1)
        #expect(s.lead == "$0.00 a year, $0.00 a month, instead of 0 subscriptions")
    }

    @Test func theRowsAsTheComputerSendsThem() throws {
        let rows = try JSONDecoder.homelab().decode([SubscriptionOffer].self, from: Data(#"[{"apps":["immich"],"replaces":"Google One 2 TB (photos)","kind":"Equivalent","monthly":9.99,"annual":99.99,"condition":"","counted":true},{"replaces":"Old"}]"#.utf8))
        #expect(rows[0].service == "Google One 2 TB" && rows[0].counted)
        #expect(rows[1].apps.isEmpty && rows[1].annual == 0 && !rows[1].counted)
        #expect(SubscriptionsSummary.money(1457.2) == "$1,457" && SubscriptionsSummary.money(21.99) == "$21.99")
    }
}
