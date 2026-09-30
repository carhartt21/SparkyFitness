import Foundation
import UIKit

/// Food pictures for the Add food page, as small JPEGs the phone transfers.
///
/// The Watch cannot reach the server, so the phone fetches each image with
/// its own sign-in, shrinks it and sends it as a file named by the food's
/// `thumbnailKey`. The key changes when the picture does, so a cached file is
/// never stale: a key either has its file or is asked for again.
@MainActor
final class FoodThumbnailStore: ObservableObject {
    static let shared = FoodThumbnailStore()

    /// Bumped when a file arrives or is pruned, so rows redraw.
    @Published private(set) var revision = 0

    private var cache: [String: UIImage] = [:]
    /// Keys asked for this session, so a missing picture is requested once
    /// per launch rather than on every context push.
    private var requested: Set<String> = []

    private nonisolated static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("food-thumbnails", isDirectory: true)
    }

    /// Keys are 8 hex characters from the phone; anything else is refused so
    /// a key can never name a path outside the directory.
    nonisolated static func isValidKey(_ key: String) -> Bool {
        key.count == 8 && key.allSatisfy(\.isHexDigit)
    }

    private nonisolated static func fileURL(for key: String) -> URL {
        directory.appendingPathComponent("\(key).jpg")
    }

    func image(for key: String?) -> UIImage? {
        guard let key, Self.isValidKey(key) else { return nil }
        if let cached = cache[key] { return cached }
        guard let image = UIImage(contentsOfFile: Self.fileURL(for: key).path) else { return nil }
        cache[key] = image
        return image
    }

    /// Keys among `keys` with no file yet and not already asked for; marks
    /// them as asked.
    func takeMissing(_ keys: [String]) -> [String] {
        let missing = Set(keys.filter(Self.isValidKey)).filter { key in
            !requested.contains(key)
                && !FileManager.default.fileExists(atPath: Self.fileURL(for: key).path)
        }
        requested.formUnion(missing)
        return missing.sorted()
    }

    /// Moves a received file into place. Must run before the delegate
    /// callback returns: WatchConnectivity deletes the file afterwards.
    nonisolated static func store(fileAt url: URL, key: String) -> Bool {
        guard isValidKey(key) else { return false }
        let manager = FileManager.default
        do {
            try manager.createDirectory(at: directory, withIntermediateDirectories: true)
            let destination = fileURL(for: key)
            if manager.fileExists(atPath: destination.path) {
                try manager.removeItem(at: destination)
            }
            try manager.moveItem(at: url, to: destination)
            return true
        } catch {
            return false
        }
    }

    func didStore(key: String) {
        cache[key] = nil
        revision += 1
    }

    /// Deletes pictures of foods no longer offered, so the folder stays at
    /// most one file per shortcut.
    func prune(keeping keys: [String]) {
        let keep = Set(keys)
        let manager = FileManager.default
        guard let files = try? manager.contentsOfDirectory(
            at: Self.directory, includingPropertiesForKeys: nil
        ) else { return }
        var removed = false
        for file in files where !keep.contains(file.deletingPathExtension().lastPathComponent) {
            try? manager.removeItem(at: file)
            cache[file.deletingPathExtension().lastPathComponent] = nil
            removed = true
        }
        if removed { revision += 1 }
    }
}
