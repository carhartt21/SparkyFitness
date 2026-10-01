import XCTest

final class DashboardReview: XCTestCase {
  func testFoodDetailsLayout() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let food = app.buttons["dashboard-food"]
    XCTAssertTrue(food.waitForExistence(timeout: 30))
    food.tap()
    let search = app.textFields.firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 15))
    search.tap()
    search.typeText("Review yogurt")
    let result = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Review yogurt with berries and toasted pumpkin seeds")).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 20))
    result.tap()
    let wheel = app.descendants(matching: .any)["food-entry-amount-wheel"]
    XCTAssertTrue(wheel.waitForExistence(timeout: 15))
    // Enlarged text may legitimately move quantity below the first viewport.
    for _ in 0..<5 {
      if wheel.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(wheel.isHittable)
    XCTAssertGreaterThanOrEqual(wheel.frame.height, 44)
    capture("food-details-top", app)
    // An ordinary scroll that starts on the quantity field must not change
    // the logged amount. Only a deliberate hold activates the spinner.
    let initialAmount = wheel.value as? String
    XCTAssertNotNil(initialAmount)
    let scrollStart = wheel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    let scrollEnd = scrollStart.withOffset(CGVector(dx: 0, dy: -60))
    scrollStart.press(forDuration: 0.05, thenDragTo: scrollEnd)
    XCTAssertEqual(wheel.value as? String, initialAmount)
    for _ in 0..<5 { if wheel.isHittable { break }; app.swipeDown() }
    XCTAssertTrue(wheel.isHittable)
    let spinStart = wheel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    spinStart.press(forDuration: 0.6, thenDragTo: spinStart.withOffset(CGVector(dx: 0, dy: -28)))
    XCTAssertNotEqual(wheel.value as? String, initialAmount)
    capture("food-amount-intentional-drag", app)
    let options = app.buttons["food-entry-more-options"]
    for _ in 0..<5 {
      if options.exists && options.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(options.isHittable)
    XCTAssertGreaterThanOrEqual(options.frame.height, 44)
    capture("food-details-sections", app)
    options.tap()
    capture("food-details-options", app)
    let edit = app.buttons.matching(NSPredicate(format: "label IN %@", ["Edit food and serving sizes", "Lebensmittel und Portionsgrößen bearbeiten"])).firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
    edit.tap()
    let cancel = app.buttons["food-edit-cancel"]
    let save = app.buttons["food-edit-save"]
    XCTAssertTrue(cancel.waitForExistence(timeout: 15))
    XCTAssertTrue(save.isHittable)
    let title = app.staticTexts.matching(NSPredicate(format: "label IN %@", ["Edit Food", "Lebensmittel bearbeiten"])).firstMatch
    XCTAssertTrue(title.exists)
    XCTAssertGreaterThanOrEqual(title.frame.minX, cancel.frame.maxX)
    XCTAssertLessThanOrEqual(title.frame.maxX, save.frame.minX)
    capture("food-edit-header", app)
    let addServing = app.buttons["serving-add"]
    for _ in 0..<12 { if addServing.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(addServing.isHittable)
    XCTAssertGreaterThanOrEqual(addServing.frame.height, 44 - 0.01)
    XCTAssertGreaterThanOrEqual(addServing.frame.width, 44 - 0.01)
    capture("food-edit-servings", app)
    app.swipeUp()
    capture("food-edit-preview", app)
  }

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
  func testNotificationTour() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let settings = app.buttons["open-settings"]
    XCTAssertTrue(settings.waitForExistence(timeout: 10)); settings.tap()
    let preferences = app.buttons["settings-app-preferences"]
    for _ in 0..<6 { if preferences.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(preferences.isHittable); preferences.tap()
    let notifications = app.buttons["settings-notifications"]
    for _ in 0..<5 { if notifications.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(notifications.isHittable); notifications.tap()
    sleep(2)
    capture("notifications-top",app)
    app.swipeUp(); sleep(1); capture("notifications-middle",app)
    app.swipeUp(); sleep(1); capture("notifications-lower",app)
    app.swipeUp(); sleep(1); capture("notifications-status",app)
    let guide=app.buttons["notification-widget-guide"]
    for _ in 0..<8 { if guide.isHittable {break}; app.swipeDown() }
    XCTAssertTrue(guide.isHittable);guide.tap();sleep(1)
    capture("widget-guide-top",app)
    app.swipeUp();sleep(1);capture("widget-guide-bottom",app)
  }

  /// Visual tour of the other primary surfaces for design review captures.
  func testScreenTour() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let tabs = [["Diary", "Tagebuch"], ["Insights"], ["More", "Mehr"]]
    for labels in tabs {
      let tab = app.buttons.matching(NSPredicate(format: "label IN %@", labels)).firstMatch
      XCTAssertTrue(tab.waitForExistence(timeout: 10))
      tab.tap()
      sleep(3)
      capture("tour-\(labels[0].lowercased())-top", app)
      app.swipeUp()
      sleep(1)
      capture("tour-\(labels[0].lowercased())-lower", app)
      app.swipeDown()
      app.swipeDown()
    }
    let settings = app.buttons["open-settings"]
    XCTAssertTrue(settings.waitForExistence(timeout: 10))
    settings.tap()
    sleep(2)
    capture("tour-settings", app)
    app.swipeUp()
    capture("tour-settings-lower", app)
    app.swipeRight()
    let home = app.buttons.matching(NSPredicate(format: "label IN %@", ["Home"])).firstMatch
    if home.waitForExistence(timeout: 5) && home.isHittable { home.tap() }
    let food = app.buttons["dashboard-food"]
    XCTAssertTrue(food.waitForExistence(timeout: 15))
    food.tap()
    XCTAssertTrue(app.textFields.firstMatch.waitForExistence(timeout: 15))
    sleep(3)
    capture("tour-food-search", app)
    let quickAdd = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Quick add")).firstMatch
    XCTAssertTrue(quickAdd.waitForExistence(timeout: 10))
    quickAdd.tap()
    let confirm = app.buttons["quick-add-confirm"]
    XCTAssertTrue(confirm.waitForExistence(timeout: 10))
    sleep(1)
    capture("tour-quick-add-sheet", app)
    app.buttons["quick-add-more"].tap()
    sleep(3)
    capture("tour-food-details", app)
    // The target beside a goal share explains it.
    let goal = app.descendants(matching: .any)["food-entry-highlight-fat-goal"]
    if goal.waitForExistence(timeout: 5) {
      goal.tap()
      sleep(1)
      capture("tour-food-goal-tooltip", app)
      goal.tap()
      sleep(1)
    }
    // Serving size: grams first, saved portions after; picking one converts the amount.
    let unitPicker = app.buttons["food-entry-unit-picker"]
    XCTAssertTrue(unitPicker.waitForExistence(timeout: 10))
    unitPicker.tap()
    sleep(2)
    capture("tour-food-unit-menu", app)
    // The unit dropdown opens as a popover over the field; its second row
    // (the first saved portion) sits about one and a half fields lower.
    let field = unitPicker.frame
    app.coordinate(withNormalizedOffset: .zero)
      .withOffset(CGVector(dx: field.midX, dy: field.minY + field.height * 1.45))
      .tap()
    sleep(2)
    capture("tour-food-details-portion", app)
    app.swipeUp()
    sleep(1)
    capture("tour-food-details-lower", app)
    app.swipeUp()
    sleep(1)
    capture("tour-food-details-bottom", app)
    // Edit Food straight from the details pencil (the review food is the
    // user's own), the reference Edit Food layout.
    let edit = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Edit food and serving sizes")).firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
    edit.tap()
    let editor = app.descendants(matching: .any)["serving-sizes-editor"]
    XCTAssertTrue(editor.waitForExistence(timeout: 15))
    sleep(2)
    capture("tour-edit-food-top", app)
    app.swipeUp()
    sleep(1)
    capture("tour-edit-food-servings", app)
    app.swipeUp()
    sleep(1)
    capture("tour-edit-food-preview", app)
  }
  /// Opens each daily tracking screen from More and captures top and lower
  /// halves for comparison with the check-in, habits and supplements references.
  func testTrackingTour() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    sleep(2)
    capture("tracking-dashboard", app)
    // Calendar with Daily Progress marks, then the quick-log sheet.
    let date = app.buttons["dashboard-date"]
    if date.waitForExistence(timeout: 10) {
      date.tap()
      sleep(3)
      capture("tracking-calendar", app)
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.1)).tap()
      sleep(2)
    }
    let add = app.buttons.matching(NSPredicate(format: "label IN %@", ["Add", "Hinzufügen"])).firstMatch
    if add.waitForExistence(timeout: 10) && add.isHittable {
      add.tap()
      sleep(2)
      capture("tracking-add-sheet", app)
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.12)).tap()
      sleep(2)
    }
    let screens: [(tile: String, id: String)] = [
      ("more-daily-checkin", "daily-checkin"),
      ("more-habits", "habits"),
      ("more-supplements", "supplements"),
      ("more-daily-progress", "daily-progress"),
      ("more-training-plans", "workout-plans"),
    ]
    for screen in screens {
      let more = app.buttons.matching(NSPredicate(format: "label IN %@", ["More", "Mehr"])).firstMatch
      XCTAssertTrue(more.waitForExistence(timeout: 10))
      more.tap()
      let tile = app.descendants(matching: .any)[screen.tile]
      if !tile.waitForExistence(timeout: 5) || !tile.isHittable { app.swipeUp() }
      XCTAssertTrue(tile.waitForExistence(timeout: 10))
      tile.tap()
      XCTAssertTrue(app.buttons["\(screen.id)-back"].waitForExistence(timeout: 15))
      sleep(3)
      capture("tracking-\(screen.id)-top", app)
      app.swipeUp()
      sleep(1)
      capture("tracking-\(screen.id)-lower", app)
      app.swipeUp()
      sleep(1)
      capture("tracking-\(screen.id)-bottom", app)
      app.swipeDown()
      app.swipeDown()
      app.swipeDown()
      if screen.id == "workout-plans" {
        let edit = app.buttons.matching(NSPredicate(format: "label IN %@", ["Edit", "Bearbeiten"])).firstMatch
        if !edit.isHittable { app.swipeUp() }
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        XCTAssertTrue(app.textFields["weekly-plan-name"].waitForExistence(timeout: 15))
        capture("weekly-plan-editor-top", app)
        app.swipeUp()
        capture("weekly-plan-editor-lower", app)
        let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Schließen"])).firstMatch
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        close.tap()
      }
      app.buttons["\(screen.id)-back"].tap()
      sleep(1)
    }
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
    let fallbackDate = app.buttons["dashboard-date"]
    let nativeButtons = app.navigationBars.firstMatch.buttons
    let usesNativeHeader = !fallbackDate.exists && nativeButtons.count >= 3
    let date = usesNativeHeader ? nativeButtons.element(boundBy: 1) : fallbackDate
    let previous = usesNativeHeader ? nativeButtons.element(boundBy: 0) : app.buttons["dashboard-previous-day"]
    let next = usesNativeHeader ? nativeButtons.element(boundBy: 2) : app.buttons["dashboard-next-day"]
    XCTAssertTrue(date.isHittable)
    if !usesNativeHeader {
      // Reference header: logo and title first, Settings in the upper-right
      // corner, the full-width date bar underneath.
      let logo = app.buttons["dashboard-home"]
      let settings = app.buttons["open-settings"]
      XCTAssertGreaterThan(date.frame.minY, logo.frame.maxY - 1)
      XCTAssertEqual(settings.frame.midY, logo.frame.midY, accuracy: 2)
      XCTAssertGreaterThan(settings.frame.minX, logo.frame.maxX)
    }
    var headerIds = ["dashboard-home", "open-settings", "dashboard-date", "dashboard-previous-day", "dashboard-next-day"]
    // Today appears only when another day is selected.
    if app.buttons["dashboard-today"].exists { headerIds.append("dashboard-today") }
    let controls = usesNativeHeader
      ? [previous, date, next]
      : headerIds.map { app.buttons[$0] }
    for control in controls {
      XCTAssertTrue(control.isHittable)
      // UIKit owns the native button's extended hit region; its AX frame is
      // the 36-point visible symbol. React-owned controls require 44 points.
      // XCTest reports some exact 44-point React frames as 43.999996 after
      // coordinate conversion. Allow only that sub-pixel rounding difference.
      XCTAssertGreaterThanOrEqual(
        control.frame.width, (usesNativeHeader ? 36 : 44) - 0.01
      )
      XCTAssertGreaterThanOrEqual(
        control.frame.height, (usesNativeHeader ? 36 : 44) - 0.01
      )
    }
    let originalDate = usesNativeHeader ? date.label : date.value as? String
    XCTAssertNotNil(originalDate)
    previous.tap()
    XCTAssertNotEqual(usesNativeHeader ? date.label : date.value as? String, originalDate)
    next.tap()
    XCTAssertEqual(usesNativeHeader ? date.label : date.value as? String, originalDate)
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
    let back = app.buttons.matching(
      NSPredicate(format: "label IN %@", ["Zurück", "Back"])
    ).firstMatch
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
    // The amount is a vertical spinner; a long press opens the number field.
    let wheel = app.descendants(matching: .any)["food-entry-amount-wheel"]
    XCTAssertTrue(wheel.waitForExistence(timeout: 15))
    wheel.press(forDuration: 0.8)
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
    let add = app.buttons.matching(NSPredicate(format: "label IN %@", ["Add Food", "Hinzufügen", "Add to Diary", "Zum Tagebuch hinzufügen"])).firstMatch
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
