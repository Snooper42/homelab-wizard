import CryptoKit
import Foundation

/// A household member's private Finances, sealed on her own phone so only
/// she can open them, the person who runs the homelab included
/// (.claude/prompts/private-finances.md 3.1). The same format as the phone's
/// page (web/src/finances/seal.ts, where it is written out), so either can
/// open what the other sealed: PrivateSealTests opens the page's own work.
///
/// A random data key seals her plan and ledger (AES-256-GCM, a fresh nonce
/// each save, "homelab-finances:1:<username>" as associated data). The key is
/// wrapped by her recovery code (scrypt N 2^17, r 8, p 1) and by her
/// passkey's PRF (HKDF-SHA256) or a passphrase (scrypt again). The computer
/// keeps only the envelope; the opened key never leaves this phone.
enum PrivateSeal {
    /// The envelope as the computer keeps it (finance.Envelope): bytes in standard base64.
    struct Envelope: Codable, Equatable, Sendable {
        struct KDF: Codable, Equatable, Sendable {
            var name: String
            var salt: String
            var n: Int?
            var r: Int?
            var p: Int?
            var passphraseSalt: String?
            var passkey: String?
        }

        var version: Int
        /// The file's, as the computer gives it: never sent back in an envelope.
        var rev: String?
        var kdf: KDF
        var wrappedByPasskey: String?
        var wrappedByCode: String
        var sealed: String
    }

    /// What her passkey gives this app for her Finances (its PRF), and the passkey's id.
    struct Passkey: Sendable {
        let secret: Data
        let credential: Data
    }

    enum Problem: Error, Equatable, LocalizedError {
        case wrongCode, wrongPassphrase, wrongPasskey, notTheirs, shortPassphrase

        var errorDescription: String? {
            switch self {
            case .wrongCode: "That recovery code doesn’t open these Finances. Check each word and try again."
            case .wrongPassphrase: "That passphrase doesn’t open these Finances. Try again, or use your recovery code."
            case .wrongPasskey: "That passkey doesn’t open these Finances. Use your recovery code instead."
            case .notTheirs: "These private Finances couldn’t be opened: they were changed, or aren’t yours."
            case .shortPassphrase: "A passphrase is \(PrivateSeal.minPassphrase) characters or more."
            }
        }
    }

    static let minPassphrase = 12
    /// What the passkey's PRF is asked with: the same on every phone of hers, and on the page.
    static let prfInput = Data("homelab-finances:1".utf8)
    private static let n = 1 << 17, r = 8, p = 1

    // MARK: The recovery code

    /// The recovery code's words: 256 plain ones, so its 16 bytes are 16 words (seal.ts's WORDS).
    static let words: [String] = [
        "acorn", "actor", "adult", "agent", "alarm", "album", "alley", "amber", "angle", "ankle", "apple", "apron",
        "arena", "armor", "arrow", "atlas", "attic", "award", "bacon", "badge", "bagel", "baker", "banjo", "barn",
        "basil", "beach", "beard", "bench", "berry", "bike", "bird", "blank", "blaze", "bloom", "board", "boat",
        "bonus", "boots", "bread", "brick", "bride", "brook", "broom", "brush", "bucket", "buddy", "bugle", "cabin",
        "cable", "cactus", "camel", "camera", "candy", "canoe", "canvas", "cargo", "carpet", "carrot", "castle", "cedar",
        "chain", "chair", "chalk", "cherry", "chess", "chief", "cider", "circus", "clay", "cliff", "clock", "cloud",
        "clover", "coach", "cobra", "cocoa", "comet", "coral", "corn", "cotton", "couch", "crane", "crayon", "cream",
        "crown", "cube", "daisy", "dance", "delta", "denim", "desert", "diary", "dinner", "donkey", "door", "dragon",
        "drum", "eagle", "easel", "echo", "elbow", "ember", "engine", "falcon", "fancy", "farm", "feather", "fence",
        "fern", "ferry", "fiddle", "field", "flag", "flute", "forest", "fossil", "fox", "frost", "garden", "garlic",
        "gecko", "ginger", "glove", "goat", "gold", "grape", "gravy", "guitar", "hammer", "harbor", "harp", "hazel",
        "helmet", "heron", "hill", "honey", "hotel", "island", "ivory", "jacket", "jelly", "jewel", "judge", "juice",
        "kayak", "kettle", "kitten", "kiwi", "koala", "ladder", "lake", "lamp", "lemon", "lily", "lizard", "llama",
        "magnet", "mango", "maple", "marble", "meadow", "melon", "mirror", "mitten", "monkey", "moose", "motor", "muffin",
        "napkin", "nest", "noodle", "oasis", "ocean", "olive", "onion", "orange", "otter", "owl", "paddle", "panda",
        "parade", "parrot", "pasta", "peach", "peanut", "pebble", "pencil", "pepper", "piano", "pickle", "pillow", "pilot",
        "pizza", "planet", "plum", "pocket", "pony", "potato", "puppy", "quilt", "rabbit", "radio", "rain", "raven",
        "ribbon", "river", "robin", "rocket", "rose", "ruby", "saddle", "salad", "salmon", "sandal", "scarf", "shell",
        "shovel", "silver", "skate", "sled", "snail", "spider", "spoon", "squid", "stamp", "star", "statue", "stove",
        "sugar", "summer", "sunset", "swan", "table", "taco", "teapot", "tent", "tiger", "toast", "tomato", "train",
        "tuba", "tulip", "turtle", "valley", "velvet", "violin", "wagon", "walnut", "walrus", "whale", "willow", "window",
        "winter", "wizard", "yogurt", "zebra",
    ]
    private static let index: [String: UInt8] = Dictionary(uniqueKeysWithValues: words.enumerated().map { ($1, UInt8($0)) })

