import Foundation

// MARK: - The Settings form (`Settings` and `SaveSettings`, main #491)

/// One `.env` setting as the computer lists it (`settings.Setting`): a
/// secret says only whether it is set, never its value.
struct HomelabSetting: Decodable, Sendable, Equatable, Identifiable {
    let key: String
    let section: String
    let help: String
    let secret: Bool
    let set: Bool
    /// Never sent for a secret.
    let value: String

    var id: String { key }

    enum CodingKeys: String, CodingKey { case key, section, help, secret, set, value }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = try c.decode(String.self, forKey: .key)
        section = try c.decodeIfPresent(String.self, forKey: .section) ?? "General"
        help = try c.decodeIfPresent(String.self, forKey: .help) ?? ""
        secret = try c.decodeIfPresent(Bool.self, forKey: .secret) ?? true
        set = try c.decodeIfPresent(Bool.self, forKey: .set) ?? false
        // A secret's value is never shown, whatever was sent.
        value = secret ? "" : (try c.decodeIfPresent(String.self, forKey: .value) ?? "")
    }

    /// A `.env` key's shape (`settings.keyRe`): only such keys are sent.
    static func isValidKey(_ key: String) -> Bool {
        guard (1...100).contains(key.utf8.count), let first = key.utf8.first,
              first == UInt8(ascii: "_") || (UInt8(ascii: "A")...UInt8(ascii: "Z")).contains(first)
                || (UInt8(ascii: "a")...UInt8(ascii: "z")).contains(first)
        else { return false }
        return key.utf8.allSatisfy { byte in
            byte == UInt8(ascii: "_") || (UInt8(ascii: "A")...UInt8(ascii: "Z")).contains(byte)
                || (UInt8(ascii: "a")...UInt8(ascii: "z")).contains(byte) || (UInt8(ascii: "0")...UInt8(ascii: "9")).contains(byte)
        }
    }

    /// On or off, as the computer draws it: a switch for true or false.
    var isToggle: Bool { !secret && ["true", "false"].contains(value.lowercased()) }
}

/// The form as a phone gets it: the settings, and the keys a phone may
/// not change (every secret, and the settings it connects through).
struct HomelabSettingsForm: Decodable, Sendable, Equatable {
    let settings: [HomelabSetting]
    let computerOnly: Set<String>

    enum CodingKeys: String, CodingKey { case settings, computerOnly }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        settings = Array((try c.decodeIfPresent([HomelabSetting].self, forKey: .settings) ?? []).prefix(2000))
        computerOnly = Set(try c.decodeIfPresent([String].self, forKey: .computerOnly) ?? [])
    }

    /// Whether this phone may change it (when it may make changes at all).
    func phoneMayChange(_ setting: HomelabSetting) -> Bool {
        !setting.secret && !computerOnly.contains(setting.key)
    }

    /// The sections in the computer's order, each with its settings.
    var sections: [SettingGroup] { SettingGroup.grouping(settings) }
}

/// A section of the form with its settings, in the computer's order.
struct SettingGroup: Identifiable, Equatable, Sendable {
    let name: String
    let settings: [HomelabSetting]

    var id: String { name }

    static func grouping(_ settings: [HomelabSetting]) -> [SettingGroup] {
        var order: [String] = []
        var bySection: [String: [HomelabSetting]] = [:]
        for setting in settings {
            if bySection[setting.section] == nil { order.append(setting.section) }
            bySection[setting.section, default: []].append(setting)
        }
        return order.map { SettingGroup(name: $0, settings: bySection[$0] ?? []) }
    }
}

/// The words the computer's Settings screen uses (web/src/screens/settings.ts):
/// a setting's name for people, its help without commands, and which are
/// the everyday ones.
enum SettingWords {
    /// A section's name, as the computer's screen titles it.
    static func section(_ name: String) -> String {
        name == "This Mac" ? "This Machine" : name
    }

