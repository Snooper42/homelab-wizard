import Foundation
import Testing
#if canImport(AppKit)
import AppKit
#endif
@testable import HomelabClient

// The payee logos: the bundled copy of the computer's brands reads and draws,
// its colours keep their contrast, and the Swift port of the computer's
// matching answers as the computer's own functions do. Resources/
// PayeeVectors.json holds those answers, written by
// scripts/make-payee-logos.mjs from web/src/finances itself.

private struct Vectors: Decodable {
    struct Payee: Decodable { let raw: String; let clean: String; let brand: String? }
    struct BrandOf: Decodable { let name: String; let kind: String?; let brand: String? }
    struct Picked: Decodable { let institution: String; let payee: String; let brand: String? }
    struct Auto: Decodable { let name: String; let letters: String; let hue: Int }
    struct Hint: Decodable { let name: String; let kind: String?; let hint: String? }
    struct Alike: Decodable { let a: String; let b: String; let alike: Bool }
    struct CategoryHue: Decodable { let name: String; let hue: Int }
    struct KindHue: Decodable { let kind: String; let withCategories: Bool; let hue: Int }
    struct Note: Decodable { let note: String; let payee: String; let shown: String; let bank: Bool }

    let payees: [Payee]
    let brandOf: [BrandOf]
    let picked: [Picked]
    let autoMark: [Auto]
    let hints: [Hint]
    let alike: [Alike]
    let categories: [FinanceCategory]
    let categoryHue: [CategoryHue]
    let kindHue: [KindHue]
    let notes: [Note]

    static func load() throws -> Vectors {
        let url = try #require(Bundle.module.url(forResource: "PayeeVectors", withExtension: "json"))
        return try JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    }
}

/// Relative luminance of "#rrggbb" (WCAG).
private func luminance(_ hex: String) -> Double {
    let v = PayeeLogos.rgb(hex) ?? 0
    func channel(_ c: UInt32) -> Double {
        let x = Double(c) / 255
        return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel((v >> 16) & 0xFF) + 0.7152 * channel((v >> 8) & 0xFF) + 0.0722 * channel(v & 0xFF)
}

private func contrast(_ a: String, _ b: String) -> Double {
    let (x, y) = (luminance(a), luminance(b))
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)
}

/// The first few mismatches, in a line each, so a failure says what differs without thousands of lines.
private func report(_ misses: [String]) -> Comment {
    Comment(rawValue: "\(misses.count) differ from the computer's:\n" + misses.prefix(25).joined(separator: "\n"))
}

@Suite("Payee logos")
struct PayeeLogoTests {
    let logos = PayeeLogos.shared

    @Test func theAppHasItsCopy() {
        #expect(logos.brands.count >= 300)
        #expect(logos.brandsByKey["chase"]?.name == "Chase")
        #expect(logos.categoryLight.count == 8 && logos.categoryDark.count == 8)
        #expect(logos.autoColours.count == 8)
    }

    @Test func everyMarkReadsAndFitsItsBox() {
        for b in logos.brands {
            #expect((b.path == nil) != (b.letters == nil), "\(b.key): a mark or letters, not both or neither")
            guard b.path != nil else { continue }
            let segments = logos.marks[b.key]
            #expect(segments != nil, "\(b.key): its mark doesn't read")
            // Every point the mark passes through is in its box; a curve's
            // control points, which only bend it, may reach a little past.
            for seg in segments ?? [] {
                let (on, control): ([Double], [Double]) = switch seg {
                case .move(let x, let y), .line(let x, let y): ([x, y], [])
                case .curve(let a, let b, let c, let d, let e, let f): ([e, f], [a, b, c, d])
                case .close: ([], [])
                }
                #expect(on.allSatisfy { $0 >= -0.01 && $0 <= 24.01 }, "\(b.key): drawn outside its 24 by 24 box")
                #expect(control.allSatisfy { $0 >= -8 && $0 <= 32 }, "\(b.key): a curve bent far outside its box")
            }
        }
    }

    @Test func pathsReadOnlyInTheirOwnForm() {
        #expect(LogoPath.segments("M0 0L24 24Z") == [.move(0, 0), .line(24, 24), .close])
        #expect(LogoPath.segments("M1 -2.5C0 0 1 1 2 2") == [.move(1, -2.5), .curve(0, 0, 1, 1, 2, 2)])
        #expect(LogoPath.segments("") == nil)
        #expect(LogoPath.segments("L1 1") == nil) // must start with a move
        #expect(LogoPath.segments("M0 0L1") == nil) // a number short
        #expect(LogoPath.segments("M0 0 1 1") == nil) // no implicit lines
        #expect(LogoPath.segments("M0 0A1 1 0 0 1 2 2") == nil) // arcs were made curves
        #expect(LogoPath.segments("M0 0L1 1<script>") == nil)
        #expect(LogoPath.segments("M0 0Lnan 1") == nil)
    }