    /// A new recovery code: 128 random bits.
    static func newCode() -> Data { random(16) }
    /// The code as the 16 words shown to her once.
    static func codeWords(_ code: Data) -> [String] { code.map { words[Int($0)] } }
    /// The code back from its words however typed (spaces, capitals), or nil when it isn't one.
    static func code(fromWords text: String) -> Data? {
        let typed = text.lowercased().split(whereSeparator: { !($0 >= "a" && $0 <= "z") }).map(String.init)
        guard typed.count == 16 else { return nil }
        var out = Data()
        for w in typed {
            guard let b = index[w] else { return nil }
            out.append(b)
        }
        return out
    }

    // MARK: Turning privacy on, unlocking, opening, saving

    /// Turns privacy on: a new data key, her Finances (the JSON {plan, ledger}) sealed with it,
    /// the key wrapped by her code and by her passkey or a passphrase.
    static func turnOn(_ plain: Data, username: String, code: Data, passkey: Passkey? = nil, passphrase: String? = nil) throws -> (envelope: Envelope, key: SymmetricKey) {
        if passkey == nil, (passphrase ?? "").count < minPassphrase { throw Problem.shortPassphrase }
        let raw = random(32)
        var kdf = Envelope.KDF(name: "scrypt", salt: random(16).base64EncodedString(), n: n, r: r, p: p)
        let wrap = { (w: SymmetricKey) throws -> String in try seal(raw, key: w, ad: ad("homelab-finances-key", username)).base64EncodedString() }
        let byCode = try wrap(try stretch(code, salt: kdf.salt))
        let byOther: String
        if let passkey {
            kdf.passkey = passkey.credential.base64EncodedString()
            byOther = try wrap(fromPasskey(passkey.secret))
        } else {
            let salt = random(16).base64EncodedString()
            kdf.passphraseSalt = salt
            byOther = try wrap(try stretch(passphraseBytes(passphrase ?? ""), salt: salt))
        }
        let key = SymmetricKey(data: raw)
        let sealed = try seal(plain, key: key, ad: ad("homelab-finances", username)).base64EncodedString()
        return (Envelope(version: 1, kdf: kdf, wrappedByPasskey: byOther, wrappedByCode: byCode, sealed: sealed), key)
    }

    /// The data key, opened by her recovery code.
    static func unlock(_ e: Envelope, username: String, code: Data) throws -> SymmetricKey {
        try unwrap(e.wrappedByCode, by: try stretch(code, salt: e.kdf.salt), username: username, or: .wrongCode)
    }
    /// The data key, opened by her passphrase (a phone whose passkey gives no secret).
    static func unlock(_ e: Envelope, username: String, passphrase: String) throws -> SymmetricKey {
        try unwrap(e.wrappedByPasskey, by: try stretch(passphraseBytes(passphrase), salt: e.kdf.passphraseSalt ?? ""), username: username, or: .wrongPassphrase)
    }
    /// The data key, opened by her passkey's secret.
    static func unlock(_ e: Envelope, username: String, passkeySecret: Data) throws -> SymmetricKey {
        try unwrap(e.wrappedByPasskey, by: fromPasskey(passkeySecret), username: username, or: .wrongPasskey)
    }

