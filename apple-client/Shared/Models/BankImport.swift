import Foundation

/// What a bank's file brings into an account, as the computer's Import works
/// it out (web/src/finances/Edit.tsx's ImportForm, importData.ts): each payee
/// as a person would write it, the bank's own words in its note; a rule for
/// that payee ("Always do this for…") or the payee's last category; and
/// every row already in the ledger skipped (by the bank's ID, or the day,
/// the amount and a payee alike). Import 1 and 2 of 3 (the owner approved the
/// sheet, Nov 15): fixing rows brought in before comes next, then Rules.
enum BankImport {
    /// A transaction in the ledger, as the import compares with it (finance.Transaction's keys).
    struct Kept: Sendable, Equatable {
        var id = ""
        var account = ""
        var to: String? = nil
        var date = ""
        var amount = 0.0
        var payee = ""
        var note = ""
        var category = ""
        var bank: String? = nil
        var toBank: String? = nil
        /// The planned payment it paid, by id.
        var payment: String? = nil
        var notPlanned = false
        var isSplit = false
    }

    /// A rule in the plan: for a payee (or, `prefix`, one starting with its words), its name and category.
    struct Rule: Sendable, Equatable {
        var match: String
        var prefix = false
        var payee: String? = nil
        var category: String? = nil
    }

    /// A row of the file, as it would come in.
    struct Found: Sendable, Equatable, Identifiable {
        enum State: Sendable, Equatable { case comesIn, alreadyIn, noPayee }
        let index: Int
        let date: String
        /// Signed as the account sees it.
        let amount: Double
        let payee: String
        /// The bank's own wording, when it says more than the payee.
        let raw: String?
        let memo: String?
        let bank: String?
        /// The category its rule or its payee's last gives it.
        let category: String?
        let state: State
        /// What the file's Category column calls it.
        var kind: String? = nil
        /// The planned payment it looks like it pays (import 2 of 3).
        var guessed: BankGuess.Planned? = nil
        /// The planned payment it comes in paying: the one guessed, or the one picked; nil for none.
        var link: String? = nil
        /// Its category, or the household's own account it moved to or from.
        var guess = BankGuess.Guess()
        var id: Int { index }

        /// The note it comes in with: the bank's wording, after a memo when it has one.
        var note: String? {
            if let raw { return memo.map { "\($0) (\(raw))" } ?? raw }
            return memo
        }
    }

    // MARK: Reading the ledger and the plan

    static func kept(in ledger: JSONValue?) -> [Kept] {
        guard case .array(let all)? = ledger?["transactions"] else { return [] }
        func str(_ v: JSONValue?) -> String? { if case .string(let s)? = v, !s.isEmpty { return s }; return nil }
        return all.map { t in
            var k = Kept()
            k.id = str(t["id"]) ?? ""
            k.account = str(t["account"]) ?? ""
            k.to = str(t["to"])
            k.date = str(t["date"]) ?? ""
            if case .number(let n)? = t["amount"] { k.amount = n }
            k.payee = str(t["payee"]) ?? ""
            k.note = str(t["note"]) ?? ""
            k.category = str(t["category"]) ?? ""
            k.bank = str(t["bank"])
            k.toBank = str(t["toBank"])
            k.payment = str(t["payment"])
            if case .bool(true)? = t["notPlanned"] { k.notPlanned = true }
            if case .array(let parts)? = t["splits"], !parts.isEmpty { k.isSplit = true }
            return k
        }
    }

    static func rules(in plan: JSONValue?) -> [Rule] {
        guard case .array(let all)? = plan?["rules"] else { return [] }
        return all.compactMap { r in
            guard case .string(let match)? = r["match"] else { return nil }
            var rule = Rule(match: match)
            if case .bool(let p)? = r["prefix"] { rule.prefix = p }
            if case .string(let p)? = r["payee"], !p.isEmpty { rule.payee = p }
            if case .string(let c)? = r["category"], !c.isEmpty { rule.category = c }
            return rule
        }
    }

    /// Whether a rule is for a payee: its name in any capitals, or for a "starts with" rule, a name starting with its words.
    static func ruleMatches(_ r: Rule, _ name: String) -> Bool {
        let want = name.trimmingCharacters(in: .whitespaces).lowercased(), m = r.match.trimmingCharacters(in: .whitespaces).lowercased()
        return !m.isEmpty && (want == m || (r.prefix && want.hasPrefix(m + " ")))
    }

