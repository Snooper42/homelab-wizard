import CryptoKit
import Foundation

/// Away from home through the Cloudflare tunnel (docs/Decisions.md,
/// ADR-0023): what the phone seals and opens, as the computer does in
/// internal/companion/tunnel.go.
///
/// At pairing, at home, the phone sends its Curve25519 public key and gets
/// the computer's; both derive one AES-256-GCM key with HKDF-SHA256 (salt:
/// the phone's ID, info: `TunnelSeal.info`). Every request through the
/// tunnel is sealed with it, bound to the phone's ID, and carries the
/// device token and its time; every answer is bound to the request it
/// answers. Cloudflare, which opens the tunnel's TLS, reads none of it.
///
/// `Tests/Resources/TunnelVectors.json`, written by the computer's own code
/// (internal/companion/vectors_test.go), holds fixed keys and boxes that
/// `TunnelSealTests` checks this against.
enum TunnelSeal {
    /// The key's use, so the key agreed at pairing is never another's.
    static let info = "homelab-wizard companion tunnel v1"

    /// The additional data a request is sealed with.
    static func requestAD(deviceID: String) -> Data {
        Data("homelab tunnel request\u{0}\(deviceID)".utf8)
    }

    /// The additional data an answer to the request with `nonce` is sealed with.
    static func answerAD(deviceID: String, requestNonce: String) -> Data {
        Data("homelab tunnel answer\u{0}\(deviceID)\u{0}\(requestNonce)".utf8)
    }

    enum Failure: Error, Equatable {
        case badKey
        case notSealed
    }

    /// The key both sides derive: from this phone's private key, the
    /// computer's public key (the pairing answer's `tunnelKey`), and the
    /// phone's ID.
    static func key(phone: Curve25519.KeyAgreement.PrivateKey, computer: Data, deviceID: String) throws -> SymmetricKey {
        guard let theirs = try? Curve25519.KeyAgreement.PublicKey(rawRepresentation: computer) else { throw Failure.badKey }
        let shared = try phone.sharedSecretFromKeyAgreement(with: theirs)
        return shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: Data(deviceID.utf8), sharedInfo: Data(info.utf8), outputByteCount: 32)
    }

    /// Seals `plain` with a new random nonce; the box is the ciphertext and
    /// its tag, as the computer's.
    static func seal(_ plain: Data, key: SymmetricKey, ad: Data) throws -> (nonce: Data, box: Data) {
        try seal(plain, key: key, ad: ad, nonce: AES.GCM.Nonce())
    }

    /// Seals with a given nonce: for the tests' fixed vectors only, as a nonce
    /// is never used twice with one key.
    static func seal(_ plain: Data, key: SymmetricKey, ad: Data, nonce: AES.GCM.Nonce) throws -> (nonce: Data, box: Data) {
        let sealed = try AES.GCM.seal(plain, using: key, nonce: nonce, authenticating: ad)
        return (Data(nonce), sealed.ciphertext + sealed.tag)
    }

    /// Opens a box the computer sealed with the same key and additional data.
    static func open(_ box: Data, nonce: Data, key: SymmetricKey, ad: Data) throws -> Data {
        guard box.count >= 16, let n = try? AES.GCM.Nonce(data: nonce) else { throw Failure.notSealed }
        let sealed = try AES.GCM.SealedBox(nonce: n, ciphertext: box.dropLast(16), tag: box.suffix(16))
        return try AES.GCM.open(sealed, using: key, authenticating: ad)
    }
}
