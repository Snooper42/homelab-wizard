import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import SwiftUI
import Testing
@testable import HomelabClient

// Unit tests for the parts that don't need a device, in five files:
// - ParsingTests: input validation, the SSE parser, decoding the companion's JSON, the bundled logos
// - ActionTests: which actions an app offers, Stop for a while, settings, groups
// - FinancesTests: decoding Finances, and the lossless plan and ledger edits
// - LockAndPairingTests: the lock state machine (fake keychain and Face ID), scanning to pair
// - NetworkTests: the network rules and live events, against a stubbed URLProtocol
// Run them with `swift test` in apple-client/, or add Tests/ to the Xcode
// project's unit test target. If the app module isn't named
// HomelabClient, change each @testable import.

@Suite("PairingCode")
struct PairingCodeTests {
    @Test func acceptsWhatPeopleType() {
        #expect(PairingCode("abcd-2345")?.value == "ABCD2345")
        #expect(PairingCode(" ABCD 2345 ")?.value == "ABCD2345")
    }

    @Test func rejectsWrongLengthAndLookAlikes() {
        #expect(PairingCode("ABCD234") == nil)
        // 0, O, 1, I and L aren't in the alphabet, so this leaves 7.
        #expect(PairingCode("ABCD2340") == nil)
        #expect(PairingCode.sanitize("o0l1iABCDEFGHJK") == "ABCDEFGH")
    }

    @Test func neverPrintsItsValue() {
        let code = PairingCode("ABCD2345")!
        #expect(!"\(code)".contains("ABCD"))
        #expect(!String(reflecting: code).contains("ABCD"))
    }
}

@Suite("ServerEndpoint")
struct ServerEndpointTests {
    @Test func defaultsToHTTPSAndStripsEverythingButOrigin() throws {
        let (endpoint, code) = try ServerEndpoint.parse("My-Mac.tail1234.ts.net:8099/some/path?x=1")
        #expect(endpoint.baseURL.absoluteString == "https://my-mac.tail1234.ts.net:8099")
        #expect(code == nil)
    }

    @Test func readsThePairingLink() throws {
        let (endpoint, code) = try ServerEndpoint.parse("https://homelab.example.com/#pair=ABCD2345")
        #expect(endpoint.displayName == "homelab.example.com")
        #expect(code?.value == "ABCD2345")
    }

    @Test func refusesPlainHTTPAndCredentials() {
        #expect(throws: ServerEndpoint.ValidationError.insecureScheme) {
            try ServerEndpoint.parse("http://mac.local:8099/#pair=ABCD2345")
        }
        #expect(throws: ServerEndpoint.ValidationError.hasCredentials) {
            try ServerEndpoint.parse("https://user:pw@homelab.example.com")
        }
        #expect(throws: ServerEndpoint.ValidationError.empty) {
            try ServerEndpoint.parse("   ")
        }
    }

    @Test func storedEndpointsAreCheckedAgain() throws {
        let (endpoint, _) = try ServerEndpoint.parse("https://[fd7a:115c:a1e0::1]:8099")
        let data = try JSONEncoder().encode(endpoint)
        #expect(try JSONDecoder().decode(ServerEndpoint.self, from: data) == endpoint)

        for bad in ["http://homelab.example.com", "https://me:pw@homelab.example.com",
                    "https://homelab.example.com/api/me", "https://homelab.example.com/#pair=ABCD2345",
                    "https://homelab.example.com?x=1"] {
            let json = try JSONEncoder().encode(["baseURL": bad])
            #expect(throws: DecodingError.self) { try JSONDecoder().decode(ServerEndpoint.self, from: json) }
        }
    }

    @Test func onlyAPIPathsAreBuilt() throws {
        let (endpoint, _) = try ServerEndpoint.parse("https://homelab.example.com")
        #expect(endpoint.url(path: "/api/call/Status")?.absoluteString == "https://homelab.example.com/api/call/Status")
        #expect(endpoint.url(path: "/admin") == nil)
        #expect(endpoint.url(path: "api/me") == nil)
        #expect(endpoint.url(path: "/api/../admin") == nil)
        #expect(endpoint.url(path: "/api/me?x=1") == nil)
        #expect(endpoint.url(path: "/api/me#x") == nil)
    }

    @Test func tailscaleIPv6Addresses() throws {
        let (endpoint, code) = try ServerEndpoint.parse("https://[fd7a:115c:a1e0::1]:8099/#pair=ABCD2345")
        #expect(endpoint.baseURL.absoluteString == "https://[fd7a:115c:a1e0::1]:8099")
        #expect(code?.value == "ABCD2345")
        #expect(endpoint.url(path: "/api/me")?.absoluteString == "https://[fd7a:115c:a1e0::1]:8099/api/me")
        #expect(endpoint.owns(URL(string: "https://[FD7A:115C:A1E0::1]:8099/api/events")))
        #expect(!endpoint.owns(URL(string: "https://[fd7a:115c:a1e0::2]:8099/api/me")))
        // Not an IPv6 address, though it has colons: refused, never built.
        #expect(throws: (any Error).self) { try ServerEndpoint.parse("https://[not:an:address]:8099") }
    }

    @Test func ownsOnlyItsOwnOrigin() throws {
        let endpoint = try ServerEndpoint.parse("https://host.ts.net:8099").endpoint
        #expect(endpoint.owns(URL(string: "https://HOST.ts.net:8099/api/me")))
        #expect(!endpoint.owns(URL(string: "https://host.ts.net/api/me")))
        #expect(!endpoint.owns(URL(string: "http://host.ts.net:8099/api/me")))
        #expect(!endpoint.owns(URL(string: "https://evil.example:8099/api/me")))
    }

    // https only, everywhere: the Mac app's plain http to loopback went with it.
    @Test func noPlainHTTPAnywhere() throws {
        for typed in ["http://localhost:8099", "http://127.0.0.1:8099/some/path", "http://[::1]:8099/#pair=ABCD2345",
                      "http://mac.local:8099", "http://192.168.1.20:8099", "ftp://localhost:8099"] {
            #expect(throws: ServerEndpoint.ValidationError.insecureScheme, "\(typed)") {
                try ServerEndpoint.parse(typed)
            }
        }
        // A bare loopback name is read as https, like any other host, and kept as typed.
        let bare = try ServerEndpoint.parse("localhost:8099").endpoint
        #expect(bare.baseURL.absoluteString == "https://localhost:8099")
        #expect(!bare.owns(URL(string: "http://localhost:8099/api/me")))
    }

    @Test func storedHTTPIsRefused() throws {
        // A Keychain item an older Mac app wrote for loopback now reads as corrupt, and is deleted.
        for bad in ["http://127.0.0.1:8099", "http://[::1]:8099", "http://10.0.0.2:8099"] {
            let json = try JSONEncoder().encode(["baseURL": bad])
            #expect(throws: DecodingError.self) { try JSONDecoder().decode(ServerEndpoint.self, from: json) }
        }
    }
}

