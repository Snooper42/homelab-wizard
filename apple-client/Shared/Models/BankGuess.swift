import Foundation

/// What a row of a bank's file is for, as the computer's Import works it out
/// (importData.ts's `plannedFor`, guessCategory.ts's `guessFor`): the
/// planned payment it plainly pays (so the plan doesn't take it out again on
/// its day), and its category or the household's own account the money
/// moved to or from. Import 2 of 3. Plain functions: nothing is looked up anywhere.
enum BankGuess {
    /// A planned payment, as the plan keeps it (finance.Payment's keys).
    struct Payment: Sendable, Equatable {
        var id = ""
        var name = ""
        var kind = ""
        var institution: String? = nil
        var type: String? = nil
        var amount = 0.0
        var estimate = false
        var card: String? = nil
        var payer: String? = nil
        var from: String? = nil
        var to: String? = nil
    }

    /// An account, as the plan keeps it.
    struct Account: Sendable, Equatable {
        var id = ""
        var name = ""
        var kind = ""
        var institution: String? = nil
        var detail: String? = nil
    }

    /// A category, as the plan keeps it.
    struct Category: Sendable, Equatable {
        var name: String
        var income = false
    }

    /// A planned payment a row pays, and the day of it.
    struct Planned: Sendable, Equatable, Hashable {
        let payment: String
        let due: String
        var key: String { payment + " " + due }
    }

    /// What a guess says: a category, or the household's own account the money moved to or from.
    struct Guess: Sendable, Equatable {
        var category: String? = nil
        var account: String? = nil
    }

    // MARK: Reading the plan and the view

    private static func str(_ v: JSONValue?) -> String? { if case .string(let s)? = v, !s.isEmpty { return s }; return nil }
    private static func list(_ v: JSONValue?) -> [JSONValue] { if case .array(let a)? = v { return a }; return [] }

    static func payments(in plan: JSONValue?) -> [Payment] {
        list(plan?["payments"]).map { p in
            var x = Payment()
            x.id = str(p["id"]) ?? ""
            x.name = str(p["name"]) ?? ""
            x.kind = str(p["kind"]) ?? ""
            x.institution = str(p["institution"])
            x.type = str(p["type"])
            if case .number(let n)? = p["amount"] { x.amount = n }
            if case .bool(let b)? = p["estimate"] { x.estimate = b }
            x.card = str(p["card"])
            x.payer = str(p["payer"])
            x.from = str(p["from"])
            x.to = str(p["to"])
            return x
        }
    }

    static func accounts(in plan: JSONValue?) -> [Account] {
        list(plan?["accounts"]).map { a in
            Account(id: str(a["id"]) ?? "", name: str(a["name"]) ?? "", kind: str(a["kind"]) ?? "",
                    institution: str(a["institution"]), detail: str(a["detail"]))
        }
    }

    static func categories(in plan: JSONValue?) -> [Category] {
        list(plan?["categories"]).compactMap { c in
            guard let name = str(c["name"]) else { return nil }
            if case .bool(true)? = c["income"] { return Category(name: name, income: true) }
            return Category(name: name)
        }
    }

    /// Each payment's days, as the computer's view gives them (View.dues).
    static func dues(in view: JSONValue?) -> [String: [String]] {
        guard case .object(let o)? = view?["dues"] else { return [:] }
        return o.mapValues { list($0).compactMap { str($0) } }
    }

    // MARK: Planned payments

    /// How far a row may be from a payment's day and still pay it.
    static let matchDays = 16
    /// How far by its amount alone, its name saying nothing of the payment.
    static let byAmountDays = 5
    /// From this amount up, the cents alone make a payment plain within matchDays.
    static let bigAmount = 100.0

    private static func tolerance(_ x: Payment) -> Double { x.estimate || x.kind == "utilities" ? 0.4 : 0.1 }

    static func dayNumber(_ s: String) -> Int {
        guard let d = LocalDay.parse(s) else { return 0 }
        return Int((d.timeIntervalSince1970 / 86_400).rounded())
    }

    /// Whether a payee is a planned payment's: alike its name, or of its brand (Mark.tsx's `paysAlike`).
    static func paysAlike(_ payee: String, _ x: Payment, logos: PayeeLogos) -> Bool {
        let b = logos.payeeBrand(institution: nil, payee: payee)
        return BankFile.alike(payee, x.name) || (b != nil && b == logos.brandOf(institution: x.institution, name: x.name, kind: x.kind))
    }

