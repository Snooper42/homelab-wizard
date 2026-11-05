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

    @Test func onlyStopIsConfirmed() {
        #expect(AppAction.allCases.filter(\.needsConfirmation) == [.stop])
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
