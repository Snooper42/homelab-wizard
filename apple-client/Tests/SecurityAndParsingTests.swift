import CoreGraphics
import Foundation
import ImageIO
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

@Suite("Finances")
struct FinancesTests {
    @Test func levels() {
        #expect(FinancesLevel(nil) == .none)
        #expect(FinancesLevel("") == .none)
        #expect(FinancesLevel("card") >= .card)
        #expect(FinancesLevel("VIEW") == .view)
        #expect(FinancesLevel("edit") > .view)
        #expect(FinancesLevel("admin") == .none) // unknown: nothing
    }

    @Test func moneyCard() throws {
        let card = try JSONDecoder.homelab().decode(MoneyCard.self, from: Data(#"""
        {"payday":"2026-11-13","who":["Sam",""],"left":412.5,"bills":[{"name":"Rent","date":"2026-11-15","amount":1200}],"currency":"eur"}
        """#.utf8))
        #expect(card.payday != nil)
        #expect(card.who == ["Sam"])
        #expect(card.bills.first?.amount == 1200)
        #expect(card.currency == "EUR")
        #expect(!card.hidden)
    }

    @Test func hiddenAndNoPayday() throws {
        let card = try JSONDecoder.homelab().decode(MoneyCard.self, from: Data(#"{"left":0,"bills":[],"hidden":true,"currency":"€"}"#.utf8))
        #expect(card.payday == nil && card.hidden)
        #expect(card.currency == "USD")
    }

    @Test func localDays() {
        #expect(LocalDay.parse("2026-11-05") != nil)
        #expect(LocalDay.parse("2026-13-01") == nil)
        #expect(LocalDay.parse("soon") == nil)
        #expect(LocalDay.parse(nil) == nil)
    }
}

@Suite("Finances plan")
struct FinancesPlanTests {
    private let json = #"""
    {"today":"2026-11-05","checking":"chk","typed":"2026-11-01",
     "start":{"chk":2400,"sav":10000,"visa":350,"car":8000},
     "since":[],"paydays":[],"days":[],"worth":[],"next":{},"categories":[],
     "plan":{"people":[{"id":"p1","name":"Sam","schedule":{},"net":3000}],
             "accounts":[{"id":"chk","name":"Everyday","kind":"checking","balance":2400},
                         {"id":"sav","name":"Rainy day","kind":"savings","balance":10000},
                         {"id":"visa","name":"Visa","kind":"card","balance":350},
                         {"id":"car","name":"Car loan","kind":"loan","balance":8000}],
             "payments":[{"id":"rent","name":"Rent","amount":1200,"schedule":{}}],
             "cushion":500,"currency":"usd","hideAmounts":true,"logos":{"x":"data:image/png;base64,AAAA"}},
     "periods":[{"now":true,"start":"2026-11-05","last":"2026-11-12","carried":2400,"in":0,"out":1200,"saved":0,"left":400,
                 "rows":[{"date":"2026-11-10","payment":"rent","amount":1200,"after":1200,"estimate":true}],"accounts":{}},
                {"now":false,"start":"2026-11-13","last":"2026-11-26","pay":{"date":"2026-11-13","people":["p1"],"amount":3000},
                 "carried":400,"in":3000,"out":0,"saved":0,"left":3400,"rows":[],"accounts":{}}],
     "readOnly":true}
    """#

    @Test func decodesTheViewTheComputerSends() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        #expect(view.readOnly)
        #expect(view.plan.hideAmounts)
        #expect(view.plan.currency == "USD")
        #expect(view.periods.count == 2)
        #expect(view.periods[0].now && view.periods[0].left == 400)
        #expect(view.periods[0].rows.first?.estimate == true)
        #expect(view.periods[1].moneyIn == 3000)
        #expect(view.person("p1") == "Sam")
        #expect(view.payment("rent")?.name == "Rent")
    }

    @Test func netWorthSubtractsWhatIsOwed() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(json.utf8))
        // 2400 + 10000 − 350 (card) − 8000 (loan)
        #expect(view.netWorth == 4050)
    }
}

@Suite("App settings")
struct AppSettingTests {
    private func app(_ json: String) throws -> AppStatus {
        try JSONDecoder.homelab().decode(AppStatus.self, from: Data(json.utf8))
    }

    @Test func valuesFromStatus() throws {
        let held = try app(#"{"id":"immich","name":"Immich","state":"running","held":true,"quiet":true}"#)
        #expect(!AppSetting.updates.isOn(for: held))
        #expect(!AppSetting.alerts.isOn(for: held))
        let plain = try app(#"{"id":"immich","name":"Immich","state":"running"}"#)
        #expect(AppSetting.updates.isOn(for: plain) && AppSetting.alerts.isOn(for: plain))
    }

    @Test func nativeAppsHaveOnlyAlerts() throws {
        let native = try app(#"{"id":"jellyfin","name":"Jellyfin","state":"running","health":"native"}"#)
        #expect(AppSetting.available(for: native) == [.alerts])
        #expect(AppSetting.allCases.map(\.rawValue) == ["updates", "alerts"]) // what SetAppSetting takes
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

@Suite("Ledger")
struct LedgerTests {
    private let json = #"""
    {"transactions":[
      {"id":"a","date":"2026-10-30","account":"chk","amount":-12.99,"payee":"Netflix","category":"Streaming","tags":["tv"]},
      {"id":"c","date":"2026-11-02","account":"chk","amount":3000,"payee":"Sam's paycheck","category":"Paycheck"},
      {"id":"b","date":"2026-11-02","account":"chk","amount":-500,"to":"sav","payee":"","note":"rainy day","receipt":"r1.jpg"}
    ],"rev":"x"}
    """#

    @Test func newestFirstStable() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(json.utf8))
        #expect(ledger.newestFirst.map(\.id) == ["c", "b", "a"])
        #expect(ledger.transactions.first { $0.id == "b" }?.hasReceipt == true)
        #expect(ledger.transactions.first { $0.id == "b" }?.to == "sav")
    }

    @Test func search() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(json.utf8))
        #expect(ledger.transactions.filter { $0.matches("TV") }.map(\.id) == ["a"])
        #expect(ledger.transactions.filter { $0.matches("rainy") }.map(\.id) == ["b"])
        #expect(ledger.transactions.filter { $0.matches(" ") }.count == 3)
    }

    @Test func nullTransactions() throws {
        let ledger = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"{"transactions":null}"#.utf8))
        #expect(ledger.transactions.isEmpty)
    }
}

@Suite("Budgets, goals, loans")
struct FinanceExtrasTests {
    @Test func decodeExtras() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-05","plan":{"people":[],"accounts":[],"payments":[],"cushion":0},"periods":[],
         "budgets":[{"category":"Groceries","per":"month","start":"2026-11-01","last":"2026-11-30","amount":600,"spent":250,"left":350,"pace":100}],
         "goals":[{"id":"g","name":"Holiday","target":2000,"date":"2027-06-01","saved":500,"left":1500,"needsMonth":214.29,"reaches":"2027-04"}],
         "loans":[{"account":"car","balance":8000,"rate":4.9,"monthly":250,"months":36,"date":"2029-11","interest":600,"path":[1,2]}]}
        """#.utf8))
        #expect(view.budgets.first?.isAhead == true)
        #expect(view.budgets.first?.share == 250.0 / 600.0)
        #expect(view.goals.first?.reaches != nil && view.goals.first?.isReached == false)
        #expect(view.loans.first?.paidOff != nil && view.loans.first?.never == false)
    }

    @Test func aBadExtraCostsOnlyItself() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"plan":{"people":[],"accounts":[],"payments":[],"cushion":0},"periods":[],"goals":[{"name":"no id"}]}
        """#.utf8))
        #expect(view.goals.isEmpty)
    }

    @Test func months() {
        #expect(LocalDay.parseMonth("2027-04") != nil)
        #expect(LocalDay.parseMonth("2027") == nil)
        #expect(LocalDay.parseMonth(nil) == nil)
    }
}

@Suite("Editing the Finances plan")
struct FinancePlanEditTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"abc123","updated":"2026-10-01","cushion":500,"logos":{"chase":"data:image/png;base64,AAAA"},
     "accounts":[{"id":"chk","name":"Everyday","kind":"checking","balance":2400,"updated":"2026-10-01","history":[{"date":"2026-10-01","annual":2400}]},
                 {"id":"visa","name":"Visa","kind":"card","balance":350,"pending":20,"paidEach":true}],
     "payments":[{"id":"rent","name":"Rent","amount":1200,"schedule":{"every":"month","day":1}}]}
    """#.utf8))

    @Test func setsOnlyTheBalanceAndTheDays() throws {
        let edited = try #require(FinancePlanEdit.settingBalance(of: "visa", to: 412.346, today: "2026-11-05", in: plan))
        guard case .array(let accounts)? = edited["accounts"] else { Issue.record("no accounts"); return }
        #expect(accounts[1]["balance"] == .number(412.35))
        #expect(accounts[1]["updated"] == .string("2026-11-05"))
        #expect(accounts[1]["pending"] == .number(20))      // untouched
        #expect(accounts[1]["paidEach"] == .bool(true))     // untouched
        #expect(accounts[0] == plan["accounts"].flatMap { if case .array(let a) = $0 { return a[0] } else { return nil } })
        #expect(edited["updated"] == .string("2026-11-05"))
        // Everything the phone doesn't show goes back as it came, the rev included.
        #expect(edited["rev"] == .string("abc123"))
        #expect(edited["logos"] == plan["logos"])
        #expect(edited["payments"] == plan["payments"])
        #expect(edited["cushion"] == plan["cushion"])
    }

    @Test func refusesWhatItCannotSave() {
        #expect(FinancePlanEdit.settingBalance(of: "nope", to: 1, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: .infinity, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: .nan, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: 2e12, today: "2026-11-05", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: 1, today: "today", in: plan) == nil)
        #expect(FinancePlanEdit.settingBalance(of: "chk", to: 1, today: "2026-11-05", in: .array([])) == nil)
    }

    @Test func parsesAmountsAsTyped() {
        let us = Locale(identifier: "en_US")
        #expect(FinancePlanEdit.parseAmount("1,234.56", locale: us) == 1234.56)
        #expect(FinancePlanEdit.parseAmount("$1,200", locale: us) == 1200)
        #expect(FinancePlanEdit.parseAmount("-35.10", locale: us) == -35.1)
        #expect(FinancePlanEdit.parseAmount("abc", locale: us) == nil)
        #expect(FinancePlanEdit.parseAmount("", locale: us) == nil)
        #expect(FinancePlanEdit.parseAmount("1.234,56", locale: Locale(identifier: "de_DE")) == 1234.56)
    }

    @Test func today() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        #expect(FinancePlanEdit.todayString(GoTime.parse("2026-11-05T23:30:00Z")!, calendar: calendar) == "2026-11-05")
    }

