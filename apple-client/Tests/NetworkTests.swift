import CoreGraphics
import Foundation
import ImageIO
import SwiftUI
import Testing
@testable import HomelabClient

// MARK: - The network rules

/// Answers requests in place of the network, and records what was asked.
final class StubProtocol: URLProtocol, @unchecked Sendable {
    struct Seen: Sendable {
        let url: URL
        let method: String
        let authorization: String?
        let body: Data
    }

    /// (status, headers, body, the answer's own URL or nil for the request's)
    typealias Answer = (Int, [String: String], Data, URL?)

    nonisolated(unsafe) static var answer: @Sendable (URLRequest) -> Answer = { _ in (200, [:], Data(), nil) }
    nonisolated(unsafe) static var seen: [Seen] = []
    private static let lock = NSLock()

    static func reset(_ answer: @escaping @Sendable (URLRequest) -> Answer) {
        lock.withLock {
            self.answer = answer
            seen = []
        }
    }

    static var requests: [Seen] { lock.withLock { seen } }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let n = stream.read(&buffer, maxLength: buffer.count)
                if n <= 0 { break }
                body.append(buffer, count: n)
            }
            stream.close()
        }
        // The answer sees the body too: the stream above can be read only once.
        var request = self.request
        request.httpBody = body
        let (status, headers, data, url) = Self.lock.withLock {
            Self.seen.append(Seen(url: request.url!, method: request.httpMethod ?? "GET",
                                  authorization: request.value(forHTTPHeaderField: "Authorization"), body: body))
            return Self.answer(request)
        }
        let response = HTTPURLResponse(url: url ?? request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

@Suite("Network rules", .serialized)
struct NetworkRuleTests {
    private static let token = "q2Vx8f_Lr-3n0TQ1ZkYb9w4sAeJm7HcPuDgRiNoXtW0"
    private static let origin = "https://mac.tail1234.ts.net:8099"

    private func client(paired: Bool = true) -> (APIClient, FakeCredentialStore) {
        let store = FakeCredentialStore(paired
            ? DeviceCredential(endpoint: try! ServerEndpoint.parse(Self.origin).endpoint, token: Self.token,
                               deviceID: "abc123", deviceName: "Test", pairedAt: Date())
            : nil)
        return (APIClient(keychain: store, protocolClasses: [StubProtocol.self]), store)
    }

    private static func json(_ text: String) -> Data { Data(text.utf8) }

    @Test func theTokenGoesToItsOriginInTheHeader() async throws {
        StubProtocol.reset { _ in (200, ["Content-Type": "application/json"], Self.json(#"{"id":"abc123","name":"Test","canChange":true}"#), nil) }
        let (api, _) = client()
        let me = try await api.me()
        #expect(me.canChange)
        let seen = try #require(StubProtocol.requests.first)
        #expect(seen.url.absoluteString == Self.origin + "/api/me")
        #expect(seen.authorization == "Bearer \(Self.token)")
    }

    @Test func notPairedSendsNothing() async {
        StubProtocol.reset { _ in (200, [:], Data(), nil) }
        let (api, _) = client(paired: false)
        await #expect(throws: APIError.notPaired) { try await api.me() }
        #expect(StubProtocol.requests.isEmpty)
    }

    @Test func statusesMeanWhatTheComputerMeans() async {
        let (api, _) = client()
        StubProtocol.reset { _ in (401, [:], Self.json(#"{"error":"this phone is not paired"}"#), nil) }
        await #expect(throws: APIError.unauthorized) { try await api.me() }

        StubProtocol.reset { _ in (403, [:], Self.json(#"{"error":"this phone can look but not change anything"}"#), nil) }
        await #expect(throws: APIError.forbidden("this phone can look but not change anything")) {
            try await api.perform(.restart, appID: "immich")
        }

        StubProtocol.reset { _ in (500, [:], Self.json(#"{"error":"exit status 1","log":["$ homelab restart immich","no such container"]}"#), nil) }
        await #expect(throws: APIError.actionFailed(message: "exit status 1", log: ["$ homelab restart immich", "no such container"])) {
            try await api.perform(.restart, appID: "immich")
        }
    }

    @Test func aRedirectIsRefused() async {
        StubProtocol.reset { _ in (302, ["Location": "https://evil.example/steal"], Data(), nil) }
        let (api, _) = client()
        await #expect(throws: APIError.redirectRefused) { try await api.me() }
        #expect(StubProtocol.requests.allSatisfy { $0.url.host == "mac.tail1234.ts.net" })
    }

    @Test func anAnswerFromAnotherOriginIsRefused() async {
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"id":"x","name":"x"}"#), URL(string: "https://evil.example/api/me")) }
        let (api, _) = client()
        await #expect(throws: APIError.originMismatch) { try await api.me() }
    }

    @Test func aMethodNameCannotChangeThePath() async {
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"result":null}"#), nil) }
        let (api, _) = client()
        await #expect(throws: APIError.invalidMethodName) { try await api.call("Status/../../evil", as: JSONValue.self) }
        await #expect(throws: APIError.invalidAppID) { try await api.perform(.stop, appID: "../x") }
        #expect(StubProtocol.requests.isEmpty)
    }

    @Test func callsSendTheirArgumentsAsAnArray() async throws {
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"result":null,"log":["ok"]}"#), nil) }
        let (api, _) = client()
        let log = try await api.perform(.restart, appID: "immich")
        #expect(log == ["ok"])
        let seen = try #require(StubProtocol.requests.first)
        #expect(seen.url.path == "/api/call/AppAction")
        #expect(seen.method == "POST")
        #expect(try JSONDecoder().decode([String].self, from: seen.body) == ["immich", "restart"])
    }

    @Test func aWallScreenPairsAsAKiosk() async throws {
        let endpoint = try ServerEndpoint.parse(Self.origin).endpoint
        let code = try #require(PairingCode("ABCD2345"))
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"token":"\#(Self.token)","device":{"id":"abc123","name":"Hall","canChange":false}}"#), nil) }
        let (api, _) = client(paired: false)
        let device = try await api.pair(code: code, deviceName: "Hall", at: endpoint, kiosk: true)
        #expect(!device.canChange)
        let body = try JSONDecoder().decode([String: JSONValue].self, from: try #require(StubProtocol.requests.first).body)
        #expect(body["kiosk"] == .bool(true))
    }

    @Test func pairingStoresOnlyAWellFormedToken() async throws {
        let endpoint = try ServerEndpoint.parse(Self.origin).endpoint
        let code = try #require(PairingCode("ABCD2345"))

        StubProtocol.reset { _ in (200, [:], Self.json(#"{"token":"bad token","device":{"id":"abc123","name":"Phone","canChange":false}}"#), nil) }
        let (api, store) = client(paired: false)
        await #expect(throws: APIError.invalidResponse) { try await api.pair(code: code, deviceName: "Phone", at: endpoint) }
        #expect(!store.hasCredential)
        let sent = try #require(StubProtocol.requests.first)
        #expect(sent.authorization == nil) // pairing sends no token
        let body = try JSONDecoder().decode([String: JSONValue].self, from: sent.body)
        #expect(body["code"] == .string("ABCD2345") && body["kiosk"] == .bool(false))

        StubProtocol.reset { _ in (200, [:], Self.json(#"{"token":"\#(Self.token)","device":{"id":"abc123","name":"Phone","canChange":false}}"#), nil) }
        _ = try await api.pair(code: code, deviceName: "Phone", at: endpoint)
        #expect(store.hasCredential)
        #expect(try store.loadCredential()?.endpoint == endpoint)
    }
}

// Live events run against the same stub, so they're in the same
// serialized suite: two suites must not set its answers at once.
extension NetworkRuleTests {
    private static let statusJSON = #"{"apps":[{"id":"immich","name":"Immich","state":"running"}],"missing":0,"unmatched":0,"savings":0}"#

    /// Waits up to 5 seconds for `condition`.
    @MainActor
    private func eventually(_ condition: @MainActor () -> Bool) async -> Bool {
        for _ in 0..<100 {
            if condition() { return true }
            try? await Task.sleep(for: .milliseconds(50))
        }
        return condition()
    }

    private static func answer(events: StubProtocol.Answer) -> @Sendable (URLRequest) -> StubProtocol.Answer {
        { request in
            switch request.url?.path {
            case "/api/events": return events
            case "/api/call/LastStatus": return (200, [:], json(#"{"result":null}"#), nil)
            case "/api/call/Status": return (200, [:], json(#"{"result":\#(statusJSON)}"#), nil)
            default: return (404, [:], json(#"{"error":"not here"}"#), nil)
            }
        }
    }

    @Test @MainActor func aChangeWithoutStatusReadsStatus() async {
        StubProtocol.reset(Self.answer(events: (200, ["Content-Type": "text/event-stream"],
                                                 Self.json(": following\n\ndata: {\"apps\":[\"immich\"]}\n\n"), nil)))
        let (api, _) = client()
        let live = LiveEventManager(api: api)
        live.start()
        #expect(await eventually { live.status?.apps.first?.id == "immich" })
        #expect(StubProtocol.requests.contains { $0.url.path == "/api/call/Status" })
        #expect(StubProtocol.requests.filter { $0.url.path == "/api/events" }.allSatisfy { $0.authorization == "Bearer \(Self.token)" })
        live.clear()
        #expect(live.status == nil)
        #expect(live.connection == .idle)
    }

    @Test @MainActor func aRefusedStreamUnpairsInsteadOfRetrying() async {
        StubProtocol.reset(Self.answer(events: (401, [:], Self.json(#"{"error":"this phone is not paired"}"#), nil)))
        let (api, _) = client()
        let live = LiveEventManager(api: api)
        final class Flag { var on = false }
        let unpaired = Flag()
        live.onUnauthorized = { unpaired.on = true }
        live.start()
        #expect(await eventually { unpaired.on })
        if case .stopped = live.connection {} else { Issue.record("not stopped: \(live.connection)") }
        let tries = StubProtocol.requests.filter { $0.url.path == "/api/events" }.count
        try? await Task.sleep(for: .milliseconds(1500))
        #expect(StubProtocol.requests.filter { $0.url.path == "/api/events" }.count == tries) // no retry
        live.clear()
    }

    @Test @MainActor func aStreamThatIsNotSSEIsNotTrusted() async {
        StubProtocol.reset(Self.answer(events: (200, ["Content-Type": "text/html"], Self.json("<html>"), nil)))
        let (api, _) = client()
        let live = LiveEventManager(api: api)
        live.start()
        #expect(await eventually {
            if case .reconnecting = live.connection { return true }
            return false
        })
        live.clear()
    }

    @Test @MainActor func nothingIsKeptWhileStopped() throws {
        let (api, _) = client()
        let live = LiveEventManager(api: api)
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Self.json(Self.statusJSON))
        live.ingest(status) // a late answer after a lock
        #expect(live.status == nil)
    }
}

// Whole-homelab jobs, against the same stub (so in the serialized suite).
extension NetworkRuleTests {
    @MainActor
    private func tasks(canChange: Bool, allow: Bool = true) -> (HomelabTasksViewModel, APIClient) {
        let (api, _) = client()
        let device = try! JSONDecoder().decode(DeviceInfo.self, from: Data(#"{"id":"abc123","name":"Test","canChange":\#(canChange)}"#.utf8))
        let vm = HomelabTasksViewModel(api: api, device: { device }, authorize: { _ in allow }, didFinish: { _ in })
        return (vm, api)
    }

    private static func homelabArgs(_ seen: StubProtocol.Seen) throws -> [JSONValue] {
        try JSONDecoder().decode([JSONValue].self, from: seen.body)
    }

    @Test @MainActor func lookingForProblemsNeverApplies() async throws {
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"result":null,"log":["Would restart immich"]}"#), nil) }
        let (vm, _) = tasks(canChange: true)
        await vm.run(.fix)
        let seen = try #require(StubProtocol.requests.first)
        #expect(seen.url.path == "/api/call/Homelab")
        #expect(try Self.homelabArgs(seen) == [.string("fix"), .string(""), .bool(false)])
        #expect(vm.output?.isFixPreview == true)

        // Only Fix These applies, and only then.
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"result":null,"log":["Restarted immich"]}"#), nil) }
        await vm.run(.fix, apply: true)
        #expect(try Self.homelabArgs(try #require(StubProtocol.requests.first)) == [.string("fix"), .string(""), .bool(true)])
        #expect(vm.output?.isFixPreview == false)
    }

    @Test @MainActor func aLookOnlyDeviceOrARefusedPromptSendsNothing() async {
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"result":null}"#), nil) }
        let (lookOnly, _) = tasks(canChange: false)
        await lookOnly.run(.backup)
        let (refused, _) = tasks(canChange: true, allow: false)
        await refused.run(.backup)
        #expect(StubProtocol.requests.isEmpty)
        #expect(refused.running == nil)
    }
}

// App actions, against the same stub.
extension NetworkRuleTests {
    @MainActor
    private func actions(canChange: Bool) -> AppActionsViewModel {
        let (api, _) = client()
        let device = try! JSONDecoder().decode(DeviceInfo.self, from: Data(#"{"id":"abc123","name":"Test","canChange":\#(canChange)}"#.utf8))
        return AppActionsViewModel(api: api, liveEvents: LiveEventManager(api: api), device: { device }, authorize: { _ in true })
    }

    private static func apps(_ json: String) -> [AppStatus] { try! JSONDecoder.homelab().decode([AppStatus].self, from: Data(json.utf8)) }

    private static func appActions() -> [[JSONValue]] {
        StubProtocol.requests.filter { $0.url.path == "/api/call/AppAction" }.compactMap { try? JSONDecoder().decode([JSONValue].self, from: $0.body) }
    }

    @Test @MainActor func stopWaitsForConfirmation() async {
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"result":null,"log":[]}"#), nil) }
        let vm = actions(canChange: true)
        let app = Self.apps(#"[{"id":"immich","name":"Immich","state":"running"}]"#)[0]
        vm.request(.stop, on: app)
        #expect(vm.confirmation?.action == .stop)
        try? await Task.sleep(for: .milliseconds(200))
        #expect(Self.appActions().isEmpty) // nothing sent before confirming
    }

    @Test @MainActor func aLookOnlyDeviceSendsNoAction() async {
        StubProtocol.reset { _ in (200, [:], Self.json(#"{"result":null}"#), nil) }
        let vm = actions(canChange: false)
        let app = Self.apps(#"[{"id":"immich","name":"Immich","state":"running"}]"#)[0]
        await vm.run(.restart, on: app)
        #expect(Self.appActions().isEmpty)
        #expect(vm.available(for: app).isEmpty)
    }

    @Test @MainActor func aGroupStopsAtTheFirstFailure() async {
        StubProtocol.reset { request in
            guard request.url?.path == "/api/call/AppAction" else { return (404, [:], Self.json(#"{"error":"not here"}"#), nil) }
            let body = (try? JSONDecoder().decode([String].self, from: request.httpBody ?? Data())) ?? []
            if body.first == "b" { return (500, [:], Self.json(#"{"error":"exit status 1","log":["no such container"]}"#), nil) }
            return (200, [:], Self.json(#"{"result":null,"log":[]}"#), nil)
        }
        let vm = actions(canChange: true)
        let list = Self.apps(#"[{"id":"a","name":"A","state":"running"},{"id":"b","name":"B","state":"running"},{"id":"c","name":"C","state":"running"}]"#)
        await vm.runGroup(.restart, on: list)
        let sent = Self.appActions().compactMap { args -> String? in if case .string(let id)? = args.first { return id } else { return nil } }
        #expect(sent == ["a", "b"])                  // c is never tried
        #expect(vm.pending["b"]?.failure != nil)     // b says why
        #expect(vm.pending["a"] == nil)
        #expect(!vm.isBusy)
    }
}
