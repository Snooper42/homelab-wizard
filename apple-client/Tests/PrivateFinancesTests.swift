import Foundation
import Testing
@testable import HomelabClient

// A household member's private Finances in the app (private-finances.md 3.3
// and 3.4), as the phone's page has them (web/src/finances/privacy.ts):
// turned on from her plain Finances, kept by the computer only sealed,
// opened on her phone, saved sealed again, and turned off. The computer
// here is a stand-in that keeps what it's given, as serve.go's sealed
// methods do. Made-up Finances, never anyone's.

/// The computer's sealed methods, in memory.
private actor SealedComputer: PrivateFinancesCalls {
    var stored: PrivateSeal.Envelope?
    var receipts: [String: String] = [:]
    var unsealed: (plan: JSONValue, ledger: JSONValue)?
    /// Not answering at all, as a homelab away from this phone's network.
    var away = false
    private var count = 0

    func setAway(_ a: Bool) { away = a }
    private func answer() throws { if away { throw URLError(.cannotConnectToHost) } }

    func financesSealed() throws -> PrivateSeal.Envelope? {
        try answer()
        return stored
    }

    func saveFinancesSealed(was: String, _ envelope: PrivateSeal.Envelope) throws -> String {
        try answer()
        guard was == (stored?.rev ?? "new") else {
            throw APIError.server(status: 500, message: "Finances were changed on another device after this was read. The latest is shown now: check your change and save it again")
        }
        count += 1
        var e = envelope
        e.rev = "r\(count)"
        stored = e
        return "r\(count)"
    }

    func unsealFinances(was: String, plan: JSONValue, ledger: JSONValue) throws {
        guard was == stored?.rev else { throw APIError.server(status: 500, message: "Finances were changed on another device after this was read.") }
        unsealed = (plan, ledger)
        stored = nil
        receipts = [:]
    }

    func financesSealedReceipt(_ name: String) throws -> String {
        guard let r = receipts[name] else { throw APIError.server(status: 500, message: "no such receipt") }
        return r
    }

    func saveFinancesSealedReceipt(_ sealed: String) throws -> String {
        try answer()
        let name = String(repeating: "\(receipts.count % 10)", count: 32) + ".sealed"
        receipts[name] = sealed
        return name
    }

    /// Another of her devices saving meanwhile: the rev moves on.
    func savedElsewhere() {
        count += 1
        stored?.rev = "r\(count)"
    }

    /// Everything the computer holds, as one string, to look for plain text in.
    func everything() throws -> String {
        let e = try stored.map { String(decoding: try JSONEncoder().encode($0), as: UTF8.self) } ?? ""
        return e + receipts.values.joined()
    }
}

private func json(_ text: String) throws -> JSONValue {
    try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
}

private let plan = #"""
{"rev":"p1","currency":"USD","cushion":250,"people":[],"payments":[],
 "accounts":[{"id":"chk","name":"Made-up Checking","kind":"checking","balance":1234.5,"updated":"2026-11-01"}]}
"""#
private let ledger = #"""
{"rev":"l1","transactions":[
 {"id":"t1","date":"2026-11-10","account":"chk","amount":-12.5,"payee":"Made-up Cafe","receipt":"0123456789abcdef0123456789abcdef.jpg"},
 {"id":"t2","date":"2026-11-11","account":"chk","amount":-40,"payee":"Made-up Grocer"}]}