    private static let billKinds: Set<String> = ["utilities", "home", "car", "subscriptions", "loans"]

    /// Whether a payee pays a planned bill by what it is (an electric company
    /// the Electric bill, a car's make the car payment, an insurer Car insurance).
    static func samePurpose(_ payee: String, _ x: Payment, logos: PayeeLogos) -> Bool {
        guard billKinds.contains(x.kind), let brand = logos.brandOf(institution: nil, name: payee) else { return false }
        if logos.brandsByKey[brand]?.kind == "car" {
            return (x.kind == "car" && !x.name.lowercased().contains("insurance"))
                || (x.kind == "loans" && has(x.name, #"\b(?:car|auto|vehicle|truck)\b"#))
        }
        guard let cat = brandCategory[brand] else { return false }
        return paymentCategory(x, logos: logos).contains { $0.lowercased() == cat.lowercased() }
    }

    static func paysBill(_ payee: String, _ x: Payment, logos: PayeeLogos) -> Bool {
        paysAlike(payee, x, logos: logos) || samePurpose(payee, x, logos: logos)
    }

    /// The planned payments each payee has paid before, by the ledger's links.
    static func learnedLinks(_ ledger: [BankImport.Kept], logos: PayeeLogos) -> [String: Set<String>] {
        var by: [String: Set<String>] = [:]
        for t in ledger {
            guard let payment = t.payment, !t.payee.trimmingCharacters(in: .whitespaces).isEmpty, t.to == nil else { continue }
            by[payeeKey(t.payee, logos: logos), default: []].insert(payment)
        }
        return by
    }

    static func payeeKey(_ s: String, logos: PayeeLogos) -> String {
        logos.cleanPayee(s).lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    /// The payment days the ledger has paid already: each linked transaction's nearest day of its payment.
    static func paidDays(_ ledger: [BankImport.Kept], dues: [String: [String]]) -> Set<String> {
        var out = Set<String>()
        for q in ledger {
            guard let payment = q.payment, let days = dues[payment], var at = days.first else { continue }
            for b in days.dropFirst() where abs(dayNumber(b) - dayNumber(q.date)) < abs(dayNumber(at) - dayNumber(q.date)) { at = b }
            if abs(dayNumber(at) - dayNumber(q.date)) <= matchDays { out.insert(payment + " " + at) }
        }
        return out
    }

    /// The planned payment a row plainly pays, or none (importData.ts's
    /// `plannedFor`): money out of this account to a payee that pays it, or
    /// money in from someone outside the household, for its amount give or
    /// take a tenth (two fifths for a bill that changes), within two weeks of
    /// one of its days not paid already. The nearest day wins; a tie is no
    /// plain answer. Else by its amount alone: to the cent, near one of its
    /// days, one payment only.
    static func plannedFor(date: String, amount: Double, payee: String, account: String, payments: [Payment],
                           dues: [String: [String]], checking: String, taken: Set<String>,
                           same: (String, Payment) -> Bool) -> Planned? {
        guard amount != 0, !payee.isEmpty else { return nil }
        let paid = abs(amount)
        var best: (planned: Planned, gap: Int, off: Double)?
        var tie = false
        func fits(_ x: Payment) -> Bool {
            if let payer = x.payer {
                return amount > 0 && (x.to ?? checking) == account && (same(payee, x) || BankFile.alike(payee, payer))
            }
            return amount < 0 && (x.from ?? checking) == account && same(payee, x)
        }
        for x in payments {
            if x.card != nil || !(x.amount > 0) || abs(paid - x.amount) > x.amount * tolerance(x) + 0.005 || !fits(x) { continue }
            for due in dues[x.id] ?? [] {
                let gap = abs(dayNumber(due) - dayNumber(date)), off = abs(paid - x.amount)
                if gap > matchDays || taken.contains(x.id + " " + due) { continue }
                if let b = best {
                    if gap < b.gap || (gap == b.gap && off < b.off) {
                        tie = b.planned.payment != x.id && gap == b.gap && off == b.off
                        best = (Planned(payment: x.id, due: due), gap, off)
                    } else if gap == b.gap && off == b.off && x.id != b.planned.payment {
                        tie = true
                    }
                } else {
                    best = (Planned(payment: x.id, due: due), gap, off)
                }
            }
        }
        if let best { return tie ? nil : best.planned }
        var exact: [(planned: Planned, gap: Int)] = []
        for x in payments {
            if x.card != nil || !(x.amount > 0) || abs(paid - x.amount) >= 0.005 { continue }
            let way = x.payer != nil ? amount > 0 && (x.to ?? checking) == account : amount < 0 && (x.from ?? checking) == account
            if !way { continue }
            for due in dues[x.id] ?? [] {
                let gap = abs(dayNumber(due) - dayNumber(date))
                if gap <= (x.amount >= bigAmount ? matchDays : byAmountDays) && !taken.contains(x.id + " " + due) {
                    exact.append((Planned(payment: x.id, due: due), gap))
                }
            }
        }
        guard Set(exact.map(\.planned.payment)).count == 1 else { return nil }
        return exact.enumerated().min { a, b in a.element.gap < b.element.gap || (a.element.gap == b.element.gap && a.offset < b.offset) }?.element.planned
    }

    // MARK: Categories

    /// Brands and the category each is mostly (guessCategory.ts's `brandCategory`).
    static let brandCategory: [String: String] = {
        let lists: [(String, String)] = [
            ("Groceries", "costco walmart kroger wholefoods traderjoes aldi publix safeway lidl tesco instacart"),
            ("Gas", "shell chevron exxon bp"),
            ("Eating out", "starbucks mcdonalds chipotle tacobell burgerking kfc wendys subway dunkin chickfila pizzahut dominos panerabread doordash grubhub postmates"),
            ("Shopping", "amazon ebay etsy bestbuy ikea target kohls macys nordstrom gap oldnavy uniqlo hm zara wayfair sephora nike adidas"),
            ("Repairs", "thehomedepot lowes"),
            ("Health", "cvs walgreens"),
            ("Phone", "verizon tmobile atandt mintmobile visiblebyverizon googlefi usmobile boostmobile"),
            ("Internet", "xfinity spectrum cox optimum googlefiber starlink frontier centurylink"),
            ("Electric", "dukeenergy pge coned fpl"),
            ("Car insurance", "geico progressive statefarm allstate libertymutual"),
            ("Travel", "delta unitedairlines americanairlines southwestairlines jetblue marriott hilton airbnb expedia bookingdotcom hotelsdotcom uber lyft"),
            ("Fitness", "planetfitness peloton strava"),
            ("Gaming", "steam playstation xboxgamepass nintendoswitch epicgames ea ubisoft roblox gamestop"),
        ]
        var out: [String: String] = [:]
        for (category, brands) in lists { for b in brands.split(separator: " ") where out[String(b)] == nil { out[String(b)] = category } }
        return out
    }()

    /// The word hints and the category each means.
    static let hintCategory: [String: String] = [
        "internet": "Internet", "phone": "Phone", "water": "Water", "utilities": "Electric", "spending": "Groceries", "fitness": "Fitness",
        "food": "Eating out", "health": "Health", "school": "Kids and school", "streaming": "Streaming and music", "music": "Streaming and music",
        "cloud": "Cloud and homelab", "software": "Software and apps", "home": "Mortgage or rent", "gaming": "Gaming",
    ]

    /// What a subscription can be for, and its name (Mark.tsx's `subTypes`).
    static let subTypes: [(String, String)] = [
        ("streaming", "Streaming and music"), ("software", "Software and apps"), ("cloud", "Cloud and homelab"), ("gaming", "Gaming"),
        ("news", "News and reading"), ("fitness", "Fitness"), ("food", "Food and delivery"), ("phone", "Phone"), ("other", "Other"),
    ]

    static func subTypeName(_ t: String) -> String {
        subTypes.first { $0.0 == t }?.1 ?? (t.prefix(1).uppercased() + t.dropFirst())
    }

    /// The type a subscription is suggested as: from its brand, else a word in its name (Mark.tsx's `suggestType`).
    static func suggestType(institution: String?, name: String?, logos: PayeeLogos) -> String {
        if let b = logos.brandOf(institution: institution, name: name), let t = logos.subscriptionType(ofBrand: b) { return t }
        let h = logos.hintOf(kind: "subscriptions", name: name)
        if h == "music" { return "streaming" }
        return h.flatMap { h in subTypes.contains { $0.0 == h } ? h : nil } ?? ""
    }

    /// A planned payment's categories, likeliest first: its name's hint, a subscription's type, its kind's group.
    static func paymentCategory(_ p: Payment, logos: PayeeLogos) -> [String] {
        var out: [String] = []
        if let h = logos.hintOf(kind: p.kind, name: p.name), let c = hintCategory[h] { out.append(c) }
        if p.kind == "subscriptions" {
            let t = p.type ?? suggestType(institution: p.institution, name: p.name, logos: logos)
            if !t.isEmpty { out.append(subTypeName(t)) }
            out.append("Subscriptions")
        }
        if p.kind == "car", p.name.lowercased().contains("insurance") { out.append("Car insurance") }
        if let g = ["home": "Home", "utilities": "Utilities", "car": "Car", "subscriptions": "Subscriptions", "other": "Other"][p.kind] { out.append(g) }
        return out.filter { !$0.isEmpty }
    }

    /// A bank's own words for its rows (a file's Category column), and what each is in the household's.
    private static let bankWords: [(String, [String])] = [
        (#"grocer|supermarket"#, ["Groceries"]),
        (#"restaurant|food & drink|food and drink|dining|bar & caf|fast food|coffee"#, ["Eating out"]),
        (#"\bfuel|gas station|^gas\b|gas/automotive"#, ["Gas"]),
        (#"airline|lodging|hotel|travel|vehicle rental|car rental|rail|cruise"#, ["Travel"]),
        (#"pharmac|drug store|health|medical|dental|doctor|hospital"#, ["Health"]),
        (#"fitness|gym|sporting club"#, ["Fitness"]),
        (#"cable|internet"#, ["Internet"]),
        (#"wireless|telephone|telecom|phone"#, ["Phone"]),
        (#"hardware|home improvement|building supplies|home & garden|home and garden"#, ["Repairs"]),
        (#"education|school|tuition|child care"#, ["Kids and school"]),
        (#"gift|donation|charit"#, ["Gifts and giving", "Gifts"]),
        (#"fees? & adjust|fees and adjust|interest charge|^fees?\b"#, ["Fees and interest"]),
        (#"insurance"#, ["Insurance"]),
        (#"utilit"#, ["Utilities", "Electric"]),
        (#"entertainment"#, ["Entertainment"]),
        (#"retail|department store|clothing|merchandise|shopping|electronics|sporting goods|book store|internet purchase|wholesale"#, ["Shopping"]),
        (#"automotive|auto service|auto parts|parking|tolls?\b"#, ["Car"]),
    ]

    private static func has(_ s: String, _ pattern: String, caseless: Bool = true) -> Bool {
        guard let re = try? NSRegularExpression(pattern: pattern, options: caseless ? [.caseInsensitive] : []) else { return false }
        return re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    /// The household's names a bank's word for a row may be, likeliest first
    /// ("Merchandise & Supplies-Groceries" is Groceries before Shopping).
    static func bankKinds(_ word: String?) -> [String] {
        let w = (word ?? "").lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !w.isEmpty, let dash = try? NSRegularExpression(pattern: #"\s*-\s*"#) else { return [] }
        let split = dash.stringByReplacingMatches(in: w, range: NSRange(w.startIndex..., in: w), withTemplate: "\u{0}")
        let parts = split.components(separatedBy: "\u{0}")
            .filter { !$0.isEmpty && !["other", "misc", "miscellaneous", "general"].contains($0) }
            .reversed()
        return parts.flatMap { part in [part] + bankWords.filter { has(part, $0.0, caseless: false) }.flatMap(\.1) }
    }

    /// Words for matching: lower case, letters and digits, one space between.
    private static func flat(_ s: String) -> String {
        String(s.lowercased().map { $0.isASCII && ($0.isLetter || $0.isNumber) ? $0 : " " })
            .split(separator: " ").joined(separator: " ")
    }

    /// The household's own account a row moved money to or from: a card paid
    /// off ("Payment to Chase card ••1234"), a card of the payee's company
    /// paid off by the bank's words ("AMERICAN EXPRESS ACH PMT"), or an account
    /// named by the payee ("Apple Savings"). One account, never the one
    /// brought into; none when two fit.
    static func ownAccount(_ payee: String, into: String, accounts: [Account], raw: String?, logos: PayeeLogos) -> String? {
        let others = accounts.filter { $0.id != into && !["home", "car", "collectible", "other"].contains($0.kind) }
        let cards = others.filter { $0.kind == "card" }
        if let re = try? NSRegularExpression(pattern: "^Payment to (.+) card \u{2022}\u{2022}(\\d{4})$"),
           let m = re.firstMatch(in: payee, range: NSRange(payee.startIndex..., in: payee)),
           let bankRange = Range(m.range(at: 1), in: payee), let fourRange = Range(m.range(at: 2), in: payee) {
            let four = String(payee[fourRange])
            let byFour = cards.filter { ($0.detail ?? "").contains(four) || $0.name.contains(four) }
            if byFour.count == 1 { return byFour[0].id }
            let bank = logos.brandOf(institution: nil, name: String(payee[bankRange]))
            let byBank = cards.filter { bank != nil && logos.brandOf(institution: $0.institution, name: $0.name) == bank }
            return byBank.count == 1 ? byBank[0].id : nil
        }
        if let raw, has(raw.replacingOccurrences(of: "-", with: " ").replacingOccurrences(of: "_", with: " "), #"\b(?:pmt|pymt|payment|autopay|epay|e payment)\b"#) {
            let brand = logos.brandOf(institution: nil, name: payee)
            let mine = cards.filter { brand != nil && logos.brandOf(institution: $0.institution, name: $0.name) == brand }
            if mine.count == 1 { return mine[0].id }
        }
        let p = flat(payee)
        guard !p.isEmpty, p.split(separator: " ").count >= 2 else { return nil }
        let named = others.filter { $0.kind != "card" && $0.kind != "loan" && flat($0.name) == p }
        return named.count == 1 ? named[0].id : nil
    }

    /// A category a household may call by another name.
    private static let alsoCalled: [String: [String]] = ["gaming": ["Gaming", "Games", "Video games", "Video gaming"]]

    /// What a row is for: the household's own account it moved to or from;
    /// else the category its payee had last, the planned payment's it pays, its
    /// words', a known company's, or the bank's (guessCategory.ts's `guessFor`).
    /// Only a category in the household's list is given, an income one for money in.
    static func guessFor(payee: String, amount: Double, raw: String?, kind: String?, into: String, accounts: [Account],
                         categories: [Category], last: String?, pays: Payment?, logos: PayeeLogos) -> Guess {
        if !payee.isEmpty, let moved = ownAccount(payee, into: into, accounts: accounts, raw: amount < 0 ? raw : nil, logos: logos) {
            return Guess(account: moved)
        }
        var have: [String: Category] = [:]
        for c in categories where have[c.name.lowercased()] == nil { have[c.name.lowercased()] = c }
        if let last, let c = have[last.lowercased()] { return Guess(category: c.name) }
        func pick(_ names: [String?]) -> String? {
            var expanded: [String] = []
            for case let x? in names { expanded += alsoCalled[x.lowercased()] ?? [x] }
            // Money in takes an income category, money out a spending one.
            for n in expanded { if let c = have[n.lowercased()], c.income == (amount > 0) { return c.name } }
            return nil
        }
        let words = " " + flat(payee) + " "
        let fromWords: String? = amount > 0
            ? (has(words, " (payroll|salary|direct dep|dir dep|paycheck) ", caseless: false) ? "Paycheck"
               : words.contains(" interest ") ? "Interest" : has(words, " (refund|return) ", caseless: false) ? "Refunds" : nil)
            : (has(words, " (fee|fees|overdraft) ", caseless: false) ? "Fees and interest" : nil)
        let brand = payee.isEmpty ? nil : logos.brandOf(institution: nil, name: payee)
        let sub = brand.map { suggestType(institution: $0, name: payee, logos: logos) } ?? ""
        let hint = logos.hintOf(kind: nil, name: payee)
        let otherwise: String? = brand.flatMap { brandCategory[$0] } == "Gaming" ? "Shopping" : nil
        var names: [String?] = (pays.map { paymentCategory($0, logos: logos) } ?? []).map { Optional($0) }
        names += [fromWords, brand.flatMap { brandCategory[$0] }, sub.isEmpty ? nil : subTypeName(sub), hint.flatMap { hintCategory[$0] }, otherwise]
        names += bankKinds(kind).map { Optional($0) }
        return Guess(category: pick(names))
    }
}