    /// Her plan and ledger, opened (the JSON {plan, ledger}).
    static func open(_ e: Envelope, key: SymmetricKey, username: String) throws -> Data {
        guard let box = Data(base64Encoded: e.sealed), let plain = try? openBox(box, key: key, ad: ad("homelab-finances", username)) else { throw Problem.notTheirs }
        return plain
    }

    /// The envelope for a save: her Finances sealed anew under the same key, the same ways to open it.
    static func reseal(_ e: Envelope, key: SymmetricKey, username: String, plain: Data) throws -> Envelope {
        var next = e
        next.rev = nil
        next.sealed = try seal(plain, key: key, ad: ad("homelab-finances", username)).base64EncodedString()
        return next
    }

    /// A receipt (its data URL) sealed, as base64, and opened again.
    static func sealText(_ text: String, key: SymmetricKey, username: String) throws -> String {
        try seal(Data(text.utf8), key: key, ad: ad("homelab-finances-receipt", username)).base64EncodedString()
    }
    static func openText(_ sealed: String, key: SymmetricKey, username: String) throws -> String {
        guard let box = Data(base64Encoded: sealed), let plain = try? openBox(box, key: key, ad: ad("homelab-finances-receipt", username)),
              let text = String(data: plain, encoding: .utf8) else { throw Problem.notTheirs }
        return text
    }

    // MARK: The parts

    private static func random(_ count: Int) -> Data {
        var g = SystemRandomNumberGenerator()
        return Data((0..<count).map { _ in UInt8.random(in: .min ... .max, using: &g) })
    }
    private static func ad(_ what: String, _ username: String) -> Data { Data("\(what):1:\(username)".utf8) }
    private static func passphraseBytes(_ s: String) -> Data { Data(s.precomposedStringWithCompatibilityMapping.utf8) }

    /// nonce (12) || ciphertext || tag (16), as WebCrypto's AES-GCM writes it.
    private static func seal(_ data: Data, key: SymmetricKey, ad: Data) throws -> Data {
        let box = try AES.GCM.seal(data, using: key, nonce: AES.GCM.Nonce(), authenticating: ad)
        guard let all = box.combined else { throw Problem.notTheirs }
        return all
    }
    private static func openBox(_ data: Data, key: SymmetricKey, ad: Data) throws -> Data {
        guard data.count >= 28 else { throw Problem.notTheirs }
        return try AES.GCM.open(AES.GCM.SealedBox(combined: data), using: key, authenticating: ad)
    }
    private static func unwrap(_ wrapped: String?, by wrapping: SymmetricKey, username: String, or problem: Problem) throws -> SymmetricKey {
        guard let box = Data(base64Encoded: wrapped ?? ""), let raw = try? openBox(box, key: wrapping, ad: ad("homelab-finances-key", username)), raw.count == 32 else { throw problem }
        return SymmetricKey(data: raw)
    }
    private static func stretch(_ secret: Data, salt: String) throws -> SymmetricKey {
        SymmetricKey(data: try scrypt(password: secret, salt: Data(base64Encoded: salt) ?? Data(), n: n, r: r, p: p, length: 32))
    }
    private static func fromPasskey(_ secret: Data) -> SymmetricKey {
        HKDF<SHA256>.deriveKey(inputKeyMaterial: SymmetricKey(data: secret), salt: Data(), info: Data("homelab-finances-passkey:1".utf8), outputByteCount: 32)
    }

    // MARK: scrypt (RFC 7914): CryptoKit has none

    private static func pbkdf2(_ password: Data, salt: Data, length: Int) -> Data {
        let key = SymmetricKey(data: password)
        var out = Data()
        var block: UInt32 = 1
        while out.count < length {
            var msg = salt
            withUnsafeBytes(of: block.bigEndian) { msg.append(contentsOf: $0) }
            out.append(contentsOf: HMAC<SHA256>.authenticationCode(for: msg, using: key))
            block += 1
        }
        return out.prefix(length)
    }

