import CryptoKit
import Foundation
import Observation

/// The calls a household member's phone makes for her private Finances
/// (serve.go's sealed methods): the computer keeps her envelope, and her
/// sealed receipts, without being able to open them.
protocol PrivateFinancesCalls: Sendable {
    /// Her envelope, or nil while her Finances are plain.
    func financesSealed() async throws -> PrivateSeal.Envelope?
    /// Keeps the envelope, built on `was` ("new" turns privacy on); the new rev.
    func saveFinancesSealed(was: String, _ envelope: PrivateSeal.Envelope) async throws -> String
    /// Privacy off: her plan and ledger kept plain again, the envelope and sealed receipts removed.
    func unsealFinances(was: String, plan: JSONValue, ledger: JSONValue) async throws
    /// A sealed receipt, by its name.
    func financesSealedReceipt(_ name: String) async throws -> String
    /// Keeps a sealed receipt; the name the computer gives it.
    func saveFinancesSealedReceipt(_ sealed: String) async throws -> String
}

/// A household member's private Finances on her iPhone or iPad
/// (private-finances.md 3.2 to 3.4), as the phone's page has them
/// (web/src/finances/privacy.ts). Once she turns privacy on, the computer
/// keeps only her sealed envelope and refuses the plain Finances calls;
/// this answers them instead, for the same screens: her plan and ledger
/// opened here (`PrivateSeal`), read forward with the computer's own code
/// (`FinanceProjection`), and saved sealed again. The opened key and her
/// plain Finances are held in memory only, while they're open, and go when
/// they lock.
@MainActor
@Observable
final class PrivateFinances {
    /// Not known yet (or not a member's phone), plain, sealed and locked, or opened here.
    enum State: Equatable, Sendable { case unknown, plain, locked, open }

    enum Problem: Error, Equatable, LocalizedError {
        case locked, notAllowed, changed, notACode, noProjection, unreadable, changedAway, receiptAway, offAway

        var errorDescription: String? {
            switch self {
            case .locked: "Your Finances are private: unlock them to see them."
            case .notAllowed: "This phone can see Finances but not change them."
            case .changed: "Your Finances were changed on another of your devices after this was read. The latest is shown now: make your change again."
            case .notACode: "A recovery code is 16 words from the list it was shown with. Check each word and try again."
            case .noProjection: "This copy of the Homelab app can’t open private Finances: update it, then try again."
            case .unreadable: "Your private Finances opened, but couldn’t be read. Nothing was changed."
            case .changedAway: "While you were away, your Finances were changed on another of your devices, so the change made here wasn’t kept. The latest is shown now: make it again."
            case .receiptAway: "A receipt waits until the Homelab answers: add it again when you’re home."
            case .offAway: "Privacy can be turned off once the Homelab answers and what you changed away is saved."
            }
        }
    }

    private(set) var state: State = .unknown
    /// Whose phone this is: her username, in what's sealed so it can't be moved to another member.
    let username: String
    /// Whether this phone may change her Finances (Settings › Phones on the computer).
    var mayChange: Bool

    @ObservationIgnored private let calls: any PrivateFinancesCalls
    @ObservationIgnored private let today: @MainActor () -> String
    @ObservationIgnored private(set) var envelope: PrivateSeal.Envelope?
    @ObservationIgnored private var key: SymmetricKey?
    @ObservationIgnored private var plan: JSONValue = .object([:])
    @ObservationIgnored private var ledger: JSONValue = .object([:])

    // Offline (2E step 6): her envelope kept sealed on this phone, and a change made away.
    @ObservationIgnored private let offline: PrivateOffline?
    @ObservationIgnored private var kept: PrivateOffline.Kept?
    @ObservationIgnored private var keptRead = false
    /// When the copy shown was last read, while the Homelab doesn't answer; nil while it does.
    private(set) var awaySince: Date?
    /// How many changes made away wait to be sent.
    private(set) var waiting = 0
    /// A plain line about what happened away (another device's change), until the next save.
    private(set) var notice: String?

