#if SCREENSHOTS
import Foundation

// The app as its screenshots show it, built only with the SCREENSHOTS flag
// (the "Apple client" workflow's screenshots job): paired with a sample
// homelab that isn't there, unlocked without Face ID, every answer read
// from Screenshots/data.json (scripts/make-screenshot-data.mjs), which the
// job copies into the app's Documents. Nothing here is in the app people run.

/// What to show: `-shot <name>` when the app is launched.
enum ScreenshotMode {
    /// A tab (status, backups, finances, setup, settings) or a page of
    /// Finances (transactions, transaction, budgets, bills, accounts, investments, goals).
    static let shot: String? = value(after: "-shot")
    /// Amounts kept hidden, as Finances opens.
    static let hidesAmounts = ProcessInfo.processInfo.arguments.contains("-hidden")

    private static func value(after flag: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: flag), args.indices.contains(i + 1) else { return nil }
        return args[i + 1]
    }
}

/// Paired with the sample homelab.
struct ScreenshotCredentials: CredentialStore {
    func saveCredential(_ credential: DeviceCredential) throws {}
    func loadCredential() throws -> DeviceCredential? {
        guard let endpoint = try? ServerEndpoint.parse("https://homelab.example.com").endpoint else { return nil }
        return DeviceCredential(endpoint: endpoint, token: "screenshots-sample-token", deviceID: "screenshots",
                                deviceName: "iPhone", pairedAt: Date(timeIntervalSinceNow: -30 * 86_400))
    }
    func deleteCredential() throws {}
    func deleteAll() throws {}
}

/// Unlocks without asking.
struct ScreenshotOwner: OwnerAuthenticator {
    func availableMethod() -> BiometricAuthManager.Method { .faceID }
    func authenticate(reason: String) async throws {}
}

/// The sample homelab's answers, by method.
enum ScreenshotData {
    struct Loaded: Sendable {
        var me = Data("{}".utf8)
        var answers: [String: Data] = [:]
        var cards: [String: Data] = [:]
    }

    static let loaded: Loaded = load()

    private static func load() -> Loaded {
        guard let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
              var text = try? String(contentsOf: folder.appendingPathComponent("screenshot-data.json"), encoding: .utf8)
        else { return Loaded() }
        // "@ago:<seconds>" is that long before now.
        let formatter = ISO8601DateFormatter()
        if let re = try? NSRegularExpression(pattern: #"@ago:(-?\d+)"#) {
            let ns = text as NSString
            var out = ""
            var last = 0
            for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
                out += ns.substring(with: NSRange(location: last, length: m.range.location - last))
                let seconds = Double(ns.substring(with: m.range(at: 1))) ?? 0
                out += formatter.string(from: Date(timeIntervalSinceNow: -seconds))
                last = m.range.location + m.range.length
            }
            out += ns.substring(from: last)
            text = out
        }
        guard let root = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any] else { return Loaded() }
        func data(_ value: Any) -> Data {
            (try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])) ?? Data("null".utf8)
        }
        var loaded = Loaded()
        if let me = root["me"] { loaded.me = data(me) }
        for (method, answer) in root["answers"] as? [String: Any] ?? [:] {
            loaded.answers[method] = data(["result": answer])
        }
        for (name, card) in root["cards"] as? [String: Any] ?? [:] {
            loaded.cards[name] = data(card)
        }
        return loaded
    }
}

/// Answers every request from the sample homelab, in place of the network.
final class ScreenshotURLProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let path = url.path
        let data = ScreenshotData.loaded
        var type = "application/json"
        var body = Data(#"{"error":"not in the screenshots"}"#.utf8)
        var finishes = true
        if path == "/api/me" {
            body = data.me
        } else if path == "/api/events" {
            // Open, with nothing new: Status comes from the Status call.
            type = "text/event-stream"
            body = Data(": screenshots\n\n".utf8)
            finishes = false
        } else if path.hasPrefix("/api/call/") {
            let method = String(path.dropFirst("/api/call/".count))
            if method == "StatusBoard" {
                type = "application/x-ndjson"
                body = statusBoard(data)
            } else if let answer = data.answers[method] {
                body = answer
            }
        }
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": type]) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        if finishes { client?.urlProtocolDidFinishLoading(self) }
    }

    override func stopLoading() {}

    /// Status, then each card asked for, as `StatusBoard` answers in lines.
    private func statusBoard(_ data: ScreenshotData.Loaded) -> Data {
        var board = 0
        var wanted: [String] = []
        if let args = (try? JSONSerialization.jsonObject(with: requestBody())) as? [Any] {
            board = (args.first as? NSNumber)?.intValue ?? 0
            wanted = args.dropFirst().first as? [String] ?? []
        }
        var out = Data()
        if let status = data.answers["Status"] { out += status + Data("\n".utf8) }
        for name in wanted {
            guard let card = data.cards[name], let value = try? JSONSerialization.jsonObject(with: card, options: [.fragmentsAllowed]),
                  let line = try? JSONSerialization.data(withJSONObject: ["event": "status:card", "data": ["board": board, "name": name, "data": value]] as [String: Any])
            else { continue }
            out += line + Data("\n".utf8)
        }
        return out
    }

    private func requestBody() -> Data {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return Data() }
        var body = Data()
        stream.open()
        defer { stream.close() }
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let n = stream.read(&buffer, maxLength: buffer.count)
            if n <= 0 { break }
            body.append(buffer, count: n)
        }
        return body
    }
}
#endif
