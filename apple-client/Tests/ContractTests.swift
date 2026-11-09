import Foundation
import Testing
@testable import HomelabClient

/// What the computer says of itself, as it says it: Resources/
/// CompanionContract.json, written by cmd/homelab's TestCompanionContract,
/// which fails when the file is out of date. A call added, renamed or
/// removed on the computer changes the file, and these check the phone
/// still reads it and calls nothing the computer lacks.
@Suite("The computer's contract")
struct ContractTests {
    private static func me() throws -> Data {
        let url = try #require(Bundle.module.url(forResource: "CompanionContract", withExtension: "json"))
        let object = try JSONSerialization.jsonObject(with: Data(contentsOf: url))
        let whole = try #require(object as? [String: Any])
        let me = try #require(whole["me"])
        return try JSONSerialization.data(withJSONObject: me)
    }

    @Test func thePhoneReadsWhatTheComputerSaysOfItself() throws {
        let me = try JSONDecoder.homelab().decode(DeviceInfo.self, from: Self.me())
        #expect(me.id == "a1b2c3" && me.canChange && me.finances == "edit")
        let computer = try #require(me.computer)
        #expect(computer.version == "1.2.3")
        #expect(computer.answers("Status") && computer.features.contains("tunnel"))
    }

    @Test func aComputerOlderThanThatSaysNothing() throws {
        let me = try JSONDecoder.homelab().decode(DeviceInfo.self, from: Data(#"{"id":"a","name":"Phone"}"#.utf8))
        #expect(me.computer == nil)
        // One that doesn't read is left out, not a failed read.
        let odd = try JSONDecoder.homelab().decode(DeviceInfo.self, from: Data(#"{"id":"a","name":"Phone","computer":"new"}"#.utf8))
        #expect(odd.computer == nil)
    }

    /// Every call the app's code names (`call("…")`, `callRequest("…")`,
    /// `/api/call/…`) is one the computer answers.
    @Test func thePhoneCallsNothingTheComputerLacks() throws {
        let me = try JSONDecoder.homelab().decode(DeviceInfo.self, from: Self.me())
        let answers = Set(try #require(me.computer).methods)
        let shared = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Shared")
        let pattern = try NSRegularExpression(pattern: #"(?:call|callRequest)\(\s*"([A-Z][A-Za-z]+)"|/api/call/([A-Z][A-Za-z]+)"#)
        var named = Set<String>()
        let files = try #require(FileManager.default.enumerator(at: shared, includingPropertiesForKeys: nil))
        for case let file as URL in files where file.pathExtension == "swift" {
            let text = try String(contentsOf: file, encoding: .utf8)
            for match in pattern.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
                for group in 1...2 {
                    if let range = Range(match.range(at: group), in: text) { named.insert(String(text[range])) }
                }
            }
        }
        #expect(named.count > 10, "the app's calls weren't found under \(shared.path)")
        let missing = named.subtracting(answers).sorted()
        #expect(missing.isEmpty, "the phone calls what the computer doesn't answer: \(missing)")
    }
}