    @Test func everyInkReadsOnItsColour() {
        for b in logos.brands {
            let ratio = contrast(b.ink, b.bg)
            #expect(ratio >= 4.5, "\(b.key): \(b.ink) on \(b.bg) is \(ratio)")
        }
        for (scheme, list) in [("light", logos.categoryLight), ("dark", logos.categoryDark)] {
            for (i, c) in list.enumerated() {
                let ratio = contrast(c.ink, c.soft)
                #expect(ratio >= 4.5, "category \(i + 1) in \(scheme): \(ratio)")
            }
        }
        for (i, c) in logos.autoColours.enumerated() {
            #expect(contrast("#ffffff", c) >= 4.5, "auto colour \(i)")
        }
    }

    @Test func everyGlyphHasASymbol() {
        for glyph in logos.glyphs {
            let name = PayeeLogos.symbols[glyph]
            #expect(name != nil, "\(glyph) has no SF Symbol")
            #if canImport(AppKit)
            if let name {
                #expect(NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil, "\(name) isn't an SF Symbol")
            }
            #endif
        }
    }

    // MARK: - The same answers as the computer's

    @Test func aBanksWordingAsAPersonWritesIt() throws {
        let v = try Vectors.load()
        #expect(v.payees.count > 1000)
        let misses = v.payees.compactMap { p -> String? in
            let got = logos.cleanPayee(p.raw)
            return got == p.clean ? nil : "\(p.raw.debugDescription): \(got.debugDescription), not \(p.clean.debugDescription)"
        }
        #expect(misses.isEmpty, report(misses))
    }

    // American Express's own wording, named outright as well as in the vectors:
    // AplPay, its processors, and the town padded, glued or a website.
    @Test func americanExpressWording() {
        let cases = [
            ("AplPay STARBUCKS SEATTLE WA", "Starbucks"),
            ("WWP*SUNNY DAYS SCHOOL 877-555-0100 FL", "Sunny Days School"),
            ("WL *STEAM PURCHASE   425-555-0100        WA", "Steam Purchase"),
            ("BLUE BOTTLE COFFEE  OAKLAND             CA", "Blue Bottle Coffee"),
            ("SQ  *BLUE BOTTLE  OAKLAND  CA", "Blue Bottle"),
            ("PET SUPERMARKET #100SUNRISE FL", "Pet Supermarket"),
            ("AMAZON.COM AMZN.COM/BILL WA", "Amazon"),
            ("POS DEBIT  SHELL OIL 57444 SAN JOSE CA", "Shell"),
        ]
        for (raw, want) in cases {
            #expect(logos.cleanPayee(raw) == want, "\(raw.debugDescription)")
        }
    }

    @Test func aPayeesBrand() throws {
        let v = try Vectors.load()
        var misses = v.payees.compactMap { p -> String? in
            let got = logos.payeeBrand(institution: nil, payee: p.raw)
            return got == p.brand ? nil : "\(p.raw.debugDescription): \(got ?? "none"), not \(p.brand ?? "none")"
        }
        misses += v.picked.compactMap { p in
            let got = logos.payeeBrand(institution: p.institution, payee: p.payee)
            return got == p.brand ? nil : "picked \(p.institution.debugDescription): \(got ?? "none"), not \(p.brand ?? "none")"
        }
        #expect(misses.isEmpty, report(misses))
    }

    @Test func aNamesBrandByKind() throws {
        let v = try Vectors.load()
        let misses = v.brandOf.compactMap { b -> String? in
            let got = logos.brandOf(institution: nil, name: b.name, kind: b.kind)
            return got == b.brand ? nil : "\(b.name.debugDescription) as \(b.kind ?? "nothing"): \(got ?? "none"), not \(b.brand ?? "none")"
        }
        #expect(misses.isEmpty, report(misses))
    }

    @Test func aPayeesOwnMark() throws {
        let v = try Vectors.load()
        let misses = v.autoMark.compactMap { a -> String? in
            let got = logos.autoMark(a.name)
            return got.letters == a.letters && got.auto == a.hue ? nil
                : "\(a.name.debugDescription): \(got.letters) \(got.auto), not \(a.letters) \(a.hue)"
        }
        #expect(misses.isEmpty, report(misses))
    }

    @Test func whatANamePointsTo() throws {
        let v = try Vectors.load()
        let misses = v.hints.compactMap { h -> String? in
            let got = logos.hintOf(kind: h.kind, name: h.name)
            return got == h.hint ? nil : "\(h.name.debugDescription) as \(h.kind ?? "nothing"): \(got ?? "none"), not \(h.hint ?? "none")"
        }
        #expect(misses.isEmpty, report(misses))
    }

