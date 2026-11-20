import Foundation
import Testing
@testable import HomelabClient

/// An app's page › Who Uses It (`AppPeople`): names only, no section for an
/// app people don't sign in to (ContractTests checks the computer answers it).
@Suite("Who uses it")
struct AppPeopleTests {
    @Test func namesAndInitials() throws {
        let read = try JSONDecoder().decode(AppPeople.self, from: Data(#"{"household":true,"people":[{"name":"Alex Doe"},{"name":"  sam"},{"name":""}]}"#.utf8))
        #expect(read.household)
        #expect(read.people.map(\.name) == ["Alex Doe", "  sam"])
        #expect(read.people.map(\.initial) == ["A", "S"])
    }

    @Test func noSectionForAnAppPeopleDontSignInTo() throws {
        let read = try JSONDecoder().decode(AppPeople.self, from: Data(#"{"household":false,"people":[]}"#.utf8))
        #expect(!read.household && read.people.isEmpty)
        // A computer that sends nothing at all: no section either.
        let none = try JSONDecoder().decode(AppPeople.self, from: Data("{}".utf8))
        #expect(!none.household)
    }
}
