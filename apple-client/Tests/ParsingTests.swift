import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import SwiftUI
import Testing
@testable import HomelabClient

// Unit tests for the parts that don't need a device, in five files:
// - ParsingTests: input validation, the SSE parser, decoding the companion's JSON
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
        #expect(summary.contains("48.2 GB in"))
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