    init(username: String, mayChange: Bool, calls: any PrivateFinancesCalls, offline: PrivateOffline? = nil,
         today: @escaping @MainActor () -> String = { FinancePlanEdit.todayString() }) {
        self.username = username
        self.mayChange = mayChange
        self.calls = calls
        self.offline = offline
        self.today = today
    }

    /// A call the Homelab didn't answer (not here, or not answering), never a refusal.
    nonisolated static func isAway(_ error: Error) -> Bool { APIError.from(error).unreachable }

    /// What's kept on this device for her; another member's (the phone given to someone else) goes.
    private func keptCopy() -> PrivateOffline.Kept? {
        if !keptRead {
            keptRead = true
            kept = offline?.load()
        }
        if let k = kept, k.username != username {
            forgetKept()
        }
        waiting = kept?.pending?.count ?? 0
        return kept
    }

    /// Keeps e as the last read from the computer, with what still waits.
    private func remember(_ e: PrivateSeal.Envelope) {
        guard let offline else { return }
        let k = PrivateOffline.Kept(username: username, at: Date(), envelope: e, pending: keptCopy()?.pending)
        kept = k
        offline.keep(k)
    }

    private func forgetKept() {
        kept = nil
        keptRead = true
        waiting = 0
        awaySince = nil
        offline?.forget()
    }

    /// The computer answered with her newest envelope: what waits here goes
    /// first (refused when another of her devices saved meanwhile, said
    /// plainly), then what's shown is the newest.
    private func arrived(_ read: PrivateSeal.Envelope) async throws {
        var latest = read
        if let p = keptCopy()?.pending {
            do {
                var sent = p.envelope
                sent.rev = try await calls.saveFinancesSealed(was: p.was, p.envelope)
                latest = sent
            } catch let error where Self.isAway(error) {
                return // read, but not saved: it still waits
            } catch let error where Self.changedElsewhere(error) {
                notice = Problem.changedAway.errorDescription
            }
            kept?.pending = nil
            waiting = 0
        }
        awaySince = nil
        if state == .open, let key, latest.rev != envelope?.rev || notice != nil {
            try take(latest, key: key)
        }
        envelope = latest
        remember(latest)
    }

    /// The Homelab may answer again: what waits is sent and the newest read.
    /// Nothing happens while it still doesn't answer.
    func comeHome() async {
        guard awaySince != nil || waiting > 0 else { return }
        guard let latest = try? await calls.financesSealed() else { return }
        try? await arrived(latest)
    }

    /// Whether her envelope opens by a passkey (else by a passphrase), besides the code.
    var byPasskey: Bool { envelope?.kdf.passkey != nil }
    /// The passkey's id, to ask Face ID for it.
    var passkeyCredential: Data? { envelope?.kdf.passkey.flatMap { Data(base64Encoded: $0) } }

    /// Asks the computer whether her Finances are sealed; open ones stay
    /// open, read again when another of her devices saved since.
    @discardableResult
    func find() async throws -> State {
        let latest: PrivateSeal.Envelope?
        do {
            latest = try await calls.financesSealed()
        } catch let error where Self.isAway(error) {
            // Away: the copy kept here, if there is one.
            guard let k = keptCopy() else { throw error }
            if state != .open { envelope = k.newest }
            awaySince = k.at
            if state != .open { state = .locked }
            return state
        }
        guard let latest else {
            forget()
            forgetKept()
            state = .plain
            return state
        }
        if state != .open { state = .locked }
        try await arrived(latest)
        return state
    }

    // MARK: Unlocking and locking

    /// Opens them with the 16 words of her recovery code.
    func unlock(words: String) async throws {
        guard let code = PrivateSeal.code(fromWords: words) else { throw Problem.notACode }
        let e = try sealed(), who = username
        let raw = try await Task.detached(priority: .userInitiated) {
            try PrivateFinances.raw(PrivateSeal.unlock(e, username: who, code: code))
        }.value
        try await opened(raw)
    }

