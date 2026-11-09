import CryptoKit
import Foundation
import Testing
@testable import HomelabClient

// Away from home through the tunnel (ADR-0023): the phone seals and opens
// exactly as the computer does. Resources/TunnelVectors.json is the
// computer's own work with fixed keys and nonces, written by
// internal/companion/vectors_test.go (go test ./internal/companion -run
// TestTunnelVectors -update-vectors).

private struct TunnelVectors: Decodable {
    struct Message: Decodable { let ad: String; let nonce: String; let plain: String; let box: String }
    let phonePrivate: String
    let phonePublic: String
    let computerPublic: String
    let deviceID: String
    let info: String
    let key: String
    let request: Message
    let answer: Message

    static func load() throws -> TunnelVectors {
        let url = try #require(Bundle.module.url(forResource: "TunnelVectors", withExtension: "json"))
        return try JSONDecoder().decode(TunnelVectors.self, from: Data(contentsOf: url))
    }
}

private func bytes(_ base64: String) throws -> Data {
    try #require(Data(base64Encoded: base64))
}

private func raw(_ key: SymmetricKey) -> Data {
    key.withUnsafeBytes { Data($0) }
}

@Suite("Sealing through the tunnel")
struct TunnelSealTests {
    @Test("The phone derives the computer's key")
    func derivesTheSameKey() throws {
        let v = try TunnelVectors.load()
        #expect(v.info == TunnelSeal.info)
        let phone = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: bytes(v.phonePrivate))
        let phonePublic = try bytes(v.phonePublic)
        #expect(phone.publicKey.rawRepresentation == phonePublic)
        let key = try TunnelSeal.key(phone: phone, computer: bytes(v.computerPublic), deviceID: v.deviceID)
        let want = try bytes(v.key)
        #expect(raw(key) == want)
    }

    @Test("A request seals as the computer would, and an answer opens")
    func sealsAndOpensAsTheComputer() throws {
        let v = try TunnelVectors.load()
        let key = SymmetricKey(data: try bytes(v.key))
        #expect(TunnelSeal.requestAD(deviceID: v.deviceID) == Data(v.request.ad.utf8))
        let nonce = try AES.GCM.Nonce(data: bytes(v.request.nonce))
        let sealed = try TunnelSeal.seal(Data(v.request.plain.utf8), key: key, ad: TunnelSeal.requestAD(deviceID: v.deviceID), nonce: nonce)
        let wantBox = try bytes(v.request.box)
        #expect(sealed.box == wantBox)

        let ad = TunnelSeal.answerAD(deviceID: v.deviceID, requestNonce: v.request.nonce)
        #expect(ad == Data(v.answer.ad.utf8))
        let plain = try TunnelSeal.open(bytes(v.answer.box), nonce: bytes(v.answer.nonce), key: key, ad: ad)
        #expect(String(decoding: plain, as: UTF8.self) == v.answer.plain)
    }

    @Test("A box changed on the way, or for another request, doesn't open")
    func refusesTamperedOrMisboundBoxes() throws {
        let v = try TunnelVectors.load()
        let key = SymmetricKey(data: try bytes(v.key))
        let good = try bytes(v.answer.box)
        let nonce = try bytes(v.answer.nonce)
        var changed = good
        changed[changed.startIndex] ^= 1
        let right = TunnelSeal.answerAD(deviceID: v.deviceID, requestNonce: v.request.nonce)
        #expect(throws: (any Error).self) {
            _ = try TunnelSeal.open(changed, nonce: nonce, key: key, ad: right)
        }
        #expect(throws: (any Error).self) {
            _ = try TunnelSeal.open(good, nonce: nonce, key: key, ad: TunnelSeal.answerAD(deviceID: v.deviceID, requestNonce: "another"))
        }
        #expect(throws: TunnelSeal.Failure.notSealed) {
            _ = try TunnelSeal.open(Data([1, 2, 3]), nonce: nonce, key: key, ad: Data())
        }
    }

    @Test("A fresh seal opens again, with a new nonce each time")
    func roundTrips() throws {
        let key = SymmetricKey(size: .bits256)
        let ad = TunnelSeal.requestAD(deviceID: "abc123")
        let a = try TunnelSeal.seal(Data("hello".utf8), key: key, ad: ad)
        let b = try TunnelSeal.seal(Data("hello".utf8), key: key, ad: ad)
        #expect(a.nonce != b.nonce)
        let opened = try TunnelSeal.open(a.box, nonce: a.nonce, key: key, ad: ad)
        #expect(opened == Data("hello".utf8))
    }
}
