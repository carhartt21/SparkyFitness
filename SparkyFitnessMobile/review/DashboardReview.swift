import XCTest

final class DashboardReview: XCTestCase {
  func testLaunchIconActions() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let actions = [
      ["Scan Food", "Barcode scannen"],
      ["Add Food", "Lebensmittel hinzufügen"],
      ["Log an activity", "Aktivität erfassen"],
      ["Measurements", "Messwerte"],
    ]
    for (index, labels) in actions.enumerated() {
      // Food tests a true cold launch; the other three resume a live process.
      if index == 1 {
        app.terminate()
      } else {
        XCUIDevice.shared.press(.home)
      }
      let icon = springboard.icons["X on Track"].firstMatch
      XCTAssertTrue(icon.waitForExistence(timeout: 10))
      // A second Home press after termination returns to page one; the app
      // icon may exist in the hierarchy but be offscreen on a later page.
      for _ in 0..<4 {
        if icon.isHittable { break }
        springboard.swipeLeft()
      }
      XCTAssertTrue(icon.isHittable)
      icon.press(forDuration: 1.5)
      let menuItem = springboard.buttons.matching(NSPredicate(format: "label IN %@", labels)).firstMatch
      XCTAssertTrue(menuItem.waitForExistence(timeout: 10), springboard.debugDescription)
      if index == 0 { capture("launch-icon-menu", springboard) }
      menuItem.tap()
      XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30))
      // A SpringBoard cold launch has no simctl launch arguments, so the
      // development client can show its first-run tutorial. Dismiss only that
      // known development chrome; never treat an obscured editor as a pass.
      let devContinue = app.buttons["Continue"]
      if devContinue.waitForExistence(timeout: index == 1 ? 10 : 1) {
        devContinue.tap()
        let devClose = app.buttons["xmark"].firstMatch
        XCTAssertTrue(devClose.waitForExistence(timeout: 5))
        devClose.tap()
      }
      // Capture the actual native destination, never a simulated deep link.
      switch index {
      case 0:
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Schließen", "Cancel", "Abbrechen"])).firstMatch.waitForExistence(timeout: 20))
      case 1:
        XCTAssertTrue(app.textFields.firstMatch.waitForExistence(timeout: 30))
        XCTAssertTrue(app.textFields.firstMatch.isHittable)
      case 2:
        let activityForm = app.otherElements.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "Edit activity name", "Bearbeiten activity Name")).firstMatch
        XCTAssertTrue(activityForm.waitForExistence(timeout: 20))
        XCTAssertTrue(activityForm.isHittable)
      default:
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label IN %@", ["Measurements", "Messwerte"])).firstMatch.waitForExistence(timeout: 20))
      }
      capture("launch-icon-destination-\(index)", app)
    }
  }
  func testDashboardScrollAndFoodNavigation() throws {
    try reviewDashboard(logFood: true)
  }
  func testDashboardAlignment() throws {
    try reviewDashboard(logFood: false)
  }
  private func reviewDashboard(logFood: Bool) throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let saved = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Saved summary")).firstMatch
    if saved.waitForExistence(timeout: 3) {
      app.buttons["Previous day"].tap()
      XCTAssertTrue(app.staticTexts["Server unavailable"].waitForExistence(timeout: 15))
      XCTAssertTrue(app.buttons["Choose dashboard date"].isHittable)
      XCTAssertTrue(app.buttons["X on Track — Dashboard"].isHittable)
      capture("offline-uncached-day-controls", app)
      app.buttons["Next day"].tap()
      XCTAssertTrue(saved.waitForExistence(timeout: 15))
      capture("offline-return-to-cached-day", app)
      return
    }
    let dashboard = app.otherElements["dashboard-scroll"].scrollViews.firstMatch
    XCTAssertTrue(dashboard.waitForExistence(timeout: 30))
    let date = app.buttons["dashboard-date"]
    let logo = app.buttons["dashboard-home"]
    XCTAssertTrue(date.isHittable)
    XCTAssertEqual(date.frame.midY, logo.frame.midY, accuracy: 2)
    for id in ["dashboard-home", "dashboard-date", "dashboard-previous-day", "dashboard-next-day", "dashboard-today"] {
      let control = app.buttons[id]
      XCTAssertTrue(control.isHittable)
      XCTAssertGreaterThanOrEqual(control.frame.width, 44)
      XCTAssertGreaterThanOrEqual(control.frame.height, 44)
    }
    let originalDate = date.value as? String
    XCTAssertNotNil(originalDate)
    app.buttons["dashboard-previous-day"].tap()
    XCTAssertNotEqual(date.value as? String, originalDate)
    app.buttons["dashboard-next-day"].tap()
    XCTAssertEqual(date.value as? String, originalDate)
    capture("dashboard-top", app)
    dashboard.swipeUp()
    capture("dashboard-middle", app)
    dashboard.swipeUp()
    capture("dashboard-lower", app)
    // A single food action must open the existing search destination.
    dashboard.swipeDown()
    dashboard.swipeDown()
    dashboard.swipeDown()
    let food = app.buttons["dashboard-food"]
    XCTAssertTrue(food.waitForExistence(timeout: 10))
    XCTAssertTrue(food.isHittable)
    XCTAssertGreaterThanOrEqual(food.frame.height, 44)
    XCTAssertGreaterThanOrEqual(food.frame.width, 44)
    for identifier in ["dashboard-food", "dashboard-exercise-running", "dashboard-water", "dashboard-scan"] {
      let action = app.buttons[identifier]
      XCTAssertTrue(action.isHittable)
      XCTAssertGreaterThanOrEqual(action.frame.height, 44)
      XCTAssertGreaterThanOrEqual(action.frame.width, 44)
    }
    app.buttons["dashboard-water"].tap()
    let hydrationDetails = app.buttons["dashboard-hydration-details"]
    for _ in 0..<4 {
      if hydrationDetails.exists && hydrationDetails.isHittable { break }
      dashboard.swipeUp()
    }
    XCTAssertTrue(hydrationDetails.isHittable)
    XCTAssertGreaterThanOrEqual(hydrationDetails.frame.height, 44)
    let updatedWater = app.staticTexts.matching(NSPredicate(format: "label IN %@", ["1,250 ml", "1.250 ml"])).firstMatch
    XCTAssertTrue(updatedWater.waitForExistence(timeout: 10))
    capture("dashboard-details-links", app)
    hydrationDetails.tap()
    XCTAssertTrue(app.staticTexts["250 ml"].waitForExistence(timeout: 10))
    capture("hydration-details", app)
    app.buttons["hydration-details-close"].tap()
    let exerciseDetails = app.buttons["dashboard-exercise-details"]
    for _ in 0..<4 {
      if exerciseDetails.exists && exerciseDetails.isHittable { break }
      dashboard.swipeUp()
    }
    XCTAssertTrue(exerciseDetails.isHittable)
    capture("stacked-exercise", app)
    exerciseDetails.tap()
    let back = app.buttons.matching(NSPredicate(format: "label IN %@", ["Back", "Zurück"])).firstMatch
    XCTAssertTrue(back.waitForExistence(timeout: 10))
    XCTAssertGreaterThan(back.frame.minY, 40)
    XCTAssertGreaterThanOrEqual(back.frame.height, 44)
    capture("exercise-details-safe-header", app)
    back.tap()
    if !logFood { return }
    dashboard.swipeDown()
    dashboard.swipeDown()
    dashboard.swipeDown()
    food.tap()
    XCTAssertTrue(app.textFields.firstMatch.waitForExistence(timeout: 15))
    let settled = NSPredicate { _, _ in app.activityIndicators.count == 0 }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: settled, object: app)], timeout: 20), .completed)
    capture("food-search", app)
    let search = app.textFields.firstMatch
    search.tap()
    search.typeText("Review yogurt")
    let foodName = "Review yogurt with berries and toasted pumpkin seeds"
    let result = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", foodName)).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 20))
    result.tap()
    let amount = app.textFields.matching(NSPredicate(format: "label IN %@", ["Amount", "Menge"])).firstMatch
    XCTAssertTrue(amount.waitForExistence(timeout: 15))
    replace(amount, with: "200")
    app.staticTexts["Synthetic kitchen"].firstMatch.tap()
    capture("food-portion", app)
    let note = app.textViews.firstMatch
    for _ in 0..<6 {
      if note.exists && note.isHittable && note.frame.minY > 100 && note.frame.maxY < app.frame.height - 140 { break }
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.45)).press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.2)))
    }
    XCTAssertTrue(note.isHittable)
    note.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
    let noteText = String(repeating: "Synthetic review note with berries. ", count: 12) + "END-REVIEW"
    note.typeText(noteText)
    let add = app.buttons.matching(NSPredicate(format: "label IN %@", ["Add Food", "Hinzufügen"])).firstMatch
    let visibleNote = NSPredicate { _, _ in
      note.isHittable && note.frame.minY > 100 && note.frame.maxY <= add.frame.minY - 12
    }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: visibleNote, object: app)], timeout: 10), .completed)
    capture("food-note-keyboard", app)
    XCTAssertTrue(add.isHittable)
    XCTAssertLessThan(note.frame.minY, app.keyboards.firstMatch.frame.minY)
    add.tap()
    try waitForMutation("POST", quantity: 200, note: noteText)
    capture("food-saved", app)
    // Close search if the add flow returns there, then enter the Diary tab.
    let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Schließen"])).firstMatch
    if close.exists && close.isHittable { close.tap() }
    let diary = app.buttons.matching(NSPredicate(format: "label IN %@", ["Diary", "Tagebuch"])).firstMatch
    XCTAssertTrue(diary.waitForExistence(timeout: 15))
    diary.tap()
    XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", foodName)).firstMatch.waitForExistence(timeout: 20))
    // Wait for the actual native Image request, not just a fallback thumbnail.
    let imageDeadline = Date().addingTimeInterval(10)
    while Date() < imageDeadline {
      if try events().contains(where: { ($0["path"] as? String) == "/fixture-thumbnail.png" }) { break }
      Thread.sleep(forTimeInterval: 0.2)
    }
    XCTAssertTrue(try events().contains(where: { ($0["path"] as? String) == "/fixture-thumbnail.png" }))
    Thread.sleep(forTimeInterval: 0.5)
    capture("diary-after-save", app)
    app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", foodName)).firstMatch.tap()
    let edit = app.buttons.matching(NSPredicate(format: "label IN %@", ["Edit", "Bearbeiten", "Edit food entry", "Eintrag bearbeiten"])).firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
    edit.tap()
    let editAmount = app.textFields.firstMatch
    XCTAssertTrue(editAmount.waitForExistence(timeout: 10))
    replace(editAmount, with: "100")
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Done", "Fertig", "Erledigt", "Save food entry changes", "Änderungen speichern"])).firstMatch.tap()
    try waitForMutation("PUT", quantity: 100, note: noteText)
    capture("food-edited", app)
    let delete = app.buttons.matching(NSPredicate(format: "label IN %@", ["Delete Entry", "Eintrag löschen"])).firstMatch
    for _ in 0..<10 {
      if delete.exists && delete.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(delete.isHittable)
    delete.tap()
    let alert = app.alerts.firstMatch
    XCTAssertTrue(alert.waitForExistence(timeout: 10))
    alert.buttons.matching(NSPredicate(format: "label IN %@", ["Delete", "Löschen"])).firstMatch.tap()
    try waitForMutation("DELETE", quantity: nil, note: nil)
    let deletedRow = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", foodName)).firstMatch
    let returnedToDiary = NSPredicate { _, _ in diary.exists && diary.isHittable && !deletedRow.exists && !delete.exists }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: returnedToDiary, object: app)], timeout: 20), .completed)
    capture("diary-after-delete", app)

  }
  private func replace(_ field: XCUIElement, with text: String) {
    field.tap()
    let current = field.value as? String ?? ""
    field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count) + text)
  }
  private func events() throws -> [[String: Any]] {
    let completed = XCTestExpectation(description: "Read native image audit")
    var result: [[String: Any]] = []
    URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:43991/events")!) { data, _, _ in
      defer { completed.fulfill() }
      if let data, let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] { result = parsed }
    }.resume()
    wait(for: [completed], timeout: 5)
    return result
  }
  private func waitForMutation(_ method: String, quantity: Double?, note: String?) throws {
    let expectation = XCTestExpectation(description: "Fixture acknowledges " + method)
    var found = false
    for _ in 0..<30 {
      let completed = XCTestExpectation(description: "Read fixture audit")
      URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:43991/events")!) { data, _, _ in
        defer { completed.fulfill() }
        guard let data, let events = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              let event = events.last(where: { $0["method"] as? String == method }),
              let entries = event["entries"] as? [[String: Any]] else { return }
        let added = entries.filter { ($0["id"] as? String)?.hasPrefix("review-created-") == true }
        if method == "DELETE" { found = added.isEmpty }
        else { found = added.count == 1 && added.first?["quantity"] as? Double == quantity && added.first?["notes"] as? String == note }
      }.resume()
      wait(for: [completed], timeout: 5)
      if found { expectation.fulfill(); break }
      Thread.sleep(forTimeInterval: 0.5)
    }
    wait(for: [expectation], timeout: 1)
  }
  private func capture(_ name: String, _ app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