    /// Opens them with her passphrase (a phone whose passkey can't lock them).
    func unlock(passphrase: String) async throws {
        let e = try sealed(), who = username
        let raw = try await Task.detached(priority: .userInitiated) {
            try PrivateFinances.raw(PrivateSeal.unlock(e, username: who, passphrase: passphrase))
        }.value
        try await opened(raw)
    }

    /// Opens them with the secret her passkey gave (Face ID).
    func unlock(passkeySecret: Data) async throws {
        let e = try sealed()
        try await opened(Self.raw(PrivateSeal.unlock(e, username: username, passkeySecret: passkeySecret)))
    }

    /// Opens them with the key kept behind Face ID on this device
    /// (`PrivateFinancesKey`); one that no longer opens them is refused.
    func unlock(key raw: Data) async throws {
        guard raw.count == 32 else { throw PrivateSeal.Problem.notTheirs }
        _ = try sealed()
        try await opened(raw)
    }

    /// The opened key, to keep behind Face ID on this device; nil while locked.
    var openedKey: Data? { key.map { Self.raw($0) } }

    /// Drops the opened key and her plain Finances from this phone.
    func lock() {
        guard state == .open else { return }
        key = nil
        plan = .object([:])
        ledger = .object([:])
        state = .locked
    }

    private func sealed() throws -> PrivateSeal.Envelope {
        guard let envelope else { throw Problem.locked }
        return envelope
    }

    nonisolated private static func raw(_ key: SymmetricKey) -> Data { key.withUnsafeBytes { Data($0) } }

    /// The key, unwrapped: the newest envelope read and opened with it.
    private func opened(_ raw: Data) async throws {
        let k = SymmetricKey(data: raw)
        let latest: PrivateSeal.Envelope?
        do {
            latest = try await calls.financesSealed()
        } catch let error where Self.isAway(error) {
            // Away: opened from the copy kept here (Face ID or the code needs no connection).
            guard let kc = keptCopy() else { throw error }
            try take(kc.newest, key: k)
            awaySince = kc.at
            state = .open
            return
        }
        guard let latest else {
            forget()
            forgetKept()
            state = .plain
            return
        }
        // What waits here opens first, then goes.
        if let waits = keptCopy(), waits.pending != nil {
            try take(waits.newest, key: k)
        } else {
            try take(latest, key: k)
        }
        state = .open
        try await arrived(latest)
    }

    /// e opened with k: her plan and ledger, held while open.
    private func take(_ e: PrivateSeal.Envelope, key k: SymmetricKey) throws {
        let plain = try PrivateSeal.open(e, key: k, username: username)
        guard let both = try? JSONDecoder().decode(JSONValue.self, from: plain) else { throw Problem.unreadable }
        plan = Self.unrev(both["plan"] ?? .object([:]))
        ledger = Self.unrev(both["ledger"] ?? .object([:]))
        envelope = e
        key = k
    }

    private func forget() {
        key = nil
        envelope = nil
        plan = .object([:])
        ledger = .object([:])
    }

    // MARK: The Finances calls, answered here

    /// Her Finances read forward from today, on this phone, as the computer
    /// would have answered `Finances`.
    func finances() throws -> FinancesRead {
        guard state == .open, let envelope else { throw Problem.locked }
        let encoder = JSONEncoder()
        guard let view = try FinanceProjection.project(plan: try encoder.encode(plan), ledger: try encoder.encode(ledger), today: today()) else {
            throw Problem.noProjection
        }
        guard case .object(var v) = try JSONDecoder().decode(JSONValue.self, from: view), case .object(var p)? = v["plan"] else { throw Problem.unreadable }
        p["rev"] = .string(envelope.rev ?? "")
        v["plan"] = .object(p)
        v["readOnly"] = .bool(!mayChange)
        return try APIClient.financesRead(from: encoder.encode(JSONValue.object(["result": .object(v)])))
    }