@Suite("DeviceCredential")
struct DeviceCredentialTests {
    @Test func tokenShape() {
        #expect(DeviceCredential.isWellFormed(token: "q2Vx8f_Lr-3n0TQ1ZkYb9w4sAeJm7HcPuDgRiNoXtW0"))
        #expect(!DeviceCredential.isWellFormed(token: "short"))
        #expect(!DeviceCredential.isWellFormed(token: "has space in it but is long enough"))
        #expect(!DeviceCredential.isWellFormed(token: "line\nbreak-injection-attempt-xxxxxxxx"))
    }

    @Test func neverPrintsTheToken() throws {
        let endpoint = try ServerEndpoint.parse("https://h.ts.net:8099").endpoint
        let credential = DeviceCredential(endpoint: endpoint, token: "SECRET-TOKEN-VALUE-1234", deviceID: "abc123", deviceName: "Phone", pairedAt: Date())
        #expect(!"\(credential)".contains("SECRET"))
        #expect(!String(reflecting: credential).contains("SECRET"))
        var dumped = ""
        dump(credential, to: &dumped)
        #expect(!dumped.contains("SECRET"))
    }
}

@Suite("SSEParser")
struct SSEParserTests {
    private func parse(_ text: String, max: Int = 1 << 20) throws -> [SSEParser.Output] {
        var parser = SSEParser(maxEventBytes: max)
        var out: [SSEParser.Output] = []
        for byte in Array(text.utf8) {
            if let item = try parser.consume(byte) { out.append(item) }
        }
        return out
    }

    @Test func readsTheCompanionsStream() throws {
        // What engine.Hub.Stream writes: a comment, an event, a heartbeat.
        let out = try parse(": following\n\ndata: {\"apps\":[\"jellyfin\"]}\n\n: still here\n\n")
        #expect(out == [
            .comment,
            .event(ServerSentEvent(event: "message", data: "{\"apps\":[\"jellyfin\"]}", id: nil)),
            .comment,
        ])
    }

    @Test func handlesCRLFMultilineDataAndFields() throws {
        let out = try parse("event: change\r\nid: 7\r\ndata: a\r\ndata:b\r\n\r\n")
        #expect(out == [.event(ServerSentEvent(event: "change", data: "a\nb", id: "7"))])
    }

    @Test func ignoresEmptyEvents() throws {
        #expect(try parse("\n\nevent: x\n\n").isEmpty)
    }

    @Test func boundsMemory() {
        let big = "data: " + String(repeating: "x", count: 2048) + "\n\n"
        #expect(throws: (any Error).self) { try parse(big, max: 1024) }
    }
}

@Suite("Decoding")
struct DecodingTests {
    @Test func goTimesWithNanoseconds() {
        let date = GoTime.parse("2026-11-05T10:11:12.123456789-05:00")
        #expect(date != nil)
        #expect(GoTime.parse("2026-11-05T15:11:12Z") != nil)
        #expect(GoTime.trimFraction("2026-11-05T10:11:12.123456789Z") == "2026-11-05T10:11:12.123Z")
    }

