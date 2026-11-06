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

    /// Apps that do much the same job as `id`, each with why one might keep
    /// one or both (main #438). A pair is written on one side (`sameJob`) and
    /// said on both, as `sameJob` in web/src/choose/Choose.tsx.
    func sameJob(as id: String, among ids: Set<String>) -> [SameJob] {
        let mine = entry(id)?.sameJob ?? [:]
        return apps.compactMap { other in
            guard other.id != id, ids.contains(other.id) else { return nil }
            guard let why = mine[other.id] ?? other.sameJob[id], !why.isEmpty else { return nil }
            return SameJob(id: other.id, name: other.name, why: why)
        }
    }

    /// Another app that does much the same job, and why one might keep one or both.
    struct SameJob: Identifiable, Equatable, Sendable {
        let id: String
        let name: String
        let why: String
    }
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
    /// Apps that do much the same job, by id, each with why you might keep
    /// one or both. Written on one side of a pair only.
    let sameJob: [String: String]

    enum CodingKeys: String, CodingKey {
        case id, name, category, description, kind, warning, phone, replaces, sameJob
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
        // A field the phone only shows: one that doesn't read costs nothing else.
        sameJob = ((try? c.decodeIfPresent([String: String].self, forKey: .sameJob)) ?? nil) ?? [:]
    }
}