    /// Her ledger, as the computer would have answered `FinancesLedger`.
    func financesLedger() throws -> LedgerRead {
        guard state == .open, let envelope else { throw Problem.locked }
        guard case .object(var l) = ledger else { throw Problem.unreadable }
        l["rev"] = .string(envelope.rev ?? "")
        return try APIClient.ledgerRead(from: JSONEncoder().encode(JSONValue.object(["result": .object(l)])))
    }

    /// Saves her plan (as read, edited), sealed.
    func saveFinances(_ edited: JSONValue) async throws -> FinancesRead {
        try await save(plan: Self.unrev(edited), ledger: ledger)
        return try finances()
    }

    /// Saves her ledger (as read, edited), sealed.
    func saveFinancesLedger(_ edited: JSONValue) async throws -> LedgerRead {
        try await save(plan: plan, ledger: Self.unrev(edited))
        return try financesLedger()
    }

    /// A receipt (a data URL) sealed and kept; the name it's kept under.
    func saveReceipt(dataURL: String) async throws -> String {
        guard state == .open, let key else { throw Problem.locked }
        guard mayChange else { throw Problem.notAllowed }
        guard awaySince == nil else { throw Problem.receiptAway }
        do {
            return try await calls.saveFinancesSealedReceipt(try PrivateSeal.sealText(dataURL, key: key, username: username))
        } catch let error where Self.isAway(error) {
            throw Problem.receiptAway
        }
    }

    /// A kept receipt, opened: its data URL.
    func receipt(named name: String) async throws -> String {
        guard state == .open, key != nil else { throw Problem.locked }
        let sealed = try await calls.financesSealedReceipt(name)
        guard let key else { throw Problem.locked }
        return try PrivateSeal.openText(sealed, key: key, username: username)
    }

    /// Seals plan and ledger and keeps them on the computer. When another
    /// of her devices saved first, hers are opened instead and it says so.
    private func save(plan next: JSONValue, ledger nextLedger: JSONValue) async throws {
        guard state == .open, let key, let envelope else { throw Problem.locked }
        guard mayChange else { throw Problem.notAllowed }
        let plain = try JSONEncoder().encode(JSONValue.object(["plan": next, "ledger": nextLedger]))
        var sealed = try PrivateSeal.reseal(envelope, key: key, username: username, plain: plain)
        // While a change waits, the next builds on what it built on.
        let base = keptCopy()?.pending?.was ?? envelope.rev ?? ""
        notice = nil
        do {
            if awaySince != nil { throw APIError.transport(.notConnectedToInternet) }
            sealed.rev = try await calls.saveFinancesSealed(was: base, sealed)
        } catch let error where Self.isAway(error) && offline != nil {
            // Kept here, sealed, until the Homelab answers (comeHome).
            var k = keptCopy() ?? PrivateOffline.Kept(username: username, at: Date(), envelope: envelope, pending: nil)
            k.pending = PrivateOffline.Pending(was: base, envelope: sealed, count: (k.pending?.count ?? 0) + 1)
            kept = k
            offline?.keep(k)
            waiting = k.pending?.count ?? 0
            if awaySince == nil { awaySince = k.at }
            sealed.rev = base
            self.envelope = sealed
            plan = next
            ledger = nextLedger
            return
        } catch {
            guard Self.changedElsewhere(error) else { throw error }
            if let latest = try await calls.financesSealed(), let key = self.key { try take(latest, key: key) }
            throw Problem.changed
        }
        if kept?.pending != nil { kept?.pending = nil }
        waiting = 0
        remember(sealed)
        guard self.key != nil else { return } // locked while it saved: kept, but nothing held
        self.envelope = sealed
        plan = next
        ledger = nextLedger
    }

    /// The computer's ErrChanged, as it comes: another device saved after this read.
    nonisolated static func changedElsewhere(_ error: Error) -> Bool {
        if case .server(_, let message?) = APIError.from(error) { return message.contains("changed on another device") }
        return false
    }

