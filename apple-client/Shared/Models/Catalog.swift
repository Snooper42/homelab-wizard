import Foundation

/// The app catalog (`api.Catalog`, the `Catalog` call), the parts the
/// phone shows on an app's page. Presets and inputs are for installing on
/// the computer, and Codable ignores them.
struct AppCatalog: Decodable, Sendable, Equatable {
    let categories: [CatalogCategory]
    let apps: [CatalogEntry]

    enum CodingKeys: String, CodingKey { case categories, apps }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        categories = try c.decodeIfPresent([CatalogCategory].self, forKey: .categories) ?? []
        apps = try c.decodeIfPresent([CatalogEntry].self, forKey: .apps) ?? []
    }

    func entry(_ id: String) -> CatalogEntry? { apps.first { $0.id == id } }
    func categoryLabel(_ id: String) -> String? { categories.first { $0.id == id }?.label }
}

struct CatalogCategory: Decodable, Sendable, Equatable {
    let id: String
    let label: String
}

struct CatalogEntry: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let category: String
    let description: String
    /// baseline, optional, native, or helper.
    let kind: String
    /// Reachable from the internet through the tunnel, not only at home.
    let isPublic: Bool
    let warning: String?
    /// The phone app people use it with.
    let phone: String?
    /// The subscriptions it stands in for.
    let replaces: [String]

    enum CodingKeys: String, CodingKey {
        case id, name, category, description, kind, warning, phone, replaces
        case isPublic = "public"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? id
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? ""
        isPublic = try c.decodeIfPresent(Bool.self, forKey: .isPublic) ?? false
        warning = try c.decodeIfPresent(String.self, forKey: .warning)
        phone = try c.decodeIfPresent(String.self, forKey: .phone)
        replaces = (try c.decodeIfPresent([String].self, forKey: .replaces) ?? []).filter { !$0.isEmpty }
    }
}
