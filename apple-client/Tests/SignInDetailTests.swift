import Foundation
import Testing
@testable import HomelabClient

/// An app's Sign-in details on the phone (`SignInDetails`): labels only, in
/// the computer's sections, and the row's words.
@Suite("Sign-in details")
struct SignInDetailTests {
    static let rows = try! JSONDecoder().decode([SignInDetail].self, from: Data(#"""
    [{"app":"duplicati","key":"DUPLICATI_PASSPHRASE","label":"Duplicati: backup passphrase","section":"keep-safe","saved":false},
     {"app":"duplicati","key":"DUPLICATI_PASSWORD","label":"Duplicati: password","section":"sign-in","saved":true},
     {"app":"duplicati","key":"app:duplicati","label":"Duplicati: its API key","section":"paste"},
     {"app":"duplicati","key":"ODD","label":"Odd","section":"something-new"}]
    """#.utf8))

    @Test func sectionsInTheComputersOrder() {
        let parts = SignInDetail.sections(Self.rows)
        #expect(parts.map(\.section) == [.signIn, .paste, .keepSafe])
        #expect(parts.map(\.section.title) == ["Sign In", "Paste Into Another App", "Keep Safe"])
        // A section this app doesn't know is shown as one to paste.
        #expect(parts[1].rows.map(\.key) == ["app:duplicati", "ODD"])
    }

    @Test func wordsUnderTheAppsName() {
        #expect(Self.rows.map(\.what) == ["Backup passphrase", "Password", "API key", "Odd"])
        #expect(Self.rows[2].saved == false)
    }

    @Test func theFooterCountsWhatsNotSaved() {
        #expect(signInFooter(Self.rows) == "Its 4 passwords and keys, to copy into your password manager: 3 not saved yet.")
        #expect(signInFooter([Self.rows[1]]) == "Its password or key, all saved in your password manager.")
    }

    @Test func aSecretGoesForNinetySeconds() {
        #expect(Clipboard.secretLifetime == 90)
    }
}