    // MARK: Turning privacy on and off

    /// Turns privacy on (3.3's steps): her plain plan and ledger as read,
    /// each plain receipt read (`plainReceipt`), sealed and kept, then all
    /// of it sealed and saved as new. Only once that save succeeds does the
    /// computer remove her plain files; a failure before leaves them.
    func turnOn(plan rawPlan: JSONValue, ledger rawLedger: JSONValue, code: Data, passkey: PrivateSeal.Passkey? = nil, passphrase: String? = nil,
                plainReceipt: (String) async throws -> String) async throws {
        guard mayChange else { throw Problem.notAllowed }
        let p = Self.unrev(rawPlan), who = username
        var l = Self.unrev(rawLedger)
        let first = try JSONEncoder().encode(JSONValue.object(["plan": p, "ledger": l]))
        let (made, raw) = try await Task.detached(priority: .userInitiated) {
            let (e, k) = try PrivateSeal.turnOn(first, username: who, code: code, passkey: passkey, passphrase: passphrase)
            return (e, PrivateFinances.raw(k))
        }.value
        let k = SymmetricKey(data: raw)
        var sealed = made
        if case .object(var o) = l, case .array(let ts)? = o["transactions"] {
            var moved = false
            var out: [JSONValue] = []
            for t in ts {
                guard case .object(var row) = t, case .string(let name)? = row["receipt"], !name.isEmpty, !name.hasSuffix(".sealed") else {
                    out.append(t)
                    continue
                }
                let url = try await plainReceipt(name)
                row["receipt"] = .string(try await calls.saveFinancesSealedReceipt(try PrivateSeal.sealText(url, key: k, username: who)))
                out.append(.object(row))
                moved = true
            }
            if moved {
                o["transactions"] = .array(out)
                l = .object(o)
                sealed = try PrivateSeal.reseal(made, key: k, username: who, plain: JSONEncoder().encode(JSONValue.object(["plan": p, "ledger": l])))
            }
        }
        sealed.rev = try await calls.saveFinancesSealed(was: "new", sealed)
        remember(sealed)
        envelope = sealed
        key = k
        plan = p
        ledger = l
        state = .open
    }

    /// Turns privacy off, once she has confirmed: her sealed receipts
    /// opened here, her plan and ledger kept plain again without them (the
    /// computer then removes the envelope and the sealed receipts). Gives
    /// each transaction's receipt back (its id → data URL), for her phone to
    /// keep plain again with `SaveFinancesReceipt` and the ledger to name.
    func turnOff() async throws -> [String: String] {
        guard state == .open, let key, let envelope else { throw Problem.locked }
        guard mayChange else { throw Problem.notAllowed }
        guard awaySince == nil, waiting == 0 else { throw Problem.offAway }
        var pictures: [String: String] = [:]
        var bare = ledger
        if case .object(var o) = ledger, case .array(let ts)? = o["transactions"] {
            var out: [JSONValue] = []
            for t in ts {
                guard case .object(var row) = t, case .string(let id)? = row["id"], case .string(let name)? = row["receipt"], name.hasSuffix(".sealed") else {
                    out.append(t)
                    continue
                }
                pictures[id] = try PrivateSeal.openText(try await calls.financesSealedReceipt(name), key: key, username: username)
                row.removeValue(forKey: "receipt")
                out.append(.object(row))
            }
            o["transactions"] = .array(out)
            bare = .object(o)
        }
        try await calls.unsealFinances(was: envelope.rev ?? "", plan: plan, ledger: bare)
        forget()
        forgetKept()
        state = .plain
        return pictures
    }

    /// A plan or ledger without its rev: the envelope's is the one that counts.
    nonisolated static func unrev(_ v: JSONValue) -> JSONValue {
        guard case .object(var o) = v else { return v }
        o.removeValue(forKey: "rev")
        return .object(o)
    }
}

extension APIClient: PrivateFinancesCalls {}