    /// The rule for a payee as it comes in: one for its name first, else the longest start.
    static func ruleFor(_ rules: [Rule], _ name: String) -> Rule? {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return rules.first { !$0.prefix && ruleMatches($0, name) }
            ?? rules.filter { $0.prefix && ruleMatches($0, name) }
                .max { $0.match.trimmingCharacters(in: .whitespaces).count < $1.match.trimmingCharacters(in: .whitespaces).count }
    }

    /// The bank's wording an import kept in a note: the whole note, or the part in brackets after a memo.
    static func wordingOf(_ note: String) -> String {
        guard let re = try? NSRegularExpression(pattern: #"\(([^()]+)\)\s*$"#),
              let m = re.firstMatch(in: note, range: NSRange(note.startIndex..., in: note)),
              let r = Range(m.range(at: 1), in: note) else { return note }
        return String(note[r])
    }

    private static func words(_ x: String) -> [String] {
        String(x.lowercased().map { $0.isASCII && ($0.isLetter || $0.isNumber) ? $0 : " " })
            .split(separator: " ").map(String.init)
    }

    /// The names the household gave payees by hand, by the clean name of the
    /// bank's wording they came in as, the latest winning ("SUNSET PALMS EAS
    /// SUNSET PAL" renamed HOA comes in as HOA next time).
    static func renameMemory(_ ledger: [Kept], clean: (String) -> String) -> [String: String] {
        var out: [String: String] = [:]
        for q in ledger where !q.payee.isEmpty && !q.note.isEmpty && q.to == nil {
            let said = wordingOf(q.note), from = clean(said)
            if from.isEmpty || from.lowercased() == q.payee.lowercased() || from.lowercased() == said.lowercased() { continue }
            let raw = Set(words(said))
            if !words(q.payee).allSatisfy({ raw.contains($0) }) { out[from.lowercased()] = q.payee }
        }
        return out
    }

    // MARK: Already in

    /// How far apart a transfer's two halves may be.
    static let pairDays = 3

    private static func dayNumber(_ s: String) -> Int {
        guard let d = LocalDay.parse(s) else { return 0 }
        return Int((d.timeIntervalSince1970 / 86_400).rounded())
    }

    /// The same transaction already in the ledger: the bank's own ID on the
    /// account (or a transfer's arriving half's), or else on the account, on
    /// the day, for the amount, to a payee alike (or none on either). A row
    /// brought in before with only CREDIT or DEBIT as its payee counts too:
    /// giving it this file's payee is the computer's for now.
    static func already(date: String, amount: Double, payee: String, bank: String?, account: String, in ledger: [Kept]) -> Bool {
        ledger.contains { q in
            if let bank, q.account == account, q.bank == bank { return true }
            if let bank, q.to == account, q.toBank == bank { return true }
            let arriving = q.to == account
            guard q.account == account || arriving else { return false }
            guard q.date == date || (arriving && abs(dayNumber(q.date) - dayNumber(date)) <= pairDays) else { return false }
            guard abs((arriving ? -q.amount : q.amount) - amount) < 0.005 else { return false }
            return q.payee.isEmpty || payee.isEmpty || BankFile.alike(q.payee, payee) || (arriving && q.toBank != nil) || BankFile.wayOnly(q.payee)
        }
    }

    /// One already in by the bank's wording kept in its note, on the account, the day and the amount, however it was renamed since.
    static func noted(date: String, amount: Double, said: String, account: String, in ledger: [Kept]) -> Bool {
        !said.isEmpty && ledger.contains { q in
            q.account == account && q.to == nil && q.date == date && abs(q.amount - amount) < 0.005 && q.note.contains(said)
        }
    }

    // MARK: What comes in

    /// The file's rows as they'd come into `account`. `clean` is the payee a
    /// person would write for a bank's wording and the town its file names
    /// (`PayeeLogos.cleanPayee` after `withoutTown`).
    static func found(_ rows: [BankFile.Row], account: String, ledger: [Kept], rules: [Rule],
                      clean: (String, String?) -> String) -> [Found] {
        let memory = renameMemory(ledger) { clean($0, nil) }
        func lastCategory(_ payee: String) -> String? {
            ledger.last { !$0.payee.isEmpty && !$0.category.isEmpty && $0.payee.lowercased() == payee.lowercased() }?.category
        }
        return rows.enumerated().map { i, t in
            let said = t.payee.split(whereSeparator: \.isWhitespace).joined(separator: " ")
            let cleaned = clean(t.payee, t.town)
            let raw = !said.isEmpty && said.lowercased() != cleaned.lowercased() ? said : nil
            let rule = ruleFor(rules, cleaned)
            let payee = rule?.payee ?? raw.flatMap { _ in memory[cleaned.lowercased()] } ?? cleaned
            let state: Found.State
            if already(date: t.date, amount: t.amount, payee: payee, bank: t.id, account: account, in: ledger)
                || (raw.map { already(date: t.date, amount: t.amount, payee: $0, bank: t.id, account: account, in: ledger) } ?? false)
                || noted(date: t.date, amount: t.amount, said: raw ?? payee, account: account, in: ledger) {
                state = .alreadyIn
            } else if payee.trimmingCharacters(in: .whitespaces).isEmpty {
                state = .noPayee
            } else {
                state = .comesIn
            }
            return Found(index: i, date: t.date, amount: t.amount, payee: payee, raw: raw, memo: t.memo, bank: t.id,
                         category: rule?.category ?? (payee.isEmpty ? nil : lastCategory(payee)), state: state, kind: t.kind)
        }
    }

    /// Each row that comes in with what it plainly pays and what it's for
    /// (import 2 of 3), in the file's order, no planned day paid twice. A
    /// link picked by hand (`picked`, by row; "" for none) wins over the one
    /// guessed, and its payment's category follows it.
    static func guessing(_ found: [Found], account: String, ledger: [Kept], plan: JSONValue?, view: JSONValue?,
                         checking: String, picked: [Int: String] = [:], logos: PayeeLogos) -> [Found] {
        let payments = BankGuess.payments(in: plan).filter { $0.card == nil }
        let accounts = BankGuess.accounts(in: plan)
        let categories = BankGuess.categories(in: view)
        let dues = BankGuess.dues(in: view)
        var taken = BankGuess.paidDays(ledger, dues: dues)
        let learned = BankGuess.learnedLinks(ledger, logos: logos)
        let same = { (payee: String, x: BankGuess.Payment) in
            BankGuess.paysBill(payee, x, logos: logos) || learned[BankGuess.payeeKey(payee, logos: logos)]?.contains(x.id) == true
        }
        return found.map { f in
            guard f.state == .comesIn else { return f }
            var g = f
            g.guessed = BankGuess.plannedFor(date: f.date, amount: f.amount, payee: f.payee, account: account, payments: payments,
                                             dues: dues, checking: checking, taken: taken, same: same)
            if let at = g.guessed { taken.insert(at.key) }
            let link = picked[f.index].map { $0.isEmpty ? nil : $0 } ?? g.guessed?.payment
            g.link = link
            g.guess = BankGuess.guessFor(payee: f.payee, amount: f.amount, raw: f.raw, kind: f.kind, into: account, accounts: accounts,
                                         categories: categories, last: f.category, pays: payments.first { $0.id == link }, logos: logos)
            // Before the computer's categories are read, the rule's or the last one stands.
            if categories.isEmpty, g.guess.account == nil { g.guess.category = f.category }
            return g
        }
    }

    /// The ones that come in, as transactions for the ledger: each with its
    /// category and the payment it pays; a move between the household's own
    /// accounts out of this one to the other, or out of the other into this one.
    static func transactions(_ found: [Found], account: String) -> [NewTransaction] {
        found.filter { $0.state == .comesIn }.compactMap { f in
            guard let date = LocalDay.parse(f.date) else { return nil }
            var t = NewTransaction(date: date, account: account, isMoneyIn: f.amount > 0, amount: abs(f.amount),
                                   payee: String(f.payee.prefix(200)), category: String((f.guess.category ?? f.category ?? "").prefix(100)),
                                   note: String((f.note ?? "").prefix(1000)), bank: f.bank.map { String($0.prefix(200)) })
            t.payment = f.link
            if let other = f.guess.account {
                t.category = ""
                t.payment = nil
                if f.amount < 0 {
                    t.to = other
                } else {
                    // Its leaving half kept: out of the other account into this one.
                    t.account = other
                    t.to = account
                    t.isMoneyIn = false
                    t.toBank = t.bank
                    t.bank = nil
                }
            }
            return t
        }
    }

    /// Files over this aren't a bank's statement.
    static let largestFile = 5_000_000
    /// Rows listed on the sheet; the rest are counted.
    static let shownRows = 60
    /// What a bank's file is, by its ending.
    static let fileTypes = ["csv", "tsv", "txt", "ofx", "qfx"]

    /// The accounts a file can come into: not homes, cars or collectibles.
    static func intoKinds(_ kind: String) -> Bool { !["home", "car", "collectible"].contains(kind) }
}