    @Test func rawPlanRoundTripsThroughJSON() throws {
        let encoded = try JSONEncoder().encode(plan)
        let back = try JSONDecoder().decode(JSONValue.self, from: encoded)
        #expect(back == plan)
    }
}

@Suite("Adding a transaction")
struct LedgerEditTests {
    private let ledger = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r9","transactions":[{"id":"t1","date":"2026-11-01","account":"chk","amount":-5,"payee":"Café","bank":"FITID1","splits":[{"category":"Food","amount":-5}]}]}
    """#.utf8))
    private var utc: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func draft(_ amount: Double, moneyIn: Bool = false, payee: String = " Grocer ", account: String = "chk") -> NewTransaction {
        NewTransaction(date: GoTime.parse("2026-11-05T12:00:00Z")!, account: account, isMoneyIn: moneyIn, amount: amount, payee: payee, category: " Groceries ", note: "")
    }

    @Test func appendsSignedAndTrimmed() throws {
        let edited = try #require(LedgerEdit.appending(draft(42.199), accounts: ["chk"], calendar: utc, to: ledger))
        guard case .array(let all)? = edited["transactions"] else { Issue.record("no transactions"); return }
        #expect(all.count == 2)
        #expect(all[0] == (ledger["transactions"].flatMap { if case .array(let a) = $0 { return a[0] } else { return nil } })) // untouched
        let added = all[1]
        #expect(added["amount"] == .number(-42.2))
        #expect(added["date"] == .string("2026-11-05"))
        #expect(added["payee"] == .string("Grocer"))
        #expect(added["category"] == .string("Groceries"))
        #expect(added["note"] == nil)
        #expect(added["id"] == nil) // the computer gives it one
        #expect(edited["rev"] == .string("r9"))
    }

    @Test func moneyInIsPositive() throws {
        let edited = try #require(LedgerEdit.appending(draft(10, moneyIn: true), accounts: ["chk"], calendar: utc, to: ledger))
        guard case .array(let all)? = edited["transactions"] else { return }
        #expect(all.last?["amount"] == .number(10))
    }

    @Test func refusesWhatTheComputerWould() {
        #expect(LedgerEdit.problem(with: draft(0), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(0.004), accounts: ["chk"]) != nil) // rounds to nothing
        #expect(LedgerEdit.problem(with: draft(5, account: "gone"), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(5, payee: "  "), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(.nan), accounts: ["chk"]) != nil)
        #expect(LedgerEdit.problem(with: draft(5), accounts: ["chk"]) == nil)
    }

    @Test func emptyLedgersTakeOne() throws {
        let fromNull = try #require(LedgerEdit.appending(draft(5), accounts: ["chk"], calendar: utc, to: .null))
        guard case .array(let all)? = fromNull["transactions"] else { Issue.record("no transactions"); return }
        #expect(all.count == 1)
        let fromNullList = try #require(LedgerEdit.appending(draft(5), accounts: ["chk"], calendar: utc, to: .object(["transactions": .null])))
        #expect(fromNullList["transactions"] != nil)
    }
}

@Suite("Receipts")
struct ReceiptTests {
    private let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    @Test func names() {
        #expect(ReceiptCodec.isValidName("0123456789abcdef0123456789abcdef.jpg"))
        #expect(ReceiptCodec.isValidName("0123456789abcdef0123456789abcdef.pdf"))
        #expect(!ReceiptCodec.isValidName("0123456789ABCDEF0123456789ABCDEF.jpg"))
        #expect(!ReceiptCodec.isValidName("../etc/passwd"))
        #expect(!ReceiptCodec.isValidName("0123456789abcdef0123456789abcdef.svg"))
        #expect(!ReceiptCodec.isValidName("short.jpg"))
    }

    @Test func showsImagesAndPDFs() {
        if case .image? = ReceiptCodec.content(fromDataURL: "data:image/png;base64,\(png)") {} else { Issue.record("png not shown") }
        let pdf = Data("%PDF-1.4\n%%EOF".utf8).base64EncodedString()
        if case .pdf? = ReceiptCodec.content(fromDataURL: "data:application/pdf;base64,\(pdf)") {} else { Issue.record("pdf not shown") }
        // The declared type must match the bytes.
        #expect(ReceiptCodec.content(fromDataURL: "data:application/pdf;base64,\(png)") == nil)
        #expect(ReceiptCodec.content(fromDataURL: "data:text/html;base64,\(Data("<b>".utf8).base64EncodedString())") == nil)
    }

    @Test func photosAreReencodedWithoutMetadata() throws {
        let url = try #require(ReceiptCodec.preparePhoto(Data(base64Encoded: png)!))
        #expect(url.hasPrefix("data:image/jpeg;base64,"))
        let jpeg = try #require(Data(base64Encoded: String(url.dropFirst("data:image/jpeg;base64,".count))))
        let source = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
        let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] ?? [:]
        #expect(props[kCGImagePropertyGPSDictionary] == nil)
        #expect(props[kCGImagePropertyExifDictionary] == nil || (props[kCGImagePropertyExifDictionary] as? [CFString: Any])?[kCGImagePropertyExifDateTimeOriginal] == nil)
    }

    @Test func transactionsCarryAValidReceiptOnly() throws {
        let good = NewTransaction(date: Date(), account: "chk", isMoneyIn: false, amount: 5, payee: "Shop", category: "", note: "", receipt: "0123456789abcdef0123456789abcdef.jpg")
        #expect(LedgerEdit.appending(good, accounts: ["chk"], to: .null) != nil)
        var bad = good
        bad.receipt = "../../.env"
        #expect(LedgerEdit.appending(bad, accounts: ["chk"], to: .null) == nil)
    }
}

@Suite("Changing a transaction")
struct LedgerChangeTests {
    private let ledger = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r1","transactions":[
      {"id":"a","date":"2026-11-01","account":"chk","amount":-5,"payee":"Café","bank":"FITID1","tags":["coffee"],"receipt":"0123456789abcdef0123456789abcdef.jpg","category":"Food"},
      {"id":"b","date":"2026-11-02","account":"chk","amount":-500,"to":"sav","payee":"Savings"},
      {"id":"c","date":"2026-11-03","account":"chk","amount":-60,"payee":"Shop","splits":[{"category":"Food","amount":-40},{"category":"Home","amount":-20}]}
    ]}
    """#.utf8))