    @Test func engineChangeWithAndWithoutStatus() throws {
        let decoder = JSONDecoder.homelab()
        let bare = try decoder.decode(EngineChange.self, from: Data(#"{"apps":["a"],"again":true}"#.utf8))
        #expect(bare.needsRefresh)

        let full = try decoder.decode(EngineChange.self, from: Data(#"""
        {"apps":["jellyfin"],"status":{"apps":[{"id":"jellyfin","name":"Jellyfin","state":"running","health":"unhealthy","restarts":3}],"missing":0,"unmatched":1,"savings":143.88,"updates":{"on":true}}}
        """#.utf8))
        #expect(!full.needsRefresh)
        #expect(full.status?.apps.first?.needsAttention == true)
        #expect(full.status?.unmatched == 1)
    }

    @Test func serverMessagesAreCleaned() {
        #expect(APIError.sanitize("  bad\u{1B}[31m code\n ") == "bad[31m code")
        #expect(APIError.sanitize(String(repeating: "a", count: 1000))?.count == 300)
        #expect(APIError.sanitize("   ") == nil)
    }

    @Test func errorLogNamesCarryNoServerText() {
        #expect(APIError.forbidden("device abc123 is look-only").logName == "forbidden")
        #expect(APIError.server(status: 500, message: "secret path").logName == "server(500)")
    }
}

@Suite("Logs")
struct LogsTests {
    @Test func readsProblemLines() {
        #expect(LogsViewModel.level(of: "2026-11-05 ERROR could not connect") == .error)
        #expect(LogsViewModel.level(of: "panic: runtime error") == .error)
        #expect(LogsViewModel.level(of: "time=... level=error msg=boom") == .error)
        #expect(LogsViewModel.level(of: "Traceback (most recent call last):") == .error)
        #expect(LogsViewModel.level(of: "[WARN] disk 91% full") == .warning)
        #expect(LogsViewModel.level(of: "Listening on :8080") == .plain)
        let lines = LogsViewModel.split("ok\nWARNING low\nFATAL gone\n")
        #expect(lines.map(\.level) == [.plain, .warning, .error])
    }

    @Test func splitsCleansAndCaps() {
        let lines = LogsViewModel.split("one\n\u{1B}[31mtwo\u{7}\n\nthree\t3\n" + String(repeating: "z", count: 3000) + "\n\n")
        #expect(lines.map(\.text) == ["one", "[31mtwo", "", "three\t3", String(repeating: "z", count: 2000)])
        #expect(lines.map(\.id) == [0, 1, 2, 3, 4])
    }

    @Test func emptyLogHasNoLines() {
        #expect(LogsViewModel.split("").isEmpty)
        #expect(LogsViewModel.split("\n\n").isEmpty)
    }

    @Test func nativeAppsHaveNoLogs() throws {
        let native = try JSONDecoder.homelab().decode(AppStatus.self, from: Data(#"{"id":"jellyfin","name":"Jellyfin","state":"running","health":"native"}"#.utf8))
        #expect(!native.hasLogs)
    }
}

@Suite("Cards")
struct CardTests {
    private func line(_ json: String) throws -> StatusCard {
        try JSONDecoder.homelab().decode(StatusCard.self, from: Data(json.utf8))
    }

    @Test func watchdogBeforeItsFirstRun() throws {
        let card = try line(#"{"board":1,"name":"watchdog","data":{"lastRun":"0001-01-01T00:00:00Z","checks":0,"failing":[],"pending":0,"week":{}}}"#)
        guard case .watchdog(let w)? = card.data else { Issue.record("not a watchdog card"); return }
        #expect(w.lastRun == nil)
        #expect(w.weekUptime == nil)
    }

    @Test func watchdogWithFailures() throws {
        let card = try line(#"""
        {"board":2,"name":"watchdog","data":{"lastRun":"2026-11-05T10:00:00.123456789Z","checks":12,
         "failing":[{"name":"immich","problem":"HTTP 502","since":"2026-11-05T09:00:00Z"}],"pending":1,"week":{"immich":0.5,"plex":1}}}
        """#)
        guard case .watchdog(let w)? = card.data else { Issue.record("not a watchdog card"); return }
        #expect(w.failing.map(\.name) == ["immich"])
        #expect(w.weekUptime == 0.75)
    }

    @Test func nullListsAreEmpty() throws {
        let alerts = try line(#"{"board":1,"name":"alerts","data":null}"#)
        #expect(alerts.data == .alerts([]))
        let savings = try line(#"{"board":1,"name":"savings","data":null}"#)
        #expect(savings.data == .savings([]))
    }

    @Test func errorsAndNotHere() throws {
        let notHere = try line(#"{"board":1,"name":"usage","error":"not read here"}"#)
        #expect(notHere.isNotHere)
        let token = try line(#"{"board":1,"name":"alerts","error":"no NTFY_READ_TOKEN yet"}"#)
        #expect(token.data == nil && token.error == "no NTFY_READ_TOKEN yet")
    }

    @Test func aBadPayloadOnlyCostsItsCard() throws {
        let card = try line(#"{"board":1,"name":"protection","data":{"recent":[{"scenario":"x"}]}}"#)
        #expect(card.data == nil)
        #expect(card.error != nil)
    }

    @Test func attackPresentation() throws {
        let card = try line(#"""
        {"board":1,"name":"protection","data":{"enforced":true,"bouncer":"ok","week":3,"bannedNow":1,
         "recent":[{"scenario":"http-probing","ip":"203.0.113.9","country":"de","when":"2026-11-05T08:00:00Z","banned":true}]}}
        """#)
        guard case .protection(let p)? = card.data else { Issue.record("not a protection card"); return }
        #expect(p.recent.first?.scenarioWords == "Http probing")
        #expect(p.recent.first?.flag == "🇩🇪")
    }

    @Test func whatItStoppedToday() throws {
        let card = try line(#"""
        {"board":1,"name":"protection","data":{"enforced":true,"bouncer":"ok","week":30,"bannedNow":2,"recent":[],
         "today":[{"scenario":"http-probing","ip":"203.0.113.9","when":"2026-11-05T08:00:00Z","banned":true},
                  {"scenario":"http-probing","ip":"203.0.113.9","when":"2026-11-05T08:00:00Z","banned":true}],
         "todayCount":14}}
        """#)
        guard case .protection(let p)? = card.data else { Issue.record("not a protection card"); return }
        #expect(p.today.count == 2 && p.todayCount == 14 && p.moreToday == 12)

        // An older computer sends neither: nothing today, nothing more.
        let old = try line(#"{"board":1,"name":"protection","data":{"enforced":true,"bouncer":"ok","week":1,"bannedNow":0,"recent":[]}}"#)
        guard case .protection(let q)? = old.data else { Issue.record("not a protection card"); return }
        #expect(q.today.isEmpty && q.todayCount == 0 && q.moreToday == 0)
    }

    @Test func savingsDays() {
        #expect(SavingsPoint(date: "2026-11-05", annual: 1).day != nil)
        #expect(SavingsPoint(date: "bad", annual: 1).day == nil)
    }
}

@Suite("Icons")
struct IconTests {
    // A 1×1 PNG.
    private let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    @Test func acceptsARealPNG() throws {
        let payload = try #require(IconDecoder.payload(fromDataURL: "data:image/png;base64,\(png)"))
        #expect(payload.type == "image/png")
        let image = try #require(IconDecoder.thumbnail(from: payload.data))
        #expect(image.width == 1)
    }

    @Test func typeMustMatchTheBytes() {
        #expect(IconDecoder.payload(fromDataURL: "data:image/jpeg;base64,\(png)") == nil)
    }

    @Test func refusesSVGAndNonBase64() {
        let svg = Data("<svg xmlns=\"http://www.w3.org/2000/svg\"/>".utf8).base64EncodedString()
        #expect(IconDecoder.payload(fromDataURL: "data:image/svg+xml;base64,\(svg)") == nil)
        #expect(IconDecoder.payload(fromDataURL: "data:image/png,\(png)") == nil)
        #expect(IconDecoder.payload(fromDataURL: "https://example.com/icon.png") == nil)
    }

    @Test func refusesOversizePayloads() {
        let big = Data(repeating: 0, count: IconDecoder.maxEncodedBytes + 1).base64EncodedString()
        #expect(IconDecoder.payload(fromDataURL: "data:image/png;base64,\(big)") == nil)
    }

    @Test func garbageWithAPNGHeaderDoesNotDecode() {
        var bytes = Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        bytes.append(Data(repeating: 0xAB, count: 64))
        #expect(IconDecoder.thumbnail(from: bytes) == nil)
    }
}

@Suite("Saved so far")
struct SavedSoFarTests {
    private func points(_ json: String) throws -> [SavingsPoint] {
        try JSONDecoder().decode([SavingsPoint].self, from: Data(json.utf8))
    }

    @Test func eachDayCountsTheLatestYearlyFigure() throws {
        // Out of order on purpose. Oct 30–Nov 1 at 365 a year, then Nov 2 at 730.
        let s = SavedSoFar.from(try points(#"[{"date":"2026-11-02","annual":730},{"date":"2026-10-30","annual":365}]"#))
        #expect(s.since == "2026-10-30")
        #expect(s.months.map(\.month) == ["2026-11", "2026-10"])
        #expect(abs(s.months[0].amount - 3) < 1e-9 && abs(s.months[1].amount - 2) < 1e-9)
        #expect(abs(s.total - 5) < 1e-9)
    }

    @Test func nothingAndBadDaysSayNothing() throws {
        #expect(SavedSoFar.from([]).since.isEmpty)
        #expect(SavedSoFar.from(try points(#"[{"date":"soon","annual":100}]"#)).months.isEmpty)
    }

    @Test func aCenturyOfRecordsIsCappedAtTenYears() throws {
        let s = SavedSoFar.from(try points(#"[{"date":"1926-01-01","annual":365},{"date":"2026-01-01","annual":365}]"#))
        #expect(abs(s.total - Double(SavedSoFar.maxDays)) < 1e-6)
    }
}

@Suite("Apps that do the same job")
struct SameJobTests {
    @Test func saidOnBothSidesOfAPair() throws {
        let catalog = try JSONDecoder().decode(AppCatalog.self, from: Data(#"""
        {"apps":[{"id":"karakeep","name":"Karakeep","sameJob":{"linkwarden":"Karakeep tags with AI; Linkwarden keeps a full copy of each page"}},
                 {"id":"linkwarden","name":"Linkwarden"},{"id":"wallabag","name":"Wallabag","sameJob":{"karakeep":"both save links","linkwarden":7}}]}
        """#.utf8))
        // Written on Karakeep's side, said on Linkwarden's too; only for apps that are here.
        #expect(catalog.sameJob(as: "linkwarden", among: ["karakeep", "linkwarden"]).map(\.name) == ["Karakeep"])
        #expect(catalog.sameJob(as: "karakeep", among: ["karakeep", "linkwarden"]).map(\.name) == ["Linkwarden"])
        #expect(catalog.sameJob(as: "karakeep", among: ["karakeep"]).isEmpty)
        // A same-job map that doesn't read costs only itself.
        #expect(catalog.entry("wallabag")?.sameJob.isEmpty == true)
    }
}

@Suite("Backups")
struct BackupsTests {
    @Test func overviewFromTheComputer() throws {
        let o = try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"""
        {"destination":"/Volumes/Backup/homelab","destinationOK":true,"lastRun":"2026-11-05T03:12:00Z","envCopied":"0001-01-01T00:00:00Z",
         "copies":[{"id":"immich","name":"Immich","newest":"2026-11-05T03:10:00Z","size":1073741824,"count":7,"state":"fresh"},
                   {"id":"plex","name":"Plex","newest":"0001-01-01T00:00:00Z","size":0,"count":0,"state":"paused","waitingFor":"/Volumes/Media"}],
         "stale":0,"paused":1,"restoreTest":{"lastTest":"2026-10-20T10:00:00Z","lastSummary":"restored 3 files","lastReminder":"0001-01-01T00:00:00Z"},
         "restoreDue":false,"staleAfterHours":36,"vaultExport":"0001-01-01T00:00:00Z","vaultDue":true,"plainExports":["bitwarden_export.json"]}
        """#.utf8))
        #expect(o.envCopied == nil)
        #expect(o.copies[1].newest == nil && o.copies[1].waitingFor == "/Volumes/Media")
        #expect(o.restoreTest.lastSummary == "restored 3 files")
        #expect(o.vaultExport == nil && o.vaultDue)
        #expect(o.kopia == nil)
        // The app page's Last backup: late after staleAfterHours (36 here).
        #expect(o.copy(for: "immich")?.size == 1073741824 && o.copy(for: "nope") == nil)
        let run = try #require(o.lastRun)
        #expect(!o.isLate(now: run.addingTimeInterval(35 * 3600)))
        #expect(o.isLate(now: run.addingTimeInterval(37 * 3600)))
    }

    @Test func aCopyThatShrankIsFlagged() throws {
        let o = try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"""
        {"copies":[{"id":"immich","name":"Immich","size":1000000,"before":5000000,"shrank":true,"count":7,"state":"fresh"},
                   {"id":"plex","name":"Plex","size":1200000,"before":1000000,"count":7,"state":"fresh"},
                   {"id":"vault","name":"Vault","size":1020,"before":1000,"count":7,"state":"fresh"},
                   {"id":"new","name":"New","size":10,"count":1,"state":"fresh"}],
         "shrank":1}
        """#.utf8))
        #expect(o.shrank == 1 && o.copies[0].shrank && o.copies[0].before == 5_000_000)
        // A tenth or more either way shows the night before's size; less doesn't, nor a first copy.
        #expect(o.copies[1].sizeChanged && !o.copies[2].sizeChanged && !o.copies[3].sizeChanged)
    }

    @Test func copiesInTheComputersGroups() throws {
        let o = try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"""
        {"copies":[{"id":"a","name":"Immich","state":"fresh"},{"id":"b","name":"Plex","state":"paused","waitingFor":"/Volumes/Media"},
                   {"id":"c","name":"Jellyfin","state":"paused","waitingFor":"/Volumes/Media"},{"id":"d","name":"Mealie","state":"none"},
                   {"id":"e","name":"Paperless","state":"stale"}]}
        """#.utf8))
        #expect(o.copyGroups.map(\.state) == ["stale", "fresh", "paused", "none"])
        #expect(o.copyGroups[2].note == "Plex, Jellyfin wait for Media; their last copies are kept.")
        #expect(o.copyGroups[3].note == "Mealie, tonight.")
        #expect(o.upToDate.fresh == 1 && o.upToDate.of == 3)
    }

    @Test func theVaultExportReadsAsTheComputerSaysIt() throws {
        func o(_ json: String) throws -> BackupOverview { try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(json.utf8)) }
        #expect(try o(#"{"vaultExport":"0001-01-01T00:00:00Z"}"#).vaultState == .neverMade)
        #expect(try o(#"{"vaultExport":"2026-10-01T00:00:00Z","vaultDue":true}"#).vaultState == .due(GoTime.parse("2026-10-01T00:00:00Z")!))
        #expect(try o(#"{"vaultExport":"2026-11-01T00:00:00Z"}"#).vaultState == .fine(GoTime.parse("2026-11-01T00:00:00Z")!))
        #expect(try o(#"{"vaultExport":"2026-11-01T00:00:00Z","plainExports":["bitwarden_export.json"]}"#).vaultState == .plainExportLyingAround)
    }

    @Test func duplicatiInTheComputersWords() throws {
        #expect(DuplicatiWords.problem("Post \"http://127.0.0.1:8200/api/v1/auth/login\": dial tcp 127.0.0.1:8200: connect: connection refused").hasPrefix("Duplicati isn't answering"))
        #expect(DuplicatiWords.problem("DUPLICATI_PASSWORD is empty").contains("Settings"))
        #expect(DuplicatiWords.problem("something else") == "something else")

        let jobs = try JSONDecoder.homelab().decode([DuplicatiJob].self, from: Data(#"""
        [{"id":"1","name":"AppData","state":"ok","lastFinished":"2026-11-05T03:40:00Z"},{"id":"2","name":"Photos","state":"failed"}]
        """#.utf8))
        #expect(DuplicatiWords.summary(jobs) == "1 needs a look")
        #expect(DuplicatiWords.summary([jobs[0]]).hasPrefix("It ran"))
    }

    // main #463: Sunday's integrity check, Duplicati's own Verify of each job.
    @Test func weeklyCheck() throws {
        let jobs = try JSONDecoder.homelab().decode([DuplicatiJob].self, from: Data(#"""
        [{"id":"1","name":"AppData","state":"ok","checked":"2026-11-01T07:10:00Z"},
         {"id":"2","name":"Photos","state":"ok","checked":"2026-11-01T07:20:00Z","checkProblem":"Hash mismatch on file duplicati-b1.dblock.zip.aes"},
         {"id":"3","name":"Docs","state":"ok","checked":"0001-01-01T00:00:00Z","checkProblem":""}]
        """#.utf8))
        #expect(jobs[0].checked != nil && jobs[0].checkProblem == nil && !jobs[0].damaged)
        #expect(jobs[1].damaged && jobs[1].needsALook)
        #expect(jobs[2].checked == nil && jobs[2].checkProblem == nil) // never checked
        #expect(DuplicatiWords.summary(jobs) == "1 needs a look")
    }

    @Test func restoreDrillsOnRecord() throws {
        let o = try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"""
        {"restoreTest":{"lastTest":"2026-11-01T10:00:00Z","history":[
          {"when":"2026-10-01T10:00:00Z","seconds":240,"passed":true,"summary":"12 files"},
          {"when":"2026-11-01T10:00:00Z","passed":true,"summary":"12 files"},
          {"when":"2026-11-05T10:00:00Z","seconds":30,"passed":false,"summary":"3 files differ","engine":"kopia"}]}}
        """#.utf8))
        #expect(o.restoreTest.failedSince?.summary == "3 files differ")
        #expect(o.restoreTest.lastPassTook == 240)      // the newest pass wasn't timed
        #expect(o.restoreTest.recentDrills.first?.engine == "kopia")

        // A drill that doesn't read costs only the record.
        let bad = try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"{"restoreTest":{"lastTest":"2026-11-01T10:00:00Z","history":[{"when":"soon"}]}}"#.utf8))
        #expect(bad.restoreTest.history.isEmpty && bad.restoreTest.lastTest != nil)
    }

    @Test func duplicatiSizesAndFoldersReadPlainly() throws {
        #expect(DuplicatiJob.sizeText("3.311 GiB") == Int64(3.311 * 1_073_741_824).formatted(.byteCount(style: .memory)))
        #expect(DuplicatiJob.sizeText("512 bytes") == Int64(512).formatted(.byteCount(style: .memory)))
        #expect(DuplicatiJob.sizeText("about a lot") == "about a lot")
        #expect(DuplicatiJob.sizeText("1e400 GB") == "1e400 GB")
        let job = try JSONDecoder.homelab().decode(DuplicatiJob.self, from: Data(#"{"id":"1","sources":["/source/appdata/immich/","/source/appdata/paperless"]}"#.utf8))
        #expect(job.sourceNames == ["immich", "paperless"])
    }

    @Test func whereTheBackupsGoInWords() {
        #expect(BackupOverview.placeName("/Users/sam/Library/CloudStorage/ProtonDrive-sam/homelab") == "Proton Drive")
        #expect(BackupOverview.placeName("/Volumes/Backup/homelab") == "the Backup drive")
        #expect(BackupOverview.placeName("/media/sam/Backup/homelab") == "the Backup drive")
        #expect(BackupOverview.placeName("/run/media/sam/Backup") == "the Backup drive")
        #expect(BackupOverview.placeName("/mnt/nas/homelab") == "the nas drive")
        #expect(BackupOverview.placeName("D:\\Backups\\homelab") == "the D drive")
        #expect(BackupOverview.placeName("/srv/backups/homelab") == "homelab")
        // Too short to name a drive: no crash, the last folder.
        #expect(BackupOverview.placeName("/Volumes") == "Volumes")
        #expect(BackupOverview.placeName("/media/sam") == "sam")
    }

    @Test func neverRunIsNotLate() throws {
        let o = try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(#"{"lastRun":"0001-01-01T00:00:00Z"}"#.utf8))
        #expect(o.lastRun == nil && !o.isLate())
    }

    @Test func duplicatiJobs() throws {
        let jobs = try JSONDecoder.homelab().decode([DuplicatiJob].self, from: Data(#"""
        [{"id":"1","name":"Nightly","lastFinished":"2026-11-05T02:00:00Z","lastError":"0001-01-01T00:00:00Z","state":"ok","nextRun":"2026-11-06T02:00:00Z","size":"12.3 GB"}]
        """#.utf8))
        #expect(jobs[0].lastError == nil)
        #expect(jobs[0].nextRun != nil)
    }
}

@Suite("Computer")
struct ComputerTests {
    @Test func statusCarriesTheNightlyUpdates() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"{"apps":[],"updates":{"paused":true,"schedule":"daily at 04:00"}}"#.utf8))
        #expect(status.updates == UpdatesState(paused: true, schedule: "daily at 04:00"))
    }

    @Test func hostAndReport() throws {
        let host = try JSONDecoder.homelab().decode(HostInfo.self, from: Data(#"{"os":"macOS 15","machine":"arm64","runtime":"OrbStack","scheduler":"launchd","supported":true,"rootOK":true,"runtimeOK":false,"version":"0.42.0"}"#.utf8))
        #expect(host.runtime == "OrbStack" && !host.runtimeOK)
        let report = try JSONDecoder.homelab().decode(DiagnosticsReport.self, from: Data(#"{"text":"homelab report\n","helper":""}"#.utf8))
        #expect(report.text.hasPrefix("homelab report"))
    }

    @Test func tasksAreWhatTheComputerTakes() {
        // The Homelab method's switch: backup, restore-test, fix.
        #expect(HomelabTask.allCases.map(\.rawValue) == ["backup", "restore-test", "fix"])
    }
}

@Suite("Catalog")
struct CatalogTests {
    @Test func decodesTheCatalog() throws {
        let catalog = try JSONDecoder.homelab().decode(AppCatalog.self, from: Data(#"""
        {"categories":[{"id":"media","label":"Media"}],
         "apps":[{"id":"jellyfin","name":"Jellyfin","category":"media","description":"Films and shows.","kind":"optional","public":true,
                  "phone":"Jellyfin","replaces":["Netflix",""],"inputs":["JELLYFIN_DIR"]}],
         "presets":[{"id":"p","name":"P","token":"@p","apps":[]}],"wireable":[]}
        """#.utf8))
        let entry = try #require(catalog.entry("jellyfin"))
        #expect(entry.isPublic)
        #expect(entry.replaces == ["Netflix"])
        #expect(catalog.categoryLabel("media") == "Media")
        #expect(catalog.entry("nope") == nil)
    }
}

@Suite("The week's uptime")
struct UptimeTests {
    private func summary(_ week: String, outages: String = "{}") throws -> WatchdogSummary {
        try JSONDecoder.homelab().decode(WatchdogSummary.self, from: Data(#"{"lastRun":"2026-11-05T10:00:00Z","checks":2,"failing":[],"pending":0,"week":\#(week),"outages":\#(outages)}"#.utf8))
    }

    @Test func labelAsTheComputerWordsIt() throws {
        let s = try summary(#"{"immich":0.96299,"plex":0.995,"x":0.5}"#)
        let label = try #require(s.uptimeLabel(for: "immich"))
        // Cut, not rounded: 96.2 (in this locale's own decimal mark), never 96.3.
        #expect(label.hasPrefix("96") && label.contains("2%") && !label.contains("3%"))
        #expect(s.uptimeLabel(for: "plex") == nil)                         // 99% and up isn't flagged
        #expect(s.uptimeLabel(for: "x")?.hasPrefix("50") == true)
        #expect(s.uptimeLabel(for: "none") == nil)
    }

    @Test func outages() throws {
        let s = try summary(#"{"immich":0.9}"#, outages: #"{"immich":[{"from":"2026-11-04T02:00:00Z","to":"2026-11-04T02:45:00Z","problem":"HTTP 502"},{"from":"2026-11-05T09:00:00Z","to":"0001-01-01T00:00:00Z","problem":"connection refused"}]}"#)
        let list = try #require(s.outages["immich"])
        #expect(list.count == 2)
        #expect(list[0].duration() == 45 * 60)
        #expect(list[1].to == nil) // still down
    }
}

@Suite("Memory nearly full")
struct MemoryPressureTests {
    private func summary(_ memory: String) throws -> WatchdogSummary {
        try JSONDecoder.homelab().decode(WatchdogSummary.self, from: Data(#"{"lastRun":"2026-11-05T10:00:00Z","checks":1,"failing":[],"pending":0,"week":{},"memory":\#(memory)}"#.utf8))
    }

    // main #458: health.Memory, as the watchdog card carries it while it has alerted.
    @Test func decodesTheAlert() throws {
        let s = try summary(#"{"used":7988639171,"total":8589934592,"since":"2026-11-05T09:40:00Z","alerted":true,"biggest":[{"id":"immich","name":"Immich","bytes":2254857830},{"name":"some-container","bytes":943718400},{"id":"plex","name":"Plex","bytes":524288000},{"id":"x","name":"X","bytes":1}]}"#)
        let m = try #require(s.memory)
        #expect(m.percent == 93)
        #expect(m.since != nil)
        #expect(m.biggest.count == 3)                // three at most
        #expect(m.biggest[1].id == nil)              // the catalog doesn't know it: no Stop
        #expect(MemoryPressure.text(m.total) == "8.0 GB")
        #expect(MemoryPressure.text(943_718_400) == "900 MB")
    }

    @Test func noAlertNoMemory() throws {
        let plain = try JSONDecoder.homelab().decode(WatchdogSummary.self, from: Data(#"{"lastRun":"2026-11-05T10:00:00Z","checks":1,"failing":[],"pending":0,"week":{}}"#.utf8))
        #expect(plain.memory == nil)
        // A part the phone can't read costs only that part.
        let broken = try summary(#""not an object""#)
        #expect(broken.memory == nil && broken.checks == 1)
    }
}

@Suite("Snoozed alerts")
struct SnoozedAlertTests {
    // main #469: the watchdog card says which failing checks' alerts wait, and until when.
    @Test func untilWhenByCheck() throws {
        let s = try JSONDecoder.homelab().decode(WatchdogSummary.self, from: Data(#"""
        {"lastRun":"2026-11-06T10:00:00Z","checks":2,"pending":0,"week":{},
         "failing":[{"name":"Immich","problem":"HTTP 502","since":"2026-11-06T09:00:00Z"}],
         "snoozed":{"Immich":"2026-11-06T11:00:00Z","Plex":"2026-11-06T08:00:00Z"}}
        """#.utf8))
        let now = try #require(GoTime.parse("2026-11-06T10:30:00Z"))
        #expect(s.snoozedUntil("Immich", now: now) == GoTime.parse("2026-11-06T11:00:00Z"))
        #expect(s.snoozedUntil("Plex", now: now) == nil)     // already over
        #expect(s.snoozedUntil("Nextcloud", now: now) == nil)
        // A snoozed map that doesn't read costs only itself.
        let bad = try JSONDecoder.homelab().decode(WatchdogSummary.self, from: Data(#"{"checks":1,"snoozed":{"Immich":"soon"}}"#.utf8))
        #expect(bad.snoozed.isEmpty && bad.checks == 1)
    }

    @Test func wakeTextIsTheTimeTodayAndTheDayAfter() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let now = try #require(GoTime.parse("2026-11-06T10:30:00Z"))
        let today = WatchdogSummary.wakeText(try #require(GoTime.parse("2026-11-06T11:00:00Z")), now: now, calendar: calendar)
        let tomorrow = WatchdogSummary.wakeText(try #require(GoTime.parse("2026-11-07T11:00:00Z")), now: now, calendar: calendar)
        #expect(today != tomorrow)
        #expect(tomorrow.count > today.count) // the day's name comes first
    }
}

@Suite("Duplicati's last run")
struct DuplicatiRunTests {
    @Test func summarizesTheLastRun() throws {
        let jobs = try JSONDecoder.homelab().decode([DuplicatiJob].self, from: Data(#"""
        [{"id":"1","name":"Nightly","state":"ok","lastFinished":"2026-11-05T02:04:00Z","nextRun":"0001-01-01T00:00:00Z",
          "took":245,"holds":"48.2 GB","files":4210,"versions":12,"sources":["/Users/sam/homelab/data/"]},
         {"id":"2","name":"Old","state":"never","nextRun":"0001-01-01T00:00:00Z"}]
        """#.utf8))
        let summary = try #require(jobs[0].lastRunSummary)
        #expect(summary.hasPrefix("Took"))
        #expect(summary.contains(DuplicatiJob.sizeText("48.2 GB") + " in"))   // said as the app's other sizes
        #expect(summary.hasSuffix("keeps 12 versions"))
        #expect(jobs[0].sources == ["/Users/sam/homelab/data/"])
        #expect(jobs[1].lastRunSummary == nil) // an older computer, or nothing yet: nothing said
    }
}

@Suite("Overnight")
struct OvernightTests {
    private var utc: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }
    private func at(_ s: String) -> Date { GoTime.parse(s)! }
    private func apps(_ json: String) -> [AppStatus] { try! JSONDecoder.homelab().decode([AppStatus].self, from: Data(json.utf8)) }

    @Test func onlyInTheMorning() {
        #expect(Overnight.night(of: at("2026-11-05T04:59:00Z"), calendar: utc) == nil)
        #expect(Overnight.night(of: at("2026-11-05T12:00:00Z"), calendar: utc) == nil)
        let night = Overnight.night(of: at("2026-11-05T07:30:00Z"), calendar: utc)
        #expect(night?.lowerBound == at("2026-11-04T20:00:00Z"))
    }

    @Test func sumsUpTheNightAsTheComputerDoes() throws {
        let list = apps(#"[{"id":"a","name":"Immich","state":"running","updatedAt":"2026-11-05T03:00:00Z"},{"id":"b","name":"Plex","state":"running","updatedAt":"2026-11-03T03:00:00Z"}]"#)
        let copies = try JSONDecoder.homelab().decode([BackupCopy].self, from: Data(#"[{"id":"a","name":"Immich","newest":"2026-11-05T03:10:00Z","size":1073741824,"count":3,"state":"fresh"}]"#.utf8))
        let line = Overnight.words(.init(now: at("2026-11-05T07:30:00Z"), apps: list, events: [], outages: [:], copies: copies, watched: true), calendar: utc)
        let words = try #require(line)
        #expect(words.hasPrefix("Overnight: Immich updated, a backup of"))
        #expect(words.hasSuffix("nothing needed you."))
    }

    @Test func whatNeededYouComesFirst() throws {
        let list = apps(#"[{"id":"a","name":"Immich","state":"running"}]"#)
        let summary = try JSONDecoder.homelab().decode(WatchdogSummary.self, from: Data(#"""
        {"lastRun":"2026-11-05T07:00:00Z","checks":1,"failing":[],"pending":0,"week":{"a":0.9},
         "outages":{"a":[{"from":"2026-11-05T01:00:00Z","to":"2026-11-05T01:30:00Z","problem":"HTTP 502"}]}}
        """#.utf8))
        let words = Overnight.words(.init(now: at("2026-11-05T07:30:00Z"), apps: list, events: [], outages: summary.outages, copies: nil, watched: true), calendar: utc)
        #expect(words == "Overnight: Immich was down for a while.")
    }

    @Test func saysNothingUntilTheWatchdogWasRead() {
        let words = Overnight.words(.init(now: at("2026-11-05T07:30:00Z"), apps: [], events: [], outages: [:], copies: nil, watched: false), calendar: utc)
        #expect(words == nil)
    }

    @Test func hideUntilTomorrow() {
        let d = UserDefaults(suiteName: "homelab.tests.\(UUID().uuidString)")!
        let morning = at("2026-11-05T07:30:00Z")
        #expect(!Overnight.isHiddenToday(morning, defaults: d, calendar: utc))
        Overnight.hideToday(morning, defaults: d, calendar: utc)
        #expect(Overnight.isHiddenToday(morning, defaults: d, calendar: utc))
        #expect(!Overnight.isHiddenToday(at("2026-11-06T07:30:00Z"), defaults: d, calendar: utc))
    }
}

@Suite("Changed since you looked")
struct ChangeMemoryTests {
    private let key = SymmetricKey(size: .bits256)
    private func app(_ json: String) -> AppStatus { try! JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8)) }

    @Test func rulesAsTheComputerHasThem() {
        let before = [app(#"{"id":"a","name":"A","state":"running","since":"2026-11-05T01:00:00Z","updatedAt":"2026-11-01T00:00:00Z"}"#),
                      app(#"{"id":"b","name":"B","state":"stopped"}"#),
                      app(#"{"id":"c","name":"C","state":"running","since":"2026-11-05T01:00:00Z"}"#),
                      app(#"{"id":"d","name":"D","state":"running","since":"2026-11-05T01:00:00Z"}"#)]
        let memory = ChangeMemory.memory(of: before, key: key)
        #expect(ChangeMemory.change(of: app(#"{"id":"a","name":"A","state":"running","since":"2026-11-05T09:00:00Z","updatedAt":"2026-11-05T09:00:00Z"}"#), since: memory, key: key) == "Updated since you looked")
        #expect(ChangeMemory.change(of: app(#"{"id":"b","name":"B","state":"running","since":"2026-11-05T09:00:00Z"}"#), since: memory, key: key) == "Started since you looked")
        #expect(ChangeMemory.change(of: app(#"{"id":"c","name":"C","state":"stopped"}"#), since: memory, key: key) == "Stopped since you looked")
        #expect(ChangeMemory.change(of: app(#"{"id":"d","name":"D","state":"running","since":"2026-11-05T09:00:00Z"}"#), since: memory, key: key) == "Restarted since you looked")
        #expect(ChangeMemory.change(of: before[0], since: memory, key: key) == nil)               // the same
        #expect(ChangeMemory.change(of: app(#"{"id":"new","name":"N","state":"running"}"#), since: memory, key: key) == nil) // not seen before
        #expect(ChangeMemory.change(of: before[0], since: nil, key: key) == nil)                   // first time on this device
    }

    @Test func keepsNothingReadableOrGuessable() throws {
        let immich = app(#"{"id":"immich","name":"Immich","state":"running","since":"2026-11-05T01:00:00Z"}"#)
        let memory = ChangeMemory.memory(of: [immich], key: key)
        let stored = String(decoding: try JSONEncoder().encode(memory), as: UTF8.self)
        #expect(!stored.contains("immich"))
        #expect(!stored.contains("2026"))
        // A guess hashed without the device's key matches nothing.
        let other = SymmetricKey(size: .bits256)
        #expect(memory[ChangeMemory.hash("immich", key: other)] == nil)
        #expect(ChangeMemory.change(of: immich, since: memory, key: other) == nil)
    }

    @Test func markAsSeenSurvivesAReadBackAndAnEmptyListKeepsIt() throws {
        let defaults = try #require(UserDefaults(suiteName: "homelab.tests.\(UUID().uuidString)"))
        let up = app(#"{"id":"a","name":"A","state":"running","since":"2026-11-05T01:00:00Z"}"#)
        ChangeMemory.save([up], key: key, to: defaults)
        let read = ChangeMemory.load(defaults)
        #expect(ChangeMemory.change(of: up, since: read, key: key) == nil)
        // Nothing to show (a lock mid-read) never wipes what was seen.
        ChangeMemory.save([], key: key, to: defaults)
        #expect(ChangeMemory.load(defaults) == read)
    }
}

@Suite("DeviceInfo")
struct DeviceInfoTests {
    @Test func readsWhenItPairedWhateverTheDateStrategy() throws {
        let json = Data(#"""
        {"id":"d1","name":"Phone","canChange":true,"finances":"view","unencrypted":true,
         "paired":"2026-11-03T18:04:05.123456789Z","lastSeen":"0001-01-01T00:00:00Z"}
        """#.utf8)
        // The plain decoder's default date strategy would fail on these strings.
        let device = try JSONDecoder().decode(DeviceInfo.self, from: json)
        #expect(device.paired == GoTime.parse("2026-11-03T18:04:05.123Z"))
        #expect(device.lastSeen == nil)
        #expect(device.unencrypted)
        #expect(device.finances == "view")
    }

    @Test func oldAnswersStillRead() throws {
        let device = try JSONDecoder().decode(DeviceInfo.self, from: Data(#"{"id":"d1","name":"Phone","paired":12}"#.utf8))
        #expect(device.paired == nil && !device.unencrypted && !device.canChange)
    }
}

@Suite("App logos")
struct AppLogoTests {
    /// Shared/Assets.xcassets/AppLogos in this checkout.
    private var folder: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Shared/Assets.xcassets/AppLogos")
    }

    private struct Contents: Decodable {
        struct Entry: Decodable { let filename: String?; let scale: String? }
        let images: [Entry]?
        let properties: [String: Bool]?
    }

    @Test func everyLogoIsWholeAndNamedForAnApp() throws {
        let manager = FileManager.default
        // Named "AppLogos/<id>" in code, so the folder must give it its namespace.
        let top = try JSONDecoder().decode(Contents.self, from: Data(contentsOf: folder.appendingPathComponent("Contents.json")))
        #expect(top.properties?["provides-namespace"] == true)
        let sets = try manager.contentsOfDirectory(atPath: folder.path).filter { $0.hasSuffix(".imageset") }
        #expect(sets.count >= 60)
        for set in sets {
            let id = String(set.dropLast(".imageset".count))
            #expect(AppStatus.isValidID(id), "\(set) isn't named for an app id")
            let contents = try JSONDecoder().decode(Contents.self, from: Data(contentsOf: folder.appendingPathComponent("\(set)/Contents.json")))
            let names = (contents.images ?? []).compactMap(\.filename)
            #expect(names == ["\(id).png"], "\(set) should hold just \(id).png")
            let png = folder.appendingPathComponent("\(set)/\(id).png")
            let source = try #require(CGImageSourceCreateWithURL(png as CFURL, nil), "\(set): no PNG")
            let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil), "\(set): unreadable")
            #expect(image.width == 180 && image.height == 180, "\(set) is \(image.width)×\(image.height)")
        }
        // Nothing else in there: a stray file is an actool warning, and a
        // warning fails the build in CI.
        let stray = try manager.contentsOfDirectory(atPath: folder.path).filter { $0 != "Contents.json" && $0 != ".DS_Store" && !$0.hasSuffix(".imageset") }
        #expect(stray.isEmpty, "Stray files: \(stray)")
    }
}

@Suite("Why a backup copy is stale")
struct StaleCopyTests {
    private func copy(_ state: String, app: String?) throws -> BackupCopy {
        let field = app.map { #","app":"\#($0)""# } ?? ""
        return try JSONDecoder.homelab().decode(BackupCopy.self, from: Data(#"{"id":"db","name":"Vikunja","state":"\#(state)"\#(field)}"#.utf8))
    }

    private func app(_ id: String, _ state: String) throws -> AppStatus {
        try JSONDecoder.homelab().decode(AppStatus.self, from: Data(#"{"id":"\#(id)","name":"X","state":"\#(state)"}"#.utf8))
    }

    @Test func saysWhyFromTheAppsState() throws {
        let stale = try copy("stale", app: "vikunja")
        let stopped = try app("vikunja", "stopped"), restarting = try app("vikunja", "restarting")
        let running = try app("vikunja", "running"), other = try app("other", "running")
        #expect(stale.app == "vikunja")
        #expect(stale.staleWhy(apps: [stopped])?.hasPrefix("It's stopped, so the nightly copy skips it.") == true)
        #expect(stale.staleWhy(apps: [restarting]) == "It isn't running, so the nightly copy skips it.")
        #expect(stale.staleWhy(apps: [running])?.hasPrefix("Last night's copy didn't come.") == true)
        #expect(stale.staleWhy(apps: [other]) == "It isn't installed any more: its last copies are kept.")
    }

    @Test func saysNothingWhenItIsntKnown() throws {
        // Status not read yet, no app on the copy, or not stale.
        let noStatus = try copy("stale", app: "vikunja"), noApp = try copy("stale", app: nil), fresh = try copy("fresh", app: "vikunja")
        #expect(noStatus.staleWhy(apps: nil) == nil)
        #expect(noApp.staleWhy(apps: []) == nil)
        #expect(fresh.staleWhy(apps: []) == nil)
    }
}

@Suite("Settings on a phone")
struct HomelabSettingsTests {
    // As the computer sends it (main #491): a secret says only that it is set.
    let json = #"""
    {"settings":[
      {"key":"TZ","section":"This Mac","help":"Your time zone.","secret":false,"set":true,"value":"Europe/Lisbon"},
      {"key":"KEEP_AWAKE","section":"This Mac","help":"Keep it awake (./homelab awake). true: it never sleeps. false: it sleeps as set.","secret":false,"set":true,"value":"true"},
      {"key":"PHONE_COMPANION","section":"This Mac","help":"","secret":false,"set":true,"value":"true"},
      {"key":"NPM_API_PASSWORD","section":"Domain","help":"","secret":true,"set":true,"value":"should-never-be-kept"}],
     "computerOnly":["NPM_API_PASSWORD","PHONE_COMPANION"]}
    """#

    @Test func readsTheFormAndNeverKeepsASecretsValue() throws {
        let form = try JSONDecoder.homelab().decode(HomelabSettingsForm.self, from: Data(json.utf8))
        #expect(form.settings.count == 4)
        let secret = try #require(form.settings.last)
        #expect(secret.secret && secret.set && secret.value.isEmpty)
        #expect(form.sections.map(\.name) == ["This Mac", "Domain"])
        #expect(SettingWords.section("This Mac") == "This Machine")
        // Everyday ones change; a secret and what a phone connects through don't.
        #expect(form.settings.map(form.phoneMayChange) == [true, true, false, false])
        #expect(form.settings.map(\.isToggle) == [false, true, true, false])
    }

    @Test func namesAsTheComputersScreen() throws {
        let apps = try JSONDecoder().decode([CatalogEntry].self, from: Data(#"""
        [{"id":"open-webui","name":"Open WebUI","kind":"optional"},{"id":"paperless","name":"Paperless-ngx","kind":"optional"}]
        """#.utf8))
        #expect(SettingWords.label("TZ", apps: apps) == "Time zone")
        #expect(SettingWords.label("OPEN_WEBUI_PORT", apps: apps) == "Open WebUI port")
        #expect(SettingWords.label("PAPERLESS_DB_PASSWORD", apps: apps) == "Paperless-ngx database password")
        #expect(SettingWords.label("NPM_API_PASSWORD", apps: []) == "Nginx Proxy Manager API password")
        #expect(SettingWords.envPrefix("Open WebUI") == "OPEN_WEBUI_")
    }

    @Test func helpWithoutCommandsAndASwitchsTrueAndFalse() {
        let help = "Keep it awake (./homelab awake). true: it never sleeps. false: it sleeps as set."
        #expect(SettingWords.plainHelp(help, toggle: false) == "Keep it awake. true: it never sleeps. false: it sleeps as set.")
        #expect(SettingWords.plainHelp(help, toggle: true) == "Keep it awake.")
        #expect(SettingWords.plainHelp("Paths like ./data stay. More here.", toggle: true) == "Paths like ./data stay. More here.")
    }

    @Test func onlyKeysShapedLikeEnvKeysAreSent() {
        #expect(HomelabSetting.isValidKey("TZ") && HomelabSetting.isValidKey("_X1"))
        #expect(!HomelabSetting.isValidKey("") && !HomelabSetting.isValidKey("1TZ"))
        #expect(!HomelabSetting.isValidKey("TZ=x") && !HomelabSetting.isValidKey("A B"))
        #expect(!HomelabSetting.isValidKey(String(repeating: "A", count: 101)))
    }
}
