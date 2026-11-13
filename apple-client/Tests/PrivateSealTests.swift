import CryptoKit
import Foundation
import Testing
@testable import HomelabClient

// A household member's private Finances (private-finances.md 3.1): the app
// seals and opens exactly as the phone's page does (web/src/finances/seal.ts).
// Resources/PrivateSealVectors.json is the page's own work, made-up Finances
// with a fixed recovery code, passphrase and passkey secret, written by
// `node app/preview/seal.mjs --update-vectors`, which also checks it each run.

private struct PrivateSealVectors: Decodable {
    struct Receipt: Decodable { let plain: String; let sealed: String }
    let username: String
    let plain: String
    let code: String
    let codeWords: [String]
    let words: [String]
    let passphrase: String
    let passkeySecret: String
    let passkeyCredential: String
    let prfInput: String
    let byPasskey: PrivateSeal.Envelope
    let byPassphrase: PrivateSeal.Envelope
    let receipt: Receipt

    static func load() throws -> PrivateSealVectors {
        let url = try #require(Bundle.module.url(forResource: "PrivateSealVectors", withExtension: "json"))
        return try JSONDecoder().decode(PrivateSealVectors.self, from: Data(contentsOf: url))
    }
}

private func bytes(_ base64: String) throws -> Data {
    try #require(Data(base64Encoded: base64))
}

/// Made-up Finances, never anyone's.
private let madeUp = Data(#"{"plan":{"cushion":500},"ledger":{"transactions":[{"id":"t1","payee":"Made-up Grocer","amount":-42.17}]}}"#.utf8)

@Suite("Private Finances, sealed on her phone")
struct PrivateSealTests {
    @Test("scrypt matches RFC 7914")
    func scryptVectors() throws {
        let out = try PrivateSeal.scrypt(password: Data("pleaseletmein".utf8), salt: Data("SodiumChloride".utf8), n: 16384, r: 8, p: 1, length: 64)
        #expect(out.map { String(format: "%02x", $0) }.joined() == "7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2d5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887")
    }

    @Test("The words and the passkey's input are the page's")
    func sameWords() throws {
        let v = try PrivateSealVectors.load()
        #expect(PrivateSeal.words == v.words)
        #expect(PrivateSeal.codeWords(try bytes(v.code)) == v.codeWords)
        #expect(PrivateSeal.code(fromWords: "  " + v.codeWords.joined(separator: "  ").uppercased() + "\n") == (try bytes(v.code)))
        #expect(PrivateSeal.code(fromWords: v.codeWords.dropFirst().joined(separator: " ")) == nil)
        #expect(PrivateSeal.prfInput == Data(v.prfInput.utf8))
    }

    @Test("What the page sealed opens here, by the code, the passkey and the passphrase")
    func opensThePages() throws {
        let v = try PrivateSealVectors.load()
        let byCode = try PrivateSeal.unlock(v.byPasskey, username: v.username, code: try bytes(v.code))
        let byPasskey = try PrivateSeal.unlock(v.byPasskey, username: v.username, passkeySecret: try bytes(v.passkeySecret))
        let byPassphrase = try PrivateSeal.unlock(v.byPassphrase, username: v.username, passphrase: v.passphrase)
        #expect(try PrivateSeal.open(v.byPasskey, key: byCode, username: v.username) == Data(v.plain.utf8))
        #expect(try PrivateSeal.open(v.byPasskey, key: byPasskey, username: v.username) == Data(v.plain.utf8))
        #expect(try PrivateSeal.open(v.byPassphrase, key: byPassphrase, username: v.username) == Data(v.plain.utf8))
        #expect(try PrivateSeal.openText(v.receipt.sealed, key: byPasskey, username: v.username) == v.receipt.plain)
        #expect(v.byPasskey.kdf.passkey == v.passkeyCredential)
    }

    @Test("A wrong code, another member, or a changed byte is refused")
    func refusals() throws {
        let v = try PrivateSealVectors.load()
        #expect(throws: PrivateSeal.Problem.wrongCode) { try PrivateSeal.unlock(v.byPasskey, username: v.username, code: PrivateSeal.newCode()) }
        #expect(throws: PrivateSeal.Problem.wrongPassphrase) { try PrivateSeal.unlock(v.byPassphrase, username: v.username, passphrase: v.passphrase + "!") }
        #expect(throws: PrivateSeal.Problem.wrongPasskey) { try PrivateSeal.unlock(v.byPasskey, username: v.username, passkeySecret: Data(count: 32)) }
        #expect(throws: PrivateSeal.Problem.wrongCode) { try PrivateSeal.unlock(v.byPasskey, username: "sam", code: try bytes(v.code)) }
        let key = try PrivateSeal.unlock(v.byPasskey, username: v.username, code: try bytes(v.code))
        #expect(throws: PrivateSeal.Problem.notTheirs) { try PrivateSeal.open(v.byPasskey, key: key, username: "sam") }
        var changed = try bytes(v.byPasskey.sealed)
        changed[changed.count - 3] ^= 1
        var tampered = v.byPasskey
        tampered.sealed = changed.base64EncodedString()
        #expect(throws: PrivateSeal.Problem.notTheirs) { try PrivateSeal.open(tampered, key: key, username: v.username) }
    }

    @Test("Turned on here: each way opens the same key, and a save seals anew under it")
    func roundTrip() throws {
        let code = PrivateSeal.newCode()
        let secret = Data(repeating: 9, count: 32)
        let on = try PrivateSeal.turnOn(madeUp, username: "anna", code: code, passkey: .init(secret: secret, credential: Data([5, 6])))
        #expect(on.envelope.version == 1 && on.envelope.kdf.name == "scrypt" && on.envelope.kdf.n == 1 << 17 && on.envelope.kdf.r == 8 && on.envelope.kdf.p == 1)
        #expect(try bytes(on.envelope.wrappedByCode).count == 60)
        #expect(try bytes(on.envelope.sealed).range(of: Data("Made-up".utf8)) == nil)
        let byCode = try PrivateSeal.unlock(on.envelope, username: "anna", code: code)
        let byPasskey = try PrivateSeal.unlock(on.envelope, username: "anna", passkeySecret: secret)
        for key in [on.key, byCode, byPasskey] {
            #expect(try PrivateSeal.open(on.envelope, key: key, username: "anna") == madeUp)
        }
        let next = Data(#"{"plan":{"cushion":600},"ledger":{}}"#.utf8)
        let saved = try PrivateSeal.reseal(on.envelope, key: on.key, username: "anna", plain: next)
        #expect(saved.sealed != on.envelope.sealed && saved.wrappedByCode == on.envelope.wrappedByCode)
        #expect(try PrivateSeal.open(saved, key: byCode, username: "anna") == next)
        let receipt = try PrivateSeal.sealText("data:image/jpeg;base64,AAAA", key: on.key, username: "anna")
        #expect(try PrivateSeal.openText(receipt, key: byPasskey, username: "anna") == "data:image/jpeg;base64,AAAA")
    }

    @Test("A passphrase under 12 characters is refused")
    func shortPassphrase() {
        #expect(throws: PrivateSeal.Problem.shortPassphrase) { try PrivateSeal.turnOn(madeUp, username: "anna", code: PrivateSeal.newCode(), passphrase: "short one") }
    }
}
