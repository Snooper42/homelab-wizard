import Foundation

// A payee's logo, as the computer's Finances draws it: the brand's mark on
// the brand's colour, else its initials on a colour its name picks, else
// the icon of what it's for, else its first letter.
//
// The brands, the rules that match a name to one, and the category colours
// come from Resources/PayeeLogos.json, which scripts/make-payee-logos.mjs
// makes from web/src/finances (logos.ts, Mark.tsx, payees.ts, hues.ts) and
// web/dist/style.css. Nothing here is copied by hand: the functions below
// are Swift ports of the computer's, and PayeeLogoTests checks they answer
// as the computer's own do for a few thousand payees.
//
// Every logo is bundled: no logo is fetched from anywhere, so which bank
// you use stays on your phone.

/// One brand: its name, its colour and the ink that reads on it (4.5:1),
/// and its mark (a 24 by 24 drawing, or its initials).
struct PayeeBrand: Decodable, Sendable, Equatable, Identifiable {
    let key: String
    let name: String
    /// "#rrggbb".
    let bg: String
    let ink: String
    /// bank, card, investment, car, home; empty for a bill.
    let kind: String
    /// Its mark in absolute M, L, C and Z commands (see LogoPath).
    let path: String?
    /// For a brand with no mark: its initials.
    let letters: String?

    var id: String { key }
}

/// What a logo circle shows.
enum LogoContent: Equatable, Sendable {
    /// A brand's mark or initials on its colour.
    case brand(PayeeBrand)
    /// A payee with no brand: its initials on one of the eight auto colours (0 to 7).
    case initials(String, auto: Int)
    /// The icon of what it's for (a glyph name: "food", "water"…), in its category's colour (1 to 8) when it has one.
    case icon(String, hue: Int?)
    /// The first letter of its name, in its category's colour when it has one.
    case letter(String, hue: Int?)
}

/// One segment of a brand's mark, in its 24 by 24 box.
enum LogoSegment: Equatable, Sendable {
    case move(Double, Double)
    case line(Double, Double)
    case curve(Double, Double, Double, Double, Double, Double)
    case close
}

enum LogoPath {
    /// The segments of a mark as PayeeLogos.json writes it ("M0 15.4C0 15.9 …Z"),
    /// or nil for anything else.
    static func segments(_ d: String) -> [LogoSegment]? {
        var out: [LogoSegment] = []
        var command: Character?
        var numbers: [Double] = []
        var current = ""
        func flushNumber() -> Bool {
            guard !current.isEmpty else { return true }
            guard let n = Double(current), n.isFinite else { return false }
            numbers.append(n)
            current = ""
            return true
        }
        func flushCommand() -> Bool {
            guard let c = command else { return numbers.isEmpty }
            let n = numbers
            switch (c, n.count) {
            case ("M", 2): out.append(.move(n[0], n[1]))
            case ("L", 2): out.append(.line(n[0], n[1]))
            case ("C", 6): out.append(.curve(n[0], n[1], n[2], n[3], n[4], n[5]))
            case ("Z", 0): out.append(.close)
            default: return false
            }
            numbers = []
            return true
        }
        for ch in d {
            switch ch {
            case "M", "L", "C", "Z":
                guard flushNumber(), flushCommand() else { return nil }
                command = ch
            case " ":
                guard flushNumber() else { return nil }
            case "0"..."9", ".", "-":
                current.append(ch)
            default:
                return nil
            }
        }
        guard flushNumber(), flushCommand(), !out.isEmpty else { return nil }
        if case .move = out[0] {} else { return nil }
        return out
    }
}

/// The colours of a category (1 to 8): its own, a soft tint behind its
/// icon, and an ink that reads on the tint at 4.5:1.
struct CategoryColours: Decodable, Sendable, Equatable {
    let base: String
    let soft: String
    let ink: String
}

/// The bundled brands, the rules that find one for a payee, and the colours.
/// Immutable once loaded, so it's shared freely.
final class PayeeLogos: @unchecked Sendable {
    // @unchecked: every stored property is a constant; NSRegularExpression is
    // documented as safe to use from any thread.