    private func draft() -> NewTransaction {
        NewTransaction(date: GoTime.parse("2026-11-04T12:00:00Z")!, account: "chk", isMoneyIn: false, amount: 6.5, payee: "Café Bleu", category: "", note: "oat milk")
    }

    @Test func updatesAndKeepsTheRest() throws {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let edited = try #require(LedgerEdit.updating(id: "a", with: draft(), accounts: ["chk"], calendar: utc, in: ledger))
        guard case .array(let all)? = edited["transactions"] else { Issue.record("no transactions"); return }
        let a = all[0]
        #expect(a["amount"] == .number(-6.5))
        #expect(a["payee"] == .string("Café Bleu"))
        #expect(a["date"] == .string("2026-11-04"))
        #expect(a["category"] == nil)                       // cleared
        #expect(a["note"] == .string("oat milk"))
        #expect(a["bank"] == .string("FITID1"))              // kept
        #expect(a["tags"] == .array([.string("coffee")]))    // kept
        #expect(a["receipt"] == .string("0123456789abcdef0123456789abcdef.jpg")) // kept
        #expect(a["id"] == .string("a"))
        #expect(edited["rev"] == .string("r1"))
    }

    @Test func transfersAndSplitsStayOnTheComputer() {
        #expect(LedgerEdit.updating(id: "b", with: draft(), accounts: ["chk"], in: ledger) == nil)
        #expect(LedgerEdit.updating(id: "c", with: draft(), accounts: ["chk"], in: ledger) == nil)
        #expect(LedgerEdit.updating(id: "zzz", with: draft(), accounts: ["chk"], in: ledger) == nil)
    }

    @Test func removesExactlyOne() throws {
        let edited = try #require(LedgerEdit.removing(id: "b", from: ledger))
        guard case .array(let all)? = edited["transactions"] else { Issue.record("no transactions"); return }
        #expect(all.map { $0["id"] } == [.string("a"), .string("c")])
        #expect(LedgerEdit.removing(id: "nope", from: ledger) == nil)
        #expect(LedgerEdit.removing(id: "", from: ledger) == nil)
    }
}