    /// The settings people change, shown before the rest.
    static let everyday: Set<String> = [
        "TZ", "HOMELAB_DOMAIN", "MEDIA_ROOT", "DOWNLOADS_ROOT", "IMMICH_UPLOAD_LOCATION", "BACKUP_DESTINATION",
        "JELLYFIN_DATA_DIR", "SYNC_ROOT", "KEEP_AWAKE", "BATTERY_SAVER", "PHONE_COMPANION", "AUTO_DOMAIN", "CLOUDFLARE_API_TOKEN", "TUNNEL_TOKEN",
        "ADGUARD_USER", "ADGUARD_PASSWORD", "HELPER_EMAIL", "HEARTBEAT_URL", "DESKTOP_ALERTS", "QUIET_HOURS", "UPDATES_PAUSED", "AUTO_ROLLBACK", "AUTO_HEAL",
        "UPDATE_CHANNEL", "VAULTWARDEN_SIGNUPS_ALLOWED", "DUPLICATI_SECRETS_PASSPHRASE", "NTFY_PHONE_PASSWORD", "TAILSCALE_AUTHKEY",
        "PROTONVPN_WIREGUARD_PRIVATE_KEY", "PROTONVPN_SERVER_COUNTRIES", "QBITTORRENT_PASSWORD", "CROWDSEC_ENROLL_KEY",
        "ROMM_IGDB_CLIENT_ID", "ROMM_IGDB_CLIENT_SECRET", "ROMM_SCREENSCRAPER_USER", "ROMM_SCREENSCRAPER_PASSWORD",
    ]

    private static let labels: [String: String] = [
        "TZ": "Time zone", "PUID": "User ID", "PGID": "Group ID", "BIND_IP": "Apps listen on", "LAN_BIND_IP": "Proxy and DNS listen on",
        "KEEP_AWAKE": "Keep this machine awake", "BATTERY_SAVER": "Battery saver", "MEDIA_ROOT": "Media drive", "DOWNLOADS_ROOT": "Downloads folder",
        "IMMICH_UPLOAD_LOCATION": "Photos folder", "BACKUP_DESTINATION": "Backups go to", "JELLYFIN_DATA_DIR": "Jellyfin data folder",
        "SYNC_ROOT": "Syncthing folder", "HOMELAB_DOMAIN": "Domain (empty: addresses on your tailnet)", "HOMELAB_BASELINE": "Apps that always start (small or full)",
        "AUTO_DOMAIN": "Give new apps their addresses",
        "CLOUDFLARE_API_TOKEN": "Cloudflare API token", "TUNNEL_TOKEN": "Cloudflare Tunnel token", "DESKTOP_ALERTS": "Alerts on the computer's screen",
        "QUIET_HOURS": "Quiet hours (no sound at night)",
        "HELPER_EMAIL": "Your helper's email", "HEARTBEAT_URL": "Heartbeat ping URL", "UPDATES_PAUSED": "Pause nightly updates",
        "VAULTWARDEN_SIGNUPS_ALLOWED": "Vaultwarden sign-ups open", "TAILSCALE_AUTHKEY": "Tailscale auth key (optional)",
        "TAILSCALE_HOST": "This machine on the tailnet", "TAILNET_ADMIN_APPS": "Admin apps on the tailnet",
        "PROTONVPN_WIREGUARD_PRIVATE_KEY": "ProtonVPN WireGuard key", "PROTONVPN_SERVER_COUNTRIES": "ProtonVPN server countries",
        "ADGUARD_DNS_BIND_IP": "AdGuard Home DNS listens on", "HOST_GATEWAY": "Apps reach this machine's own apps at",
        "SSO_HOST": "Pocket ID address for the apps", "HOMEBOX_ALLOW_REGISTRATION": "Homebox sign-ups open",
        "AUTO_ROLLBACK": "Undo an update that breaks an app", "AUTO_HEAL": "Restart an app that stops answering", "UPDATE_CHANNEL": "Homelab update channel",
        "WATCHTOWER_SCHEDULE": "When apps update", "SPEEDTEST_SCHEDULE": "When the speed test runs", "OLLAMA_MODEL": "Model that explains logs",
        "UPDATES_HELD": "Apps with updates held",
        "JELLYFIN_API_KEY": "Jellyfin API key", "JELLYFIN_PORT": "Jellyfin port",
        "NTFY_PUBLISH_AUTH": "ntfy publish token, as a link", "NTFY_READ_TOKEN": "ntfy read-only token",
        "MONEYMATTER_FRONTEND_IMAGE": "MoneyMatter frontend image",
    ]
    private static let upper: Set<String> = ["API", "URL", "DNS", "IP", "HTTP", "HTTPS", "ID", "PDF", "AI", "IGDB", "SSL", "UI", "OCR", "JWT", "SSO", "VPN"]
    private static let wordLabels: [String: String] = [
        "DB": "database", "NEXTAUTH": "NextAuth", "MEILI": "Meilisearch", "SCREENSCRAPER": "ScreenScraper", "NPM": "Nginx Proxy Manager",
    ]