    /// The app's own copy, from Resources/PayeeLogos.json; empty if it's missing.
    static let shared: PayeeLogos = {
        guard let url = resourceBundle.url(forResource: "PayeeLogos", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let logos = try? PayeeLogos(json: data) else {
            SecureLog.ui.error("Payee logos missing from the app")
            return PayeeLogos.empty
        }
        return logos
    }()

    private static var resourceBundle: Bundle {
        #if SWIFT_PACKAGE
        return Bundle.module
        #else
        return Bundle.main
        #endif
    }

    let brands: [PayeeBrand]
    let brandsByKey: [String: PayeeBrand]
    /// Each mark, read once.
    let marks: [String: [LogoSegment]]
    /// The light and dark colours of categories 1 to 8 (index 0 is category 1).
    let categoryLight: [CategoryColours]
    let categoryDark: [CategoryColours]
    /// A payee's own mark's colours, white reads on each.
    let autoColours: [String]
    /// Every glyph Mark.tsx has an icon for.
    let glyphs: Set<String>

    private let brandWords: [(words: String, key: String)]
    private let loose: Set<String>
    private let tails: Set<String>
    private let models: [(model: String, make: String)]
    private let hints: [(glyph: String, words: [String])]
    private let plainKinds: Set<String>
    private let brandTypes: [String: String]
    private let brandKinds: [String: String]
    private let processors: Set<String>
    private let leading: NSRegularExpression?
    private let states: Set<String>
    private let chains: [(words: String, name: String)]
    private let kindHue: [String: Int]
    private let kindCategory: [String: String]
    /// cleanPayee's patterns, compiled once.
    private let patterns: [String: NSRegularExpression]

    private enum P {
        static let spaces = #"\s+"#
        static let star = #"^([A-Za-z. ]{1,12}?)\s*\*\s*(.+)$"#
        static let starReference = #"\s*\*\s*\S*$"#
        static let www = #"\bwww\."#
        static let domain = #"\.(?:com|net|org|co|io|tv|us)\b(?:/\S*)?"#
        static let date = #"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b"#
        static let phone = #"\b\d{3}[-. ]\d{3}[-. ]\d{4}\b"#
        static let cardDigits = #"\b(?:x{2,}|\*{2,})\d+\b"#
        static let store = #"\bstore\s*#?\s*\d+\b"#
        static let number = #"#\s*\d+"#
        static let terminal = #"(?:^|\s)[A-Za-z]{0,2}\d{3,}[A-Za-z0-9]*(?=\s|$)"#
        static let trailing = #"[\s,.;:-]+$"#
        static let wordStart = #"(^|[\s(&/-])([a-z])"#
        static let apostropheS = #"'S\b"#
        static let caseless: Set<String> = [www, domain, cardDigits, store]
        static let all = [spaces, star, starReference, www, domain, date, phone, cardDigits, store, number, terminal, trailing, wordStart, apostropheS]
    }

    private static func compile() -> [String: NSRegularExpression] {
        var out: [String: NSRegularExpression] = [:]
        for p in P.all {
            out[p] = try? NSRegularExpression(pattern: p, options: P.caseless.contains(p) ? [.caseInsensitive] : [])
        }
        return out
    }

    private struct File: Decodable {
        struct Payee: Decodable {
            let processors: [String]
            let leading: String
            let states: [String]
            let chains: [[String]]
        }
        struct Colours: Decodable {
            struct Schemes: Decodable {
                let light: [CategoryColours]
                let dark: [CategoryColours]
            }
            let category: Schemes
            let auto: [String]
        }
        struct Hint: Decodable {
            let glyph: String
            let words: [String]
            init(from decoder: Decoder) throws {
                var c = try decoder.unkeyedContainer()
                glyph = try c.decode(String.self)
                words = try c.decode([String].self)
            }
        }
        let brands: [PayeeBrand]
        let aliases: [[String]]
        let loose: [String]
        let tails: [String]
        let models: [[String]]
        let hints: [Hint]
        let plainKinds: [String]
        let glyphs: [String]
        let brandTypes: [String: String]
        let brandKinds: [String: String]
        let payee: Payee
        let colours: Colours
        let kindHue: [String: Int]
        let kindCategory: [String: String]
    }

    private static let empty = PayeeLogos()

    private init() {
        brands = []; brandsByKey = [:]; marks = [:]; categoryLight = []; categoryDark = []; autoColours = []; glyphs = []
        brandWords = []; loose = []; tails = []; models = []; hints = []; plainKinds = []; brandTypes = [:]; brandKinds = [:]
        processors = []; leading = nil; states = []; chains = []; kindHue = [:]; kindCategory = [:]
        patterns = Self.compile()
    }

    init(json: Data) throws {
        let f = try JSONDecoder().decode(File.self, from: json)
        brands = f.brands
        brandsByKey = Dictionary(f.brands.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        var marks: [String: [LogoSegment]] = [:]
        for b in f.brands {
            if let p = b.path, let s = LogoPath.segments(p) { marks[b.key] = s }
        }
        self.marks = marks
        categoryLight = f.colours.category.light
        categoryDark = f.colours.category.dark
        autoColours = f.colours.auto
        glyphs = Set(f.glyphs)

        // Each brand's name in words, then the names people type for one,
        // longest first (ties keep their order), so "Amazon Prime Video" wins over "Amazon".
        let pairs: [(String, String)] = f.brands.map { (Self.words($0.name), $0.key) }
            + f.aliases.compactMap { $0.count == 2 ? (Self.words($0[0]), $0[1]) : nil }
        let known = Set(f.brands.map(\.key))
        brandWords = pairs.enumerated()
            .filter { known.contains($0.element.1) }
            .sorted { a, b in
                let (x, y) = (a.element.0.utf16.count, b.element.0.utf16.count)
                return x != y ? x > y : a.offset < b.offset
            }
            .map { (words: $0.element.0, key: $0.element.1) }
        loose = Set(f.loose)
        tails = Set(f.tails)
        models = f.models.compactMap { $0.count == 2 ? (model: $0[0], make: $0[1]) : nil }
        hints = f.hints.map { (glyph: $0.glyph, words: $0.words) }
        plainKinds = Set(f.plainKinds)
        brandTypes = f.brandTypes
        brandKinds = f.brandKinds
        processors = Set(f.payee.processors)
        leading = try? NSRegularExpression(pattern: f.payee.leading, options: [.caseInsensitive])
        states = Set(f.payee.states)
        chains = f.payee.chains.compactMap { $0.count == 2 ? (words: $0[0], name: $0[1]) : nil }
        kindHue = f.kindHue
        kindCategory = f.kindCategory
        patterns = Self.compile()
    }

    // MARK: - Words

    /// A name in words to match: lower case, + as "plus", & as "and", the
    /// rest of the punctuation gone, a space each side (Mark.tsx's `words`).
    static func words(_ s: String) -> String {
        let t = s.lowercased()
            .replacingOccurrences(of: "+", with: " plus ")
            .replacingOccurrences(of: "&", with: " and ")
            .filter { $0 != "'" && $0 != "\u{2019}" && $0 != "." }
        return " " + asciiWords(t) + " "
    }

    private static func isLowerAlnum(_ u: Unicode.Scalar) -> Bool {
        (0x61...0x7A).contains(u.value) || (0x30...0x39).contains(u.value)
    }

    private static func isAlnum(_ u: Unicode.Scalar) -> Bool {
        isLowerAlnum(u) || (0x41...0x5A).contains(u.value)
    }

    /// Lower-case letters and digits, one space between runs of them, none at the ends.
    private static func asciiWords(_ s: String) -> String {
        var out = ""
        var gap = false
        for u in s.unicodeScalars {
            if isLowerAlnum(u) {
                if gap && !out.isEmpty { out.append(" ") }
                gap = false
                out.unicodeScalars.append(u)
            } else {
                gap = true
            }
        }
        return out
    }

    /// Words for matching a bank's wording: lower case, letters and digits,
    /// one space between (payees.ts's `flat`).
    private static func flat(_ s: String) -> String {
        asciiWords(s.lowercased().replacingOccurrences(of: "'", with: " ").replacingOccurrences(of: "\u{2019}", with: " "))
    }

    // MARK: - A bank's wording

    /// The payee a person would write for a bank's wording ("SQ *BLUE BOTTLE"
    /// is "Blue Bottle", "AMZN MKTP US*2K4" is "Amazon"); the wording itself
    /// when nothing in it says who (payees.ts's `cleanPayee`).
    func cleanPayee(_ raw: String?) -> String {
        let raw = raw ?? ""
        var s = replace(raw, P.spaces, with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return "" }
        if let leading {
            let ns = s as NSString
            if let m = leading.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) {
                s = ns.replacingCharacters(in: m.range, with: "")
            }
            s = s.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        // A processor first: the merchant follows its star ("SQ *BLUE BOTTLE");
        // a star after the merchant is its own reference ("…US*2K4").
        if let star = groups(s, P.star), processors.contains(Self.flat(star[0]).replacingOccurrences(of: " ", with: "")) {
            s = star[1]
        } else {
            s = replaceFirst(s, P.starReference, with: "").replacingOccurrences(of: "*", with: " ")
        }
        s = replace(s, P.www, with: "")
        s = replace(s, P.domain, with: "")
        s = replace(s, P.date, with: " ")
        s = replace(s, P.phone, with: " ")
        s = replace(s, P.cardDigits, with: " ") // a card's last digits
        s = replace(s, P.store, with: " ")
        s = replace(s, P.number, with: " ")
        s = replace(s, P.terminal, with: " ") // a store or terminal number
        s = replace(s, P.spaces, with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        // A trailing state, after something to keep (in capitals, as a bank writes it).
        var parts = s.components(separatedBy: " ")
        if parts.count > 1, let last = parts.last, states.contains(last.lowercased()), last == last.uppercased() {
            parts.removeLast()
        }
        s = replace(parts.joined(separator: " "), P.trailing, with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return raw.trimmingCharacters(in: .whitespacesAndNewlines) }
        let f = Self.flat(s)
        if let chain = chains.first(where: { f == $0.words || f.hasPrefix($0.words + " ") }) { return chain.name }
        return ordinary(s)
    }

    /// "BLUE BOTTLE" is "Blue Bottle"; a line in mixed case is left as typed.
    private func ordinary(_ s: String) -> String {
        guard s == s.uppercased() else { return s }
        let lower = s.lowercased()
        guard let re = patterns[P.wordStart] else { return lower }
        let out = NSMutableString(string: lower)
        for m in re.matches(in: lower, range: NSRange(location: 0, length: out.length)).reversed() {
            let r = m.range(at: 2)
            out.replaceCharacters(in: r, with: out.substring(with: r).uppercased())
        }
        return replace(out as String, P.apostropheS, with: "'s")
    }

    /// Every match replaced by a fixed string.
    private func replace(_ s: String, _ pattern: String, with text: String) -> String {
        guard let re = patterns[pattern] else { return s }
        return re.stringByReplacingMatches(in: s, range: NSRange(location: 0, length: (s as NSString).length),
                                           withTemplate: NSRegularExpression.escapedTemplate(for: text))
    }

    /// The first match replaced.
    private func replaceFirst(_ s: String, _ pattern: String, with text: String) -> String {
        let ns = s as NSString
        guard let re = patterns[pattern],
              let m = re.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return s }
        return ns.replacingCharacters(in: m.range, with: text)
    }

    /// The groups of a whole match, or nil.
    private func groups(_ s: String, _ pattern: String) -> [String]? {
        let ns = s as NSString
        guard let re = patterns[pattern],
              let m = re.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (1..<m.numberOfRanges).map { m.range(at: $0).location == NSNotFound ? "" : ns.substring(with: m.range(at: $0)) }
    }

    // MARK: - Brands

    /// The brand an account or payment shows: the one picked, else one whose
    /// name is in its name as whole words ("Claude Pro" is Claude; "Maxwell"
    /// is not Max), and for a car its model ("CX-5" is Mazda) (Mark.tsx's `brandOf`).
    func brandOf(institution: String?, name: String?, kind: String? = nil) -> String? {
        if let institution, !institution.isEmpty { return institution }
        // Something else and collectibles pick no brand (a ring is no doorbell).
        if kind == "other" || kind == "collectible" { return nil }
        let w = Self.words(name ?? "")
        let b = brandWords.first { w.contains($0.words) && (!loose.contains($0.key) || alone(w, $0.words)) }?.key
        if b != nil || kind != "car" { return b }
        let found = models.enumerated()
            .filter { w.contains(" " + $0.element.model + " ") }
            .sorted { a, b in
                let (x, y) = (a.element.model.utf16.count, b.element.model.utf16.count)
                return x != y ? x > y : a.offset < b.offset
            }
            .first?.element
        guard let found, brandsByKey[found.make] != nil else { return nil }
        return found.make
    }

    /// A brand whose name is an everyday word counts only when the name is
    /// it alone, or it and a word for what's paid ("Steam subscription").
    private func alone(_ w: String, _ n: String) -> Bool {
        guard w.hasPrefix(n) else { return false }
        let rest = String(w.utf8.dropFirst(n.utf8.count)) ?? ""
        return rest.split(separator: " ").allSatisfy { tails.contains(String($0)) }
    }

    /// A payee's brand: the one picked ("none" picked: none, whatever its name
    /// says), else the one in its name as a bank writes it, else in its name as it is.
    func payeeBrand(institution: String?, payee: String?) -> String? {
        if institution == "none" { return nil }
        return brandOf(institution: institution, name: cleanPayee(payee)) ?? brandOf(institution: nil, name: payee)
    }

    // MARK: - Marks

    /// A payee's own mark: the first letters of its first two words, or one
    /// letter for one word, and one of the auto colours its name picks, the
    /// same each time (Mark.tsx's `autoMark`).
    func autoMark(_ name: String) -> (letters: String, auto: Int) {
        let clean = cleanPayee(name)
        let stop: Set<String> = ["the", "a", "an", "of", "and"]
        let w = clean.filter { $0 != "'" && $0 != "\u{2019}" }
            .split(whereSeparator: { ch in !ch.unicodeScalars.allSatisfy(Self.isAlnum) })
            .map(String.init)
            .filter { !$0.isEmpty && !stop.contains($0.lowercased()) }
        let letters: String
        if w.count > 1 {
            letters = (String(w[0].prefix(1)) + String(w[1].prefix(1))).uppercased()
        } else {
            let from = w.first ?? name.trimmingCharacters(in: .whitespacesAndNewlines)
            letters = (from.unicodeScalars.first.map { String($0) } ?? "?").uppercased()
        }
        var h: UInt32 = 0
        for u in clean.lowercased().unicodeScalars {
            h = h &* 31 &+ UInt32(String(u).utf16.first ?? 0)
        }
        let count = UInt32(max(autoColours.count, 1))
        return (letters, Int(h % count))
    }

    /// The icon a payment's name points to ("Water and sewer" is a drop), or
    /// none; accounts whose kind says it all keep their own (Mark.tsx's `hintOf`).
    func hintOf(kind: String?, name: String?) -> String? {
        guard let name, !name.isEmpty else { return nil }
        if let kind, plainKinds.contains(kind) { return nil }
        let w = Self.words(name)
        return hints.first { hint in hint.words.contains { word in w.contains(" " + word + " ") } }?.glyph
    }

    /// What stands before an account or payment (Mark.tsx's `Mark`, without
    /// the household's own pictures): its brand, else its own initials when
    /// `auto`, else an icon for its type, its name, or its kind, else its first letter.
    func mark(brand: String?, kind: String?, name: String, type: String? = nil, auto: Bool = false, hue: Int? = nil) -> LogoContent {
        let hue = (hue ?? 0) > 0 ? hue : nil
        if let brand, let b = brandsByKey[brand] { return .brand(b) }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if auto && !trimmed.isEmpty {
            let a = autoMark(name)
            return .initials(a.letters, auto: a.auto)
        }
        let typed = type.flatMap { $0 != "other" && glyphs.contains($0) ? $0 : nil }
        if let glyph = typed ?? hintOf(kind: kind, name: name) ?? kind, glyphs.contains(glyph) {
            return .icon(glyph, hue: hue)
        }
        return .letter(trimmed.first.map { String($0).uppercased() } ?? "?", hue: hue)
    }

    // MARK: - Category colours

    /// A category's colour, 1 to 8: its own as a top category, or its
    /// group's; 0 for none known (hues.ts's `categoryHue`).
    func categoryHue(_ name: String?, in categories: [FinanceCategory]) -> Int {
        guard let name, !name.isEmpty else { return 0 }
        let c = categories.first { $0.name.lowercased() == name.lowercased() }
        let top = [c?.parent, c?.name].compactMap { $0 }.first { !$0.isEmpty } ?? name
        let tops = categories.filter { ($0.parent ?? "").isEmpty && !($0.income ?? false) }
        guard let at = tops.firstIndex(where: { $0.name.lowercased() == top.lowercased() }) else { return 0 }
        return at % max(categoryLight.count, 1) + 1
    }

    /// A payment kind's colour: its category's, else its own (hues.ts's `kindHueOf`).
    func kindHueOf(_ kind: String?, in categories: [FinanceCategory]) -> Int {
        let k = kind.flatMap { $0.isEmpty ? nil : $0 } ?? "other"
        let byCategory = categoryHue(kindCategory[k], in: categories)
        if byCategory > 0 { return byCategory }
        return kindHue[k] ?? 6
    }

    /// A category's own icon, or its group's (Transactions.tsx's `iconOf`).
    static func iconOf(_ name: String?, in categories: [FinanceCategory]) -> String? {
        guard let name else { return nil }
        guard let c = categories.first(where: { $0.name.lowercased() == name.lowercased() }) else { return nil }
        if let icon = c.icon, !icon.isEmpty { return icon }
        if let parent = c.parent, !parent.isEmpty, parent.lowercased() != name.lowercased() { return iconOf(parent, in: categories) }
        return nil
    }

    /// A transaction's mark: its payee's logo, a transfer's arrows, its
    /// category's icon, else its payee's own initials; a payee whose logo
    /// was set to None keeps the letter (Transactions.tsx's `TxMark`).
    func mark(for t: FinanceTransaction, categories: [FinanceCategory]) -> LogoContent {
        let transfer = t.to != nil
        let brand = transfer ? nil : payeeBrand(institution: t.institution, payee: t.payee)
        let category = t.isSplit ? t.splitCategory : t.category
        let icon = transfer ? "savings" : Self.iconOf(category, in: categories)
        let payee = t.payee.trimmingCharacters(in: .whitespacesAndNewlines)
        return mark(brand: brand, kind: brand == nil ? icon : nil, name: t.payee.isEmpty ? "?" : t.payee,
                    type: brand == nil ? icon : nil,
                    auto: !transfer && icon == nil && t.institution != "none" && !payee.isEmpty,
                    hue: transfer ? nil : categoryHue(category, in: categories))
    }

    /// Two payees for the same: the same words, or a word of three letters or
    /// more of one in the other ("Trader Joe's" and "TRADER JOE'S STORE 552")
    /// (importData.ts's `alike`).
    static func alike(_ a: String, _ b: String) -> Bool {
        if a.lowercased() == b.lowercased() { return true }
        let y = Set(named(b))
        return named(a).contains { y.contains($0) }
    }

    private static func named(_ s: String) -> [String] {
        let stop: Set<String> = ["the", "and", "inc", "llc", "payment", "purchase", "card", "debit", "pos"]
        var t = ""
        for u in s.lowercased().unicodeScalars {
            if (0x61...0x7A).contains(u.value) || CharacterSet.whitespacesAndNewlines.contains(u) {
                t.unicodeScalars.append(u)
            } else {
                t.append(" ")
            }
        }
        return t.unicodeScalars.split(whereSeparator: { CharacterSet.whitespacesAndNewlines.contains($0) })
            .map { String(String.UnicodeScalarView($0)) }
            .filter { $0.utf16.count >= 3 && !stop.contains($0) }
    }

    /// The type a subscription to a brand mostly is (streaming, cloud…), if known.
    func subscriptionType(ofBrand key: String) -> String? { brandTypes[key] }

    /// The kind of payment a brand mostly is (utilities, spending…), if known.
    func paymentKind(ofBrand key: String) -> String? { brandKinds[key] }

    // MARK: - Icons

    /// The SF Symbol for each of Mark.tsx's glyphs, drawn as near to the
    /// computer's own as the system's symbols go.
    static let symbols: [String: String] = [
        "checking": "building.columns", "savings": "banknote", "card": "creditcard", "cards": "creditcard",
        "investment": "chart.line.uptrend.xyaxis", "retirement": "hourglass", "loan": "arrow.uturn.backward",
        "loans": "graduationcap", "home": "house", "car": "car", "utilities": "bolt",
        "subscriptions": "arrow.triangle.2.circlepath", "spending": "cart", "collectible": "diamond",
        "other": "shippingbox", "clock": "clock", "streaming": "tv", "music": "music.note",
        "gaming": "gamecontroller", "news": "newspaper", "fitness": "dumbbell", "cloud": "cloud",
        "software": "laptopcomputer", "food": "fork.knife", "phone": "iphone", "internet": "wifi",
        "water": "drop", "heat": "flame", "insurance": "shield", "trash": "trash", "health": "heart",
        "school": "book", "minus": "minus",
    ]

    /// "#rrggbb" as 0xRRGGBB, or nil.
    static func rgb(_ hex: String) -> UInt32? {
        guard hex.count == 7, hex.hasPrefix("#") else { return nil }
        return UInt32(hex.dropFirst(), radix: 16)
    }
}
