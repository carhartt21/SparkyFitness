import XCTest

final class DashboardReview: XCTestCase {
  func testDashboardScrollAndFoodNavigation() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let dashboard = app.otherElements["dashboard-scroll"].scrollViews.firstMatch
    XCTAssertTrue(dashboard.waitForExistence(timeout: 30))
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
    let amount = app.textFields["Amount"]
    XCTAssertTrue(amount.waitForExistence(timeout: 15))
    replace(amount, with: "200")
    app.staticTexts["Synthetic kitchen"].firstMatch.tap()
    capture("food-portion", app)
    let note = app.textViews.firstMatch
    for _ in 0..<6 {
      if note.exists && note.isHittable { break }
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.45)).press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.2)))
    }
    XCTAssertTrue(note.isHittable)
    note.tap()
    let noteText = String(repeating: "Synthetic review note with berries. ", count: 12) + "END-REVIEW"
    note.typeText(noteText)
    let add = app.buttons.matching(NSPredicate(format: "label IN %@", ["Add Food", "Food hinzufügen"])).firstMatch
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
    capture("diary-after-save", app)
    app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", foodName)).firstMatch.tap()
    let edit = app.buttons.matching(NSPredicate(format: "label IN %@", ["Edit", "Bearbeiten", "Edit food entry", "Bearbeiten Ernährung entry"])).firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
    edit.tap()
    let editAmount = app.textFields.firstMatch
    XCTAssertTrue(editAmount.waitForExistence(timeout: 10))
    replace(editAmount, with: "100")
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Done", "Fertig", "Erledigt", "Save food entry changes", "Speichern Ernährung entry Änderungen"])).firstMatch.tap()
    try waitForMutation("PUT", quantity: 100, note: noteText)
    capture("food-edited", app)
    let delete = app.buttons.matching(NSPredicate(format: "label IN %@", ["Delete Entry", "Entry löschen"])).firstMatch
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