    /// "OPEN_WEBUI_PORT" from "Open WebUI": upper case, words joined by "_", and a trailing "_".
    static func envPrefix(_ text: String) -> String {
        var out = ""
        var gap = false
        for scalar in text.uppercased().unicodeScalars {
            if ("A"..."Z").contains(scalar) || ("0"..."9").contains(scalar) {
                out.unicodeScalars.append(scalar)
                gap = false
            } else if !gap {
                out += "_"
                gap = true
            }
        }
        return out + "_"
    }

    /// The app a key starts with, in the app's own spelling, by its id, its
    /// name, or the first word of both; a main app before a helper.
    static func keyApp(_ key: String, apps: [CatalogEntry]) -> (name: String, rest: String)? {
        var best: (name: String, rest: String)?
        var score = 0
        for app in apps {
            let first = envPrefix(String(app.id.split(separator: "-").first ?? ""))
            var prefixes = [envPrefix(app.id), envPrefix(app.name)]
            if app.kind != "helper", envPrefix(app.name).hasPrefix(first) { prefixes.append(first) }
            for prefix in prefixes where key.hasPrefix(prefix) {
                let points = prefix.count * 2 + (app.kind == "helper" ? 0 : 1)
                if points > score {
                    best = (name: app.name, rest: String(key.dropFirst(prefix.count)))
                    score = points
                }
            }
        }
        return best
    }

    /// A setting's name for people; the `.env` key stays beside it.
    static func label(_ key: String, apps: [CatalogEntry]) -> String {
        if let fixed = labels[key] { return fixed }
        let app = keyApp(key, apps: apps)
        let words = (app?.rest ?? key).split(separator: "_").map { word -> String in
            let w = String(word)
            return wordLabels[w] ?? (upper.contains(w) ? w : w.lowercased())
        }
        if let app { return ([app.name] + words).joined(separator: " ") }
        let text = words.joined(separator: " ")
        return text.prefix(1).uppercased() + text.dropFirst()
    }

    /// Help without the commands it names ("(./homelab domain setup)"), and
    /// for a switch, without the sentences saying what true and false do.
    static func plainHelp(_ help: String, toggle: Bool) -> String {
        let commands = try? NSRegularExpression(pattern: #"\s*\((?:\./)?homelab [^)]*\)"#)
        let words = commands?.stringByReplacingMatches(
            in: help, range: NSRange(help.startIndex..., in: help), withTemplate: ""
        ) ?? help
        guard toggle else { return words }
        // Sentences end at a full stop followed by a space, as the computer splits them.
        var sentences: [String] = []
        var current = ""
        var index = words.startIndex
        while index < words.endIndex {
            let character = words[index]
            current.append(character)
            let next = words.index(after: index)
            if character == ".", next < words.endIndex, words[next].isWhitespace {
                sentences.append(current)
                current = ""
            }
            index = next
        }
        sentences.append(current)
        return sentences
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { sentence in
                let first = sentence.prefix { $0.isLetter }.lowercased()
                return !sentence.isEmpty && first != "true" && first != "false"
            }
            .joined(separator: " ")
    }
}
