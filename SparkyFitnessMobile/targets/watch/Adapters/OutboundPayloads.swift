import Foundation

/// Turns domain values into the dictionaries WatchConnectivity carries to the
/// phone.
///
/// These `payload` builders used to be computed properties on `CheckIn`,
/// `WaterTap` and `WaterDeleteRequest` themselves, which meant the domain
/// types knew their own wire format — a check-in had an opinion about the
/// string `"weightKg"`. Moving them here leaves those types as plain values
/// and puts every outbound key in one place, next to the `type` strings the
/// phone's router switches on.
///
/// The counterpart for the other direction is `ContextPayloadMapper`.
enum OutboundPayloads {

    /// Message types, matched by the phone's native module router
    /// (`WatchConnectivityModule.route`). Renaming one here without renaming
    /// it there means the phone silently ignores the message.
    private enum Kind {
        static let checkIn = "checkIn"
        static let waterIntake = "waterIntake"
        static let manualWater = "manualWater"
        static let waterDelete = "waterDelete"
        static let contextRequest = "requestContext"
        static let workoutSetOperation = "workoutSetOperation"
        static let foodLog = "foodLog"
    }

    /// A morning check-in awaiting a server write.
    ///
    /// `bodyFatPercentage` is OMITTED rather than sent as null when the wearer
    /// skipped it: the server upserts by date, so a null would erase whatever
    /// body-fat value the day already had instead of leaving it alone.
    static func checkIn(_ checkIn: CheckIn) -> [String: Any] {
        var payload: [String: Any] = [
            "type": Kind.checkIn,
            "clientId": checkIn.id,
            "entryDate": checkIn.entryDate,
            "weightKg": checkIn.weightKg,
            "scope": checkIn.scope ?? "",
        ]
        if let bodyFat = checkIn.bodyFatPercentage {
            payload["bodyFatPercentage"] = bodyFat
        }
        return payload
    }

    /// One tap on a container square — the phone turns this into one serving
    /// of `containerId`, the same amount its own +/- button would add.
    static func waterTap(_ tap: WaterTap) -> [String: Any] {
        [
            "type": Kind.waterIntake,
            "clientId": tap.id,
            "entryDate": tap.entryDate,
            "containerId": tap.containerId,
            "loggedAt": ISO8601DateFormatter().string(from: tap.loggedAt),
            "scope": tap.scope,
        ]
    }

    /// A standalone 250 ml action. Retries retain all fields, especially id.
    static func manualWater(_ action: PendingQuickWaterAction) -> [String: Any] {
        [
            "type": Kind.manualWater,
            "clientId": action.id,
            "entryDate": action.entryDate,
            "loggedAt": ISO8601DateFormatter().string(from: action.loggedAt),
            "waterMl": 250,
            "scope": action.scope,
        ]
    }

    /// A request to delete one logged drink by its server row id.
    static func waterDelete(_ request: WaterDeleteRequest) -> [String: Any] {
        [
            "type": Kind.waterDelete,
            "clientId": request.id,
            "entryId": request.entryId,
            "scope": request.scope,
        ]
    }

    static func workoutSetOperation(_ operation: WorkoutSetOperation) -> [String: Any] {
        [
            "type": Kind.workoutSetOperation,
            "clientId": operation.id,
            "sessionId": operation.sessionId,
            "setKey": operation.setKey,
            "setSignature": operation.setSignature,
            "expectedCompleted": operation.expectedCompleted,
            "completed": operation.completed,
            "scope": operation.scope ?? "",
        ]
    }

    static func foodLog(_ action: PendingFoodLogAction) -> [String: Any] {
        [
            "type": Kind.foodLog,
            "clientId": action.id,
            "scope": action.scope,
            "entryDate": action.entryDate,
            "loggedAt": ISO8601DateFormatter().string(from: action.loggedAt),
            "foodId": action.foodId,
            "variantId": action.variantId,
            "mealTypeId": action.mealTypeId,
            "quantity": action.quantity,
            "unit": action.unit,
        ]
    }

    /// Asks the phone to push a fresh context. Carries no data of its own.
    static let contextRequest: [String: Any] = ["type": Kind.contextRequest]
}
