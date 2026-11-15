import CoreTransferable
import Foundation
import UniformTypeIdentifiers

/// One of Export's files, for the share sheet: written under its own name
/// in a fresh folder of the app's temporary files as it's shared.
struct ExportFile: Transferable, Sendable, Identifiable {
    let title: String
    let name: String
    let data: Data
    var id: String { name }

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .data) { file in
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let url = folder.appendingPathComponent(file.name)
            try file.data.write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }
}
