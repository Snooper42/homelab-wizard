import Foundation
import Testing
@testable import HomelabClient

// Unit tests for the parts that don't need a device: input validation, the
// SSE parser, and decoding the companion's JSON. Add this file to the
// Multiplatform template's unit test target. If your app module isn't
// named HomelabClient, change the @testable import above.

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

@Suite("AppAction")
struct AppActionTests {
    private func app(state: String, health: String? = nil, id: String = "jellyfin") throws -> AppStatus {
        var json = #"{"id":"\#(id)","name":"Jellyfin","state":"\#(state)""#
        if let health { json += #","health":"\#(health)""# }
        json += "}"
        return try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
    }

    @Test func followsTheComputersRowMenu() throws {
        #expect(AppAction.available(for: try app(state: "stopped")) == [.start])
        #expect(AppAction.available(for: try app(state: "running", health: "healthy")) == [.restart, .stop])
        #expect(AppAction.available(for: try app(state: "running", health: "native")).isEmpty)
        #expect(AppAction.available(for: try app(state: "missing")).isEmpty)
        #expect(AppAction.available(for: try app(state: "elsewhere")).isEmpty)
    }

    @Test func stopAndRollBackAreConfirmed() {
        #expect(AppAction.allCases.filter(\.needsConfirmation) == [.stop, .rollback])
        #expect(!AppAction.rollback.isEveryday)
    }

    @Test func rollBackWhileTheOldVersionIsKept() throws {
        let json = #"{"id":"immich","name":"Immich","state":"running","updatedAt":"2026-11-04T03:00:00Z"}"#
        let updated = try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
        #expect(AppAction.available(for: updated) == [.restart, .stop, .rollback])
        #expect(AppAction.rollback.confirmationMessage(for: updated).contains("homelab updates release immich"))
    }

    @Test func appIDsAreCatalogShaped() {
        #expect(AppStatus.isValidID("nginx-proxy-manager"))
        #expect(AppStatus.isValidID("firefly-iii"))
        #expect(!AppStatus.isValidID(""))
        #expect(!AppStatus.isValidID("../etc"))
        #expect(!AppStatus.isValidID("a b"))
        #expect(!AppStatus.isValidID("app;rm -rf"))
        #expect(!AppStatus.isValidID(String(repeating: "a", count: 65)))
    }

    @Test func commandOutputIsCleanedAndCapped() {
        let lines = APIError.sanitizeLog(["\u{1B}[1mbold\u{7}", "tab\there"] + Array(repeating: "x", count: 500))
        #expect(lines.count == 400)
        let short = APIError.sanitizeLog(["\u{1B}[1mbold\u{7}", "tab\there", String(repeating: "y", count: 2000)])
        #expect(short[0] == "[1mbold")
        #expect(short[1] == "tab\there")
        #expect(short[2].count == 1000)
        #expect(APIError.sanitizeLog(nil).isEmpty)
    }

    @Test func failedActionsLogNoOutput() {
        #expect(APIError.actionFailed(message: "no such container jellyfin", log: ["secret"]).logName == "actionFailed")
    }
}

@Suite("Stop for a while")
struct StopChoiceTests {
    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    private func at(_ text: String) -> Date { GoTime.parse(text)! }

    @Test func afternoonOffersAnHourTonightAndTomorrowMorning() {
        let choices = StopChoice.choices(now: at("2026-11-05T14:30:42Z"), calendar: utc)
        #expect(choices.map(\.until) == [at("2026-11-05T15:30:00Z"), at("2026-11-05T21:00:00Z"), at("2026-11-06T08:00:00Z")])
        #expect(choices[2].label.hasSuffix("tomorrow"))
    }

    @Test func lateEveningSkipsTonight() {
        let choices = StopChoice.choices(now: at("2026-11-05T20:30:00Z"), calendar: utc)
        #expect(choices.map(\.until) == [at("2026-11-05T21:30:00Z"), at("2026-11-06T08:00:00Z")])
    }

    @Test func earlyMorningOffersThisMorning() {
        let choices = StopChoice.choices(now: at("2026-11-05T03:00:00Z"), calendar: utc)
        #expect(choices.last?.until == at("2026-11-05T08:00:00Z"))
        #expect(choices.last?.label.hasSuffix("tomorrow") == false)
    }

    @Test func untilIsWhatTheCLITakes() {
        #expect(StopChoice(label: "x", until: at("2026-11-05T21:00:00Z")).untilArgument == "2026-11-05T21:00:00Z")
    }

    @Test func statusCarriesTheStopToItsApp() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"immich","name":"Immich","state":"stopped"},{"id":"plex","name":"Plex","state":"stopped"}],
         "stopped":{"immich":{"since":"2026-11-05T14:00:00Z","until":"2026-11-05T21:00:00Z"},"plex":{"since":"2026-11-05T14:00:00Z"}}}
        """#.utf8))
        #expect(status.apps[0].stoppedOnPurpose?.until == at("2026-11-05T21:00:00Z"))
        #expect(status.apps[1].stoppedOnPurpose?.words() == "Stopped by you")
    }

    @Test func aBadStoppedRecordDoesNotCostTheStatus() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"stopped"}],"stopped":{"a":{"since":"yesterday"}}}
        """#.utf8))
        #expect(status.apps.count == 1)
        #expect(status.stopped.isEmpty)
    }
}

@Suite("Logs")
struct LogsTests {
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
