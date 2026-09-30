import Foundation

/// Native copy for this separately compiled Watch target. Provider and user
/// names remain untouched; complete English/German tables ship in the bundle.
enum WatchCopy {
    static func text(_ key: String, _ arguments: CVarArg...) -> String {
        let format = NSLocalizedString(key, bundle: .main, comment: "")
        return String(format: format, locale: Locale.current, arguments: arguments)
    }
}
