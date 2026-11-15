import CoreTransferable
import Foundation
import UniformTypeIdentifiers

/// One of Export's files, for the share sheet: written under its own name
/// in a fresh folder of the app's temporary files as it's shared.
struct ExportFile: Transferable, Sendable, Identifiable {
    let title: String
    let name: String
    let data: Data
    /// A page to print (`data` is its HTML): on the iPhone and iPad it goes as a PDF of the page.
    var printable = false
    var id: String { name }

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .data) { file in
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            var data = file.data, name = file.name
            #if os(iOS)
            if file.printable, let pdf = await PrintedPage.pdf(String(decoding: file.data, as: UTF8.self)) {
                data = pdf
                name = (name as NSString).deletingPathExtension + ".pdf"
            }
            #endif
            let url = folder.appendingPathComponent(name)
            try data.write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }
}