    /// scrypt(password, salt, N, r, p) as length bytes.
    static func scrypt(password: Data, salt: Data, n: Int, r: Int, p: Int, length: Int) throws -> Data {
        let words = 32 * r
        var bytes = [UInt8](pbkdf2(password, salt: salt, length: p * 128 * r))
        let b = UnsafeMutablePointer<UInt32>.allocate(capacity: words)
        let y = UnsafeMutablePointer<UInt32>.allocate(capacity: words)
        let v = UnsafeMutablePointer<UInt32>.allocate(capacity: words * n)
        let t = UnsafeMutablePointer<UInt32>.allocate(capacity: 16)
        let x = UnsafeMutablePointer<UInt32>.allocate(capacity: 16)
        defer { b.deallocate(); y.deallocate(); v.deallocate(); t.deallocate(); x.deallocate() }
        for q in 0..<p {
            for i in 0..<words {
                let o = (q * words + i) * 4
                b[i] = UInt32(bytes[o]) | UInt32(bytes[o + 1]) << 8 | UInt32(bytes[o + 2]) << 16 | UInt32(bytes[o + 3]) << 24
            }
            for i in 0..<n {
                (v + i * words).update(from: b, count: words)
                blockMix(b, y, r, t, x)
            }
            for _ in 0..<n {
                let j = Int(b[(2 * r - 1) * 16]) & (n - 1)
                let vj = v + j * words
                for k in 0..<words { b[k] ^= vj[k] }
                blockMix(b, y, r, t, x)
            }
            for i in 0..<words {
                let o = (q * words + i) * 4, w = b[i]
                bytes[o] = UInt8(truncatingIfNeeded: w); bytes[o + 1] = UInt8(truncatingIfNeeded: w >> 8)
                bytes[o + 2] = UInt8(truncatingIfNeeded: w >> 16); bytes[o + 3] = UInt8(truncatingIfNeeded: w >> 24)
            }
        }
        return pbkdf2(password, salt: Data(bytes), length: length)
    }

    // BlockMix: b (32r words) into y, then back into b in its order (the even blocks, then the odd).
    private static func blockMix(_ b: UnsafeMutablePointer<UInt32>, _ y: UnsafeMutablePointer<UInt32>, _ r: Int, _ t: UnsafeMutablePointer<UInt32>, _ x: UnsafeMutablePointer<UInt32>) {
        t.update(from: b + (2 * r - 1) * 16, count: 16)
        for i in 0..<(2 * r) {
            for k in 0..<16 { t[k] ^= b[i * 16 + k] }
            salsa8(t, x)
            (y + ((i & 1) * r + (i >> 1)) * 16).update(from: t, count: 16)
        }
        b.update(from: y, count: 32 * r)
    }

    private static func salsa8(_ b: UnsafeMutablePointer<UInt32>, _ x: UnsafeMutablePointer<UInt32>) {
        x.update(from: b, count: 16)
        @inline(__always) func q(_ a: Int, _ c: Int, _ d: Int, _ s: UInt32) { x[a] ^= (x[c] &+ x[d]).rotl(s) }
        for _ in 0..<4 {
            q(4, 0, 12, 7); q(8, 4, 0, 9); q(12, 8, 4, 13); q(0, 12, 8, 18)
            q(9, 5, 1, 7); q(13, 9, 5, 9); q(1, 13, 9, 13); q(5, 1, 13, 18)
            q(14, 10, 6, 7); q(2, 14, 10, 9); q(6, 2, 14, 13); q(10, 6, 2, 18)
            q(3, 15, 11, 7); q(7, 3, 15, 9); q(11, 7, 3, 13); q(15, 11, 7, 18)
            q(1, 0, 3, 7); q(2, 1, 0, 9); q(3, 2, 1, 13); q(0, 3, 2, 18)
            q(6, 5, 4, 7); q(7, 6, 5, 9); q(4, 7, 6, 13); q(5, 4, 7, 18)
            q(11, 10, 9, 7); q(8, 11, 10, 9); q(9, 8, 11, 13); q(10, 9, 8, 18)
            q(12, 15, 14, 7); q(13, 12, 15, 9); q(14, 13, 12, 13); q(15, 14, 13, 18)
        }
        for i in 0..<16 { b[i] = b[i] &+ x[i] }
    }
}

private extension UInt32 {
    @inline(__always) func rotl(_ s: UInt32) -> UInt32 { (self << s) | (self >> (32 - s)) }
}
