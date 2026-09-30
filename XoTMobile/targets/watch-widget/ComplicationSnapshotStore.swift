import Foundation

/// A snapshot `ComplicationPublisher` (targets/watch) wrote for one account
/// and one calendar day.
protocol ScopedDaySnapshot: Decodable {
    var scope: String? { get }
    var date: String? { get }
}

/// Reads the snapshots the watch app publishes into the shared App Group
/// suite. This target can't import targets/watch's Swift files (each
/// `expo-target` is its own compiled module), so the key names and the date
/// format here mirror `ComplicationPublisher` and `CheckInDate` there.
enum ComplicationSnapshotStore {
    private static let scopeKey = "watchComplicationScope"

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func today() -> String {
        dayFormatter.string(from: Date())
    }

    /// The snapshot stored under `key`, or nil unless it belongs to the
    /// account currently on the watch and describes today. Yesterday's
    /// figures or another account's are never shown: an empty complication
    /// reads as "nothing yet", a stale one as a false claim about today.
    static func load<Snapshot: ScopedDaySnapshot>(
        _ type: Snapshot.Type,
        key: String
    ) -> Snapshot? {
        guard
            let appGroup = Bundle.main.object(forInfoDictionaryKey: "APP_GROUP_IDENTIFIER") as? String,
            !appGroup.isEmpty,
            let defaults = UserDefaults(suiteName: appGroup),
            let scope = defaults.string(forKey: scopeKey),
            !scope.isEmpty,
            let data = defaults.data(forKey: key),
            let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data),
            snapshot.scope == scope,
            snapshot.date == today()
        else { return nil }
        return snapshot
    }

    /// When a complication should next ask for a timeline: in 15 minutes, or
    /// at midnight when the day's figures reset, whichever comes first.
    static func nextRefresh(after now: Date = Date()) -> Date {
        let in15Minutes = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now
        let nextMidnight = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? in15Minutes
        return min(in15Minutes, nextMidnight)
    }
}