"""#
private let receiptURL = "data:image/jpeg;base64,bWFkZS11cCByZWNlaXB0"
private let passkey = PrivateSeal.Passkey(secret: Data(repeating: 7, count: 32), credential: Data([1, 2, 3, 4]))

private func offlineFile() -> PrivateOffline {
    PrivateOffline(file: FileManager.default.temporaryDirectory.appendingPathComponent("private-\(UUID().uuidString).json"))
}

@MainActor
private func turnedOn(_ computer: SealedComputer, code: Data, mayChange: Bool = true, offline: PrivateOffline? = nil) async throws -> PrivateFinances {
    let mine = PrivateFinances(username: "riley", mayChange: true, calls: computer, offline: offline, today: { "2026-11-13" })
    var asked: [String] = []
    try await mine.turnOn(plan: json(plan), ledger: json(ledger), code: code, passkey: passkey) { name in
        asked.append(name)
        return receiptURL
    }
    #expect(asked == ["0123456789abcdef0123456789abcdef.jpg"], "her plain receipt is read to be sealed")
    mine.mayChange = mayChange
    return mine
}

@Suite("Private Finances in the app", .serialized)
@MainActor
struct PrivateFinancesTests {
    @Test("Turned on, the computer keeps nothing it can read, and she opens them again")
    func turnOnLockUnlock() async throws {
        let computer = SealedComputer()
        let code = PrivateSeal.newCode()
        let mine = try await turnedOn(computer, code: code)
        #expect(mine.state == .open)
        #expect(mine.byPasskey)
        let held = try await computer.everything()
        for plain in ["Made-up Checking", "Made-up Cafe", "1234.5", "bWFkZS11cCByZWNlaXB0", "riley"] {
            #expect(!held.contains(plain), "\(plain) is readable on the computer")
        }

        // Her plain receipt was kept sealed, and the ledger names it.
        let l = try mine.financesLedger()
        let named = try #require(l.ledger.transactions.first { $0.id == "t1" }?.receipt)
        #expect(APIClient.isSealedReceiptName(named))
        #expect(try await mine.receipt(named: named) == receiptURL)
        #expect(l.raw["rev"] == .string("r1"))

        mine.lock()
        #expect(mine.state == .locked)
        #expect(throws: PrivateFinances.Problem.locked) { try mine.financesLedger() }

        // Another session of the app (or after a restart) finds them locked.
        let again = PrivateFinances(username: "riley", mayChange: true, calls: computer, today: { "2026-11-13" })
        #expect(try await again.find() == .locked)
        await #expect(throws: PrivateFinances.Problem.notACode) { try await again.unlock(words: "apple banjo") }
        await #expect(throws: PrivateSeal.Problem.wrongPasskey) { try await again.unlock(passkeySecret: Data(count: 32)) }
        try await again.unlock(passkeySecret: passkey.secret)
        #expect(again.state == .open)
        #expect(try again.financesLedger().ledger.transactions.map(\.payee) == ["Made-up Cafe", "Made-up Grocer"])

        again.lock()
        try await again.unlock(words: PrivateSeal.codeWords(code).joined(separator: " "))
        #expect(again.state == .open)
    }

    @Test("A save is sealed; one made after another of her devices saved is refused in words, and the latest shown")
    func saving() async throws {
        let computer = SealedComputer()
        let mine = try await turnedOn(computer, code: PrivateSeal.newCode())
        guard case .object(var raw) = try mine.financesLedger().raw, case .array(var ts)? = raw["transactions"] else {
            Issue.record("no ledger")
            return
        }
        ts.removeLast()
        raw["transactions"] = .array(ts)
        let saved = try await mine.saveFinancesLedger(.object(raw))
        #expect(saved.ledger.transactions.count == 1)
        #expect(saved.raw["rev"] == .string("r2"))
        let after = try await computer.everything()
        #expect(!after.contains("Made-up Grocer"))

        await computer.savedElsewhere()
        await #expect(throws: PrivateFinances.Problem.changed) { try await mine.saveFinancesLedger(.object(raw)) }
        #expect(try mine.financesLedger().raw["rev"] == .string("r3"), "the latest is what's shown")
    }

    @Test("A phone that only looks opens them but changes nothing")
    func lookOnly() async throws {
        let computer = SealedComputer()
        let mine = try await turnedOn(computer, code: PrivateSeal.newCode(), mayChange: false)
        let raw = try mine.financesLedger().raw
        await #expect(throws: PrivateFinances.Problem.notAllowed) { try await mine.saveFinancesLedger(raw) }
        await #expect(throws: PrivateFinances.Problem.notAllowed) { try await mine.saveReceipt(dataURL: receiptURL) }
        await #expect(throws: PrivateFinances.Problem.notAllowed) { _ = try await mine.turnOff() }
        if FinanceProjection.available {
            #expect(try mine.finances().view.readOnly)
        }
    }

    @Test("Read forward on the phone, with the envelope's rev on the plan")
    func readForward() async throws {
        guard FinanceProjection.available else { return }
        let mine = try await turnedOn(SealedComputer(), code: PrivateSeal.newCode())
        let read = try mine.finances()
        #expect(read.view.plan.accounts.first?.name == "Made-up Checking")
        #expect(read.rawPlan["rev"] == .string("r1"))
        #expect(!read.view.readOnly)
    }

    @Test("Turned off, her plan and ledger go back plain, and her receipts come back to keep")
    func turnOff() async throws {
        let computer = SealedComputer()
        let mine = try await turnedOn(computer, code: PrivateSeal.newCode())
        let pictures = try await mine.turnOff()
        #expect(pictures == ["t1": receiptURL])
        #expect(mine.state == .plain)
        let back = try #require(await computer.unsealed)
        #expect(back.plan["rev"] == nil && back.plan["cushion"] == .number(250))
        guard case .array(let ts)? = back.ledger["transactions"], case .object(let t1)? = ts.first else {
            Issue.record("no transactions came back")
            return
        }
        #expect(t1["receipt"] == nil, "the sealed name isn't sent back plain")
        #expect(await computer.stored == nil)
        #expect(throws: PrivateFinances.Problem.locked) { try mine.financesLedger() }
    }

    /// Away: what's kept opens with no connection, changes wait locked on the
    /// phone, and go when the Homelab answers.
    @Test("Offline: opened from the copy kept here, and changes sent once home")
    func offline() async throws {
        let computer = SealedComputer()
        let kept = offlineFile()
        _ = try await turnedOn(computer, code: PrivateSeal.newCode(), offline: kept)
        let onDisk = String(decoding: try Data(contentsOf: kept.file), as: UTF8.self)
        for plain in ["Made-up Checking", "Made-up Cafe", "1234.5"] {
            #expect(!onDisk.contains(plain), "\(plain) is readable in the copy kept for offline")
        }

        await computer.setAway(true)
        let away = PrivateFinances(username: "riley", mayChange: true, calls: computer, offline: kept, today: { "2026-11-13" })
        #expect(try await away.find() == .locked)
        #expect(away.awaySince != nil)
        try await away.unlock(passkeySecret: passkey.secret)
        #expect(away.state == .open)

        guard case .object(var raw) = try away.financesLedger().raw, case .array(var ts)? = raw["transactions"] else {
            Issue.record("no ledger")
            return
        }
        ts.removeLast()
        raw["transactions"] = .array(ts)
        _ = try await away.saveFinancesLedger(.object(raw))
        ts.removeLast()
        raw["transactions"] = .array(ts)
        _ = try await away.saveFinancesLedger(.object(raw))
        #expect(away.waiting == 2)
        #expect(try away.financesLedger().ledger.transactions.isEmpty, "shown as changed")
        await #expect(throws: PrivateFinances.Problem.receiptAway) { try await away.saveReceipt(dataURL: receiptURL) }
        await #expect(throws: PrivateFinances.Problem.offAway) { _ = try await away.turnOff() }
        #expect(await computer.stored?.rev == "r1", "nothing reached the computer")

        // Locked and opened again away: what waits is what opens.
        away.lock()
        try await away.unlock(passkeySecret: passkey.secret)
        #expect(try away.financesLedger().ledger.transactions.isEmpty)

        await computer.setAway(false)
        await away.comeHome()
        #expect(away.waiting == 0 && away.awaySince == nil && away.notice == nil)
        #expect(await computer.stored?.rev == "r2", "both changes, sent as one")
        #expect(try away.financesLedger().raw["rev"] == .string("r2"))
    }

    @Test("Offline: a change made away after another of her devices saved isn't kept, and that's said")
    func offlineChangedElsewhere() async throws {
        let computer = SealedComputer()
        let kept = offlineFile()
        let mine = try await turnedOn(computer, code: PrivateSeal.newCode(), offline: kept)
        await computer.setAway(true)
        guard case .object(var raw) = try mine.financesLedger().raw, case .array(var ts)? = raw["transactions"] else {
            Issue.record("no ledger")
            return
        }
        ts.removeLast()
        raw["transactions"] = .array(ts)
        _ = try await mine.saveFinancesLedger(.object(raw))
        #expect(mine.waiting == 1)

        await computer.setAway(false)
        await computer.savedElsewhere()
        await mine.comeHome()
        #expect(mine.waiting == 0)
        #expect(mine.notice == PrivateFinances.Problem.changedAway.errorDescription)
        #expect(try mine.financesLedger().ledger.transactions.count == 2, "the latest is shown")
    }

    @Test("Offline's words")
    func awayWords() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let now = Date(timeIntervalSince1970: 1_794_618_000) // Nov 13, 2026, 8:00 PM Eastern
        let at = now.addingTimeInterval(-3600)
        let locale = Locale(identifier: "en_US")
        #expect(PrivateAwayLine.words(since: at, waiting: 0, now: now, calendar: calendar, locale: locale).hasPrefix("Offline: as of today, 7:00"))
        #expect(PrivateAwayLine.words(since: at, waiting: 1, now: now, calendar: calendar, locale: locale).hasSuffix("1 change waits for the Homelab."))
        #expect(PrivateAwayLine.words(since: at, waiting: 3, now: now, calendar: calendar, locale: locale).hasSuffix("3 changes wait for the Homelab."))
    }

    /// Her reminders, worked out on her phone with the computer's own code
    /// (the computer can't read hers to send them), and planned as this
    /// device's notifications: today's once, later days' at 9 AM.
    @Test("Her reminders come from her own Finances, on her phone")
    func reminders() async throws {
        guard FinanceProjection.available else { return }
        let computer = SealedComputer()
        let mine = PrivateFinances(username: "riley", mayChange: true, calls: computer, today: { "2026-11-13" })
        let withABill = #"{"currency":"USD","people":[],"accounts":[{"id":"chk","name":"Made-up Checking","kind":"checking","balance":900,"updated":"2026-11-13"}],"payments":[{"id":"power","name":"Made-up Power","amount":95,"schedule":{"every":"month","start":"2026-11-18"},"kind":"utilities"}]}"#
        try await mine.turnOn(plan: json(withABill), ledger: json(#"{"transactions":[]}"#), code: PrivateSeal.newCode(), passkey: passkey) { _ in receiptURL }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let start = Date(timeIntervalSince1970: 1_794_600_000) // Nov 13, 2026, Eastern
        let days = mine.reminders(days: 14, from: start, calendar: calendar)
        let dayBefore = try #require(days.first { $0.day == "2026-11-17" }, "the day before the bill: \(days)")
        #expect(dayBefore.reminders.contains { $0.kind == "due" && $0.title.contains("Made-up Power") && $0.title.contains("$95.00") })

        let planned = PrivateReminders.planned(days, today: "2026-11-13", shownDay: nil)
        let due = try #require(planned.first { $0.title.contains("Made-up Power") })
        #expect(due.id.hasPrefix(PrivateReminders.prefix))
        #expect(due.at == DateComponents(year: 2026, month: 11, day: 17, hour: 9))

        mine.lock()
        #expect(mine.reminders(days: 14, from: start, calendar: calendar).isEmpty, "none while locked")
    }

    /// A test run isn't an app: planning and cancelling do nothing there,
    /// rather than the notification center stopping the run (unpair cancels them).
    @Test("Outside an app, reminders are neither planned nor cancelled")
    func notAnApp() async {
        #expect(!PrivateReminders.canNotify)
        await PrivateReminders.cancel()
        await PrivateReminders.schedule([PrivateReminders.Planned(id: "private-finances-2026-11-20-0", title: "Made-up", body: "Made-up", at: nil)])
    }

    @Test("Today's reminders are shown once a day; past days never")
    func plannedOnce() {
        let r = [FinanceProjection.Reminder(kind: "due", title: "Due tomorrow: Made-up Rent $900.00", body: "It comes out tomorrow.")]
        let days = [PrivateFinances.DayReminders(day: "2026-11-12", reminders: r),
                    PrivateFinances.DayReminders(day: "2026-11-13", reminders: r),
                    PrivateFinances.DayReminders(day: "2026-11-20", reminders: r + r)]
        let first = PrivateReminders.planned(days, today: "2026-11-13", shownDay: "2026-11-12")
        #expect(first.map(\.id) == ["private-finances-2026-11-13-0", "private-finances-2026-11-20-0", "private-finances-2026-11-20-1"])
        #expect(first[0].at == nil, "today's at once")
        let again = PrivateReminders.planned(days, today: "2026-11-13", shownDay: "2026-11-13")
        #expect(again.map(\.id) == ["private-finances-2026-11-20-0", "private-finances-2026-11-20-1"])
    }

    @Test("The computer's words for a stale save are known")
    func staleWords() {
        #expect(PrivateFinances.changedElsewhere(APIError.server(status: 500, message: "Finances were changed on another device after this was read.")))
        #expect(!PrivateFinances.changedElsewhere(APIError.server(status: 500, message: "no such receipt")))
        #expect(!PrivateFinances.changedElsewhere(APIError.unauthorized))
    }
}