    @Test func notesWithoutTheBanksWording() throws {
        let v = try Vectors.load()
        #expect(!v.notes.isEmpty)
        for n in v.notes {
            #expect(logos.bankWording(n.note) == n.bank, "bankWording \(n.note.debugDescription)")
            #expect(logos.shownNote(n.note, payee: n.payee) == n.shown, "shownNote \(n.note.debugDescription) for \(n.payee.debugDescription)")
        }
    }

    @Test func payeesForTheSame() throws {
        let v = try Vectors.load()
        for a in v.alike {
            #expect(PayeeLogos.alike(a.a, a.b) == a.alike, "\(a.a.debugDescription) and \(a.b.debugDescription)")
        }
    }

    @Test func categoryColours() throws {
        let v = try Vectors.load()
        for c in v.categoryHue {
            #expect(logos.categoryHue(c.name, in: v.categories) == c.hue, "\(c.name.debugDescription)")
        }
        for k in v.kindHue {
            #expect(logos.kindHueOf(k.kind, in: k.withCategories ? v.categories : []) == k.hue, "\(k.kind.debugDescription), categories: \(k.withCategories)")
        }
    }

    // MARK: - A transaction's mark

    private func transaction(_ json: String) throws -> FinanceTransaction {
        try JSONDecoder.homelab().decode(FinanceTransaction.self, from: Data(json.utf8))
    }

    private let categories: [FinanceCategory] = {
        let json = #"[{"name":"Food","icon":"food"},{"name":"Groceries","parent":"Food","icon":"spending"},{"name":"Eating out","parent":"Food"},{"name":"Travel"}]"#
        return (try? JSONDecoder().decode([FinanceCategory].self, from: Data(json.utf8))) ?? []
    }()

    @Test func aTransactionsMark() throws {
        let netflixBrand = try #require(logos.brandsByKey["netflix"])
        let chaseBrand = try #require(logos.brandsByKey["chase"])

        // A brand in the payee, as the bank wrote it.
        let netflix = try transaction(#"{"id":"1","account":"c","amount":-17.99,"payee":"NETFLIX.COM","category":"Travel"}"#)
        #expect(logos.mark(for: netflix, categories: categories) == .brand(netflixBrand))

        // No brand: its category's icon, in the category's colour.
        let groceries = try transaction(#"{"id":"2","account":"c","amount":-40,"payee":"Corner shop","category":"Groceries"}"#)
        #expect(logos.mark(for: groceries, categories: categories) == .icon("spending", hue: 1))

        // A category with no icon of its own takes its group's.
        let eating = try transaction(#"{"id":"3","account":"c","amount":-12,"payee":"Corner cafe","category":"Eating out"}"#)
        #expect(logos.mark(for: eating, categories: categories) == .icon("food", hue: 1))

        // No brand, no icon: the payee's own initials.
        let travel = try transaction(#"{"id":"4","account":"c","amount":-90,"payee":"Blue Lagoon Tours","category":"Travel"}"#)
        guard case .initials(let letters, _) = logos.mark(for: travel, categories: categories) else {
            Issue.record("not its initials")
            return
        }
        #expect(letters == "BL")

        // Its logo set to None by hand: the letter, never a brand or initials.
        let none = try transaction(#"{"id":"5","account":"c","amount":-17.99,"payee":"NETFLIX.COM","institution":"none","category":"Travel"}"#)
        #expect(logos.mark(for: none, categories: categories) == .letter("N", hue: 2))

        // A brand picked by hand wins over the name.
        let picked = try transaction(#"{"id":"6","account":"c","amount":-5,"payee":"Corner shop","institution":"chase"}"#)
        #expect(logos.mark(for: picked, categories: categories) == .brand(chaseBrand))

        // A transfer: money moved, no colour.
        let transfer = try transaction(#"{"id":"7","account":"c","amount":-500,"payee":"Netflix","to":"s"}"#)
        #expect(logos.mark(for: transfer, categories: categories) == .icon("savings", hue: nil))

        // Divided: the first part's category.
        let split = try transaction(#"{"id":"8","account":"c","amount":-60,"payee":"Corner shop","splits":[{"category":"Groceries","amount":-40},{"category":"Travel","amount":-20}]}"#)
        #expect(split.isSplit && split.splitCategory == "Groceries")
        #expect(logos.mark(for: split, categories: categories) == .icon("spending", hue: 1))
    }

    @Test func anAccountsAndAPaymentsMark() {
        #expect(logos.mark(brand: nil, kind: "checking", name: "Joint") == .icon("checking", hue: nil))
        #expect(logos.mark(brand: nil, kind: "utilities", name: "Water and sewer", hue: 3) == .icon("water", hue: 3))
        #expect(logos.mark(brand: nil, kind: "nothing-known", name: " zed") == .letter("Z", hue: nil))
        #expect(logos.mark(brand: nil, kind: nil, name: "   ") == .letter("?", hue: nil))
        #expect(logos.mark(brand: "no-such-brand", kind: nil, name: "Ok", hue: 0) == .letter("O", hue: nil))
    }
}
