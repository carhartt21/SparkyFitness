import XCTest

final class DashboardReview: XCTestCase {
  func testHydrationSources() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let dashboard = app.otherElements["dashboard-scroll"]
    XCTAssertTrue(dashboard.waitForExistence(timeout: 30))
    let details = app.buttons["dashboard-hydration-details"]
    for _ in 0..<10 { if details.isHittable { break }; dashboard.swipeUp(velocity: .slow) }
    XCTAssertTrue(details.isHittable)
    XCTAssertFalse(app.otherElements["hydration-options"].exists)
    if details.frame.minY > 250 { dashboard.swipeUp(velocity: .slow) }
    capture("hydration-full-card", app)
    details.tap()
    XCTAssertTrue(app.staticTexts["Für das Trinkziel erfasst"].waitForExistence(timeout: 15))
    capture("hydration-sources-top", app)
    app.swipeUp()
    capture("hydration-sources-history", app)
    app.swipeUp()
    capture("hydration-sources-bottom", app)
    app.buttons["hydration-details-close"].tap()
    let caffeine = app.descendants(matching: .any)["caffeine-title"]
    for _ in 0..<12 { if caffeine.isHittable { break }; dashboard.swipeUp(velocity: .slow) }
    XCTAssertTrue(caffeine.exists)
    capture("caffeine-selected-day", app)
  }

  /// Exercise the dense nutrient columns with ordinary and long calorie values.
  func testFoodMacroColumns() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let dashboard = app.otherElements["dashboard-scroll"]
    XCTAssertTrue(dashboard.waitForExistence(timeout: 30))
    let food = app.buttons["dashboard-food"]
    for _ in 0..<6 { if food.isHittable { break }; dashboard.swipeUp() }
    XCTAssertTrue(food.isHittable); food.tap()
    let search = app.textFields.firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 15))
    search.tap(); search.typeText("Review yogurt")
    let result = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Review yogurt with berries and toasted pumpkin seeds")).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 20)); result.tap()
    let calories = app.descendants(matching: .any)["food-entry-highlight-calories"]
    XCTAssertTrue(calories.waitForExistence(timeout: 15))
    XCTAssertTrue(calories.label.contains("150 kcal"))
    var previous: CGRect?
    for key in ["calories", "fat", "carbs", "protein"] {
      let cell = app.descendants(matching: .any)["food-entry-highlight-\(key)"]
      XCTAssertTrue(cell.exists)
      XCTAssertGreaterThanOrEqual(cell.frame.minX, 0)
      XCTAssertLessThanOrEqual(cell.frame.maxX, app.frame.maxX)
      if let prior = previous, abs(prior.minY - cell.frame.minY) < 2 {
        XCTAssertGreaterThanOrEqual(cell.frame.minX, prior.maxX - 1)
      }
      previous = cell.frame
    }
    capture("food-macros-normal", app)
    let wheel = app.descendants(matching: .any)["food-entry-amount-wheel"]
    for _ in 0..<6 { if wheel.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(wheel.isHittable); wheel.tap()
    let amount = app.textFields["food-entry-amount-input"]
    XCTAssertTrue(amount.waitForExistence(timeout: 10))
    replace(amount, with: "10000")
    app.descendants(matching: .any)["keyboard-action-done"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let keyboardGone = NSPredicate { _, _ in !app.keyboards.firstMatch.exists }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: keyboardGone, object: app)], timeout: 10), .completed)
    let scaled = NSPredicate { _, _ in calories.label.contains("15.000 kcal") || calories.label.contains("15,000 kcal") }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: scaled, object: app)], timeout: 10), .completed)
    for _ in 0..<6 { if calories.frame.minY > 110 && calories.isHittable { break }; app.swipeDown() }
    capture("food-macros-long-value", app)
  }

  /// Compare the two production summary cards using isolated task/energy data.
  func testSummaryCards() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let dashboard = app.otherElements["dashboard-scroll"]
    XCTAssertTrue(dashboard.waitForExistence(timeout: 30))
    let energyVisual = app.descendants(matching: .any)["dashboard-energy-visual"]
    let energyRows = app.descendants(matching: .any)["dashboard-energy-rows"]
    XCTAssertTrue(energyVisual.waitForExistence(timeout: 15))
    XCTAssertTrue(energyRows.exists)
    // RN may expose this text through a grouped Other element, not StaticText.
    let balance = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "1.400", "1,400")).firstMatch
    if !balance.exists {
      let tree = XCTAttachment(string: app.debugDescription)
      tree.name = "summary-accessibility-diagnostic"
      tree.lifetime = .keepAlways
      add(tree)
    }
    XCTAssertTrue(balance.exists)
    XCTAssertTrue(app.descendants(matching: .any)["dashboard-daily-progress-count"].exists)
    let visualFrame = energyVisual.frame
    let rowsFrame = energyRows.frame
    capture("summary-energy", app)
    let goal = app.buttons["dashboard-edit-goal"]
    XCTAssertTrue(goal.exists)
    XCTAssertGreaterThanOrEqual(goal.frame.width, 44)
    XCTAssertGreaterThanOrEqual(goal.frame.height, 44)

    let nextTasks = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND identifier != %@", "dashboard-category-", "dashboard-next-day"))
    let lastTask = nextTasks.element(boundBy: 3)
    for _ in 0..<7 {
      if lastTask.exists && lastTask.isHittable && lastTask.frame.maxY < app.frame.maxY - 100 { break }
      dashboard.swipeUp()
    }
    XCTAssertEqual(nextTasks.count, 4)
    XCTAssertTrue(lastTask.isHittable)
    let progressVisual = app.descendants(matching: .any)["dashboard-daily-progress-visual"]
    let progressRows = app.descendants(matching: .any)["dashboard-daily-progress-rows"]
    XCTAssertTrue(progressVisual.exists)
    XCTAssertTrue(progressRows.exists)
    XCTAssertEqual(visualFrame.minX, progressVisual.frame.minX, accuracy: 2)
    XCTAssertEqual(visualFrame.width, progressVisual.frame.width, accuracy: 2)
    XCTAssertEqual(rowsFrame.minX, progressRows.frame.minX, accuracy: 2)
    XCTAssertEqual(rowsFrame.width, progressRows.frame.width, accuracy: 2)
    let stacked = rowsFrame.minY >= visualFrame.maxY
    if !stacked {
      XCTAssertGreaterThanOrEqual(progressRows.frame.height, 176)
      XCTAssertGreaterThanOrEqual(progressVisual.frame.height, 176)
    }
    for task in nextTasks.allElementsBoundByIndex {
      XCTAssertGreaterThanOrEqual(task.frame.height, 44)
      XCTAssertGreaterThanOrEqual(task.frame.width, 44)
      XCTAssertGreaterThanOrEqual(task.frame.minX, 0)
      XCTAssertLessThanOrEqual(task.frame.maxX, app.frame.maxX)
    }
    let measurement = XCTAttachment(string: "Energy visual: \(visualFrame), rows: \(rowsFrame); task visual: \(progressVisual.frame), rows: \(progressRows.frame); stacked: \(stacked)")
    measurement.name = "summary-layout-measurement"
    measurement.lifetime = .keepAlways
    add(measurement)
    capture("summary-progress", app)
    // A bottom-row geometry check can scroll past the card's heading. Capture
    // the top separately so review evidence includes its actual title and X.
    let progressHeading = app.buttons["dashboard-progress-open"]
    for _ in 0..<7 {
      let delta = progressHeading.frame.minY - 125
      if abs(delta) < 15 { break }
      let distance = min(app.frame.height * 0.45, abs(delta)) / app.frame.height
      let startY = delta > 0 ? 0.72 : 0.35
      let endY = startY + (delta > 0 ? -distance : distance)
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY))
        .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: endY)), withVelocity: .slow, thenHoldForDuration: 0.4)
    }
    XCTAssertTrue(progressHeading.isHittable)
    capture("summary-progress-top", app)
    for _ in 0..<7 { if nextTasks.firstMatch.isHittable { break }; dashboard.swipeUp(velocity: .slow) }
    nextTasks.firstMatch.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Zurück", "Back"])).firstMatch.waitForExistence(timeout: 10))
    capture("summary-task-destination", app)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Zurück", "Back"])).firstMatch.tap()
    for _ in 0..<7 { if progressHeading.isHittable { break }; dashboard.swipeDown() }
    progressHeading.tap()
    let detailSummary = app.descendants(matching: .any)["daily-progress-summary"]
    XCTAssertTrue(detailSummary.waitForExistence(timeout: 10))
    let detailCount = app.descendants(matching: .any)["daily-progress-count"]
    XCTAssertTrue(detailCount.exists)
    XCTAssertGreaterThanOrEqual(detailCount.frame.minX, detailSummary.frame.minX)
    XCTAssertLessThanOrEqual(detailCount.frame.maxX, detailSummary.frame.maxX)
    capture("progress-screen-summary", app)
    let detailMeasurement = XCTAttachment(string: "Progress detail summary: \(detailSummary.frame), count: \(detailCount.frame); stacked: \(stacked)")
    detailMeasurement.name = "progress-screen-measurement"
    detailMeasurement.lifetime = .keepAlways
    add(detailMeasurement)
  }

  func testSupplementLayout() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let more = app.buttons.matching(NSPredicate(format: "label IN %@", ["Mehr", "More"])).firstMatch
    more.tap()
    let supplements = app.descendants(matching: .any)["more-supplements"]
    for _ in 0..<5 { if supplements.exists && supplements.isHittable { break }; app.swipeUp() }
    supplements.tap()
    let summary = app.descendants(matching: .any)["supplements-summary"]
    XCTAssertTrue(summary.waitForExistence(timeout: 10))
    capture("v40-supplements-populated", app)
    let menu = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "supplement-menu-")).firstMatch
    XCTAssertTrue(menu.exists)
    XCTAssertGreaterThanOrEqual(menu.frame.width, 44)
    XCTAssertGreaterThanOrEqual(menu.frame.height, 44)
    let settings = app.descendants(matching: .any)["supplements-settings"]
    for _ in 0..<8 { if settings.exists && settings.frame.maxY < app.frame.maxY - 20 { break }; app.swipeUp() }
    XCTAssertTrue(settings.exists)
    capture("v40-supplements-settings-populated", app)
  }

  func testV40Corrections() throws {
    try testSummaryCards()
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    let back = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zurück", "Back"])).firstMatch
    back.tap()
    let more = app.buttons.matching(NSPredicate(format: "label IN %@", ["Mehr", "More"])).firstMatch
    XCTAssertTrue(more.waitForExistence(timeout: 10))
    more.tap()
    let supplements = app.descendants(matching: .any)["more-supplements"]
    for _ in 0..<5 { if supplements.exists && supplements.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(supplements.isHittable)
    supplements.tap()
    XCTAssertTrue(app.buttons["supplements-back"].waitForExistence(timeout: 10))
    capture("v40-supplements-top", app)
    app.swipeUp()
    capture("v40-supplements-settings", app)
    let menu = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "supplement-menu-")).firstMatch
    if menu.exists { XCTAssertGreaterThanOrEqual(menu.frame.width, 44); XCTAssertGreaterThanOrEqual(menu.frame.height, 44) }
    app.buttons["supplements-back"].tap()
    let checkin = app.descendants(matching: .any)["more-daily-checkin"]
    for _ in 0..<5 { if checkin.exists && checkin.isHittable { break }; app.swipeDown() }
    checkin.tap()
    XCTAssertTrue(app.buttons["daily-checkin-back"].waitForExistence(timeout: 10))
    let addTag = app.buttons["daily-checkin-add-tag"]
    for _ in 0..<10 { if addTag.exists && addTag.isHittable && addTag.frame.maxY < app.frame.maxY - 80 { break }; app.swipeUp() }
    XCTAssertTrue(addTag.isHittable)
    addTag.tap()
    let field = app.textFields["daily-checkin-custom-tag"]
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    field.tap()
    field.typeText("Eigener Test")
    XCTAssertTrue(NSPredicate(format: "value == %@", "Eigener Test").evaluate(with: field))
    field.typeText("\n")
    let tag = app.descendants(matching: .any)["daily-checkin-tag-Eigener Test"]
    XCTAssertTrue(tag.waitForExistence(timeout: 5))
    tag.tap()
    XCTAssertTrue(tag.exists)
    capture("v40-custom-tag-deselected", app)
    for _ in 0..<12 { if app.buttons["daily-checkin-back"].isHittable { break }; app.swipeDown() }
    app.buttons["daily-checkin-back"].tap()
    checkin.tap()
    XCTAssertTrue(app.buttons["daily-checkin-back"].waitForExistence(timeout: 10))
    for _ in 0..<10 { if tag.exists && tag.isHittable && tag.frame.maxY < app.frame.maxY - 80 { break }; app.swipeUp() }
    XCTAssertTrue(tag.exists)
    tag.tap()
    capture("v40-custom-tag-reselected", app)
  }

  func testV41Corrections() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let water = app.buttons["dashboard-water"]
    for _ in 0..<8 { if water.isHittable && water.frame.maxY < app.frame.maxY - 120 { break }; app.swipeUp() }
    XCTAssertTrue(water.isHittable)
    water.tap()
    let confirmation = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "250 ml Wasser eingetragen")).firstMatch
    XCTAssertTrue(confirmation.waitForExistence(timeout: 10))
    capture("v41-water-confirmed", app)
    for _ in 0..<10 { app.swipeDown() }
    try testV40Corrections()
    let back = app.buttons["daily-checkin-back"]
    for _ in 0..<12 { if back.isHittable { break }; app.swipeDown() }
    back.tap()
    let supplements = app.descendants(matching: .any)["more-supplements"]
    for _ in 0..<8 { if supplements.isHittable { break }; app.swipeUp() }
    supplements.tap()
    let addSupplement = app.descendants(matching: .any)["supplements-add"]
    XCTAssertTrue(addSupplement.waitForExistence(timeout: 10))
    addSupplement.tap()
    let fiber = app.textFields["supplement-nutrient-dietary_fiber"]
    for _ in 0..<12 { if fiber.isHittable && fiber.frame.maxY < app.frame.maxY - 80 { break }; app.swipeUp() }
    XCTAssertTrue(fiber.exists)
    capture("v41-supplement-fiber", app)
    let magnesium = app.textFields["supplement-nutrient-catalog:magnesium"]
    for _ in 0..<10 { if magnesium.isHittable && magnesium.frame.maxY < app.frame.maxY - 80 { break }; app.swipeUp() }
    XCTAssertTrue(magnesium.exists)
    capture("v41-supplement-magnesium", app)
    let moreNutrients = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Weitere Nährstoffe")).firstMatch
    for _ in 0..<10 { if moreNutrients.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(moreNutrients.exists)
    moreNutrients.tap()
    let thiamin = app.textFields["supplement-nutrient-catalog:thiamin"]
    for _ in 0..<12 { if thiamin.isHittable && thiamin.frame.maxY < app.frame.maxY - 80 { break }; app.swipeUp() }
    XCTAssertTrue(thiamin.exists)
    capture("v41-supplement-more-nutrients", app)
  }

  func testMealGoalStatus() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let more = app.buttons.matching(NSPredicate(format: "label IN %@", ["More", "Mehr"])).firstMatch
    more.tap()
    let goals = app.descendants(matching: .any)["more-daily-progress"]
    for _ in 0..<4 { if goals.exists && goals.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(goals.waitForExistence(timeout: 10))
    goals.tap()
    let meal = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "daily-progress-item-meal:")).firstMatch
    for _ in 0..<4 { if meal.exists && meal.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(meal.waitForExistence(timeout: 10))
    capture("meal-goals-before", app)
    meal.tap()
    let status = app.buttons["meal-status-control"]
    XCTAssertTrue(status.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(status.frame.height, 44)
    XCTAssertGreaterThanOrEqual(status.frame.width, 44)
    capture("meal-empty-pending", app)
    status.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "identifier == %@ AND label CONTAINS %@", "meal-status-control", "Abgeschlossen")).firstMatch.waitForExistence(timeout: 10))
    capture("meal-empty-complete", app)
    status.press(forDuration: 0.7)
    let skip = app.buttons["action-sheet-item-skipped"]
    XCTAssertTrue(skip.waitForExistence(timeout: 10))
    capture("meal-status-choices", app)
    skip.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "identifier == %@ AND label CONTAINS %@", "meal-status-control", "Keine Mahlzeit")).firstMatch.waitForExistence(timeout: 10))
    capture("meal-empty-skipped", app)
    let back = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zurück", "Back"])).firstMatch
    back.tap()
    XCTAssertTrue(meal.waitForExistence(timeout: 10))
    XCTAssertTrue(meal.label.contains("Abgeschlossen"))
    capture("meal-goals-updated", app)
    meal.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "identifier == %@ AND label CONTAINS %@", "meal-status-control", "Keine Mahlzeit")).firstMatch.waitForExistence(timeout: 10))
    capture("meal-empty-reopened", app)
  }

  /// Focused dashboard/provider/keyboard review; only synthetic records.
  func testUIRefinements() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let dashboard = app.otherElements["dashboard-scroll"]
    XCTAssertTrue(dashboard.waitForExistence(timeout: 30))
    XCTAssertTrue(app.buttons["dashboard-edit-goal"].exists)
    capture("refinement-dashboard", app)
    let nextTask = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "dashboard-category-")).firstMatch
    for _ in 0..<5 { if nextTask.isHittable { break }; dashboard.swipeUp() }
    XCTAssertTrue(nextTask.isHittable)
    capture("refinement-progress", app)
    nextTask.tap()
    capture("refinement-task-destination", app)
    app.buttons["Zurück"].firstMatch.tap()
    for _ in 0..<6 { if app.buttons["open-settings"].isHittable { break }; dashboard.swipeDown() }
    app.buttons["open-settings"].tap()
    let foodSettings = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Essen")).firstMatch
    for _ in 0..<6 { if foodSettings.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(foodSettings.isHittable); foodSettings.tap()
    let provider = app.descendants(matching: .any)["food-default-provider"]
    for _ in 0..<5 { if provider.exists && provider.frame.maxY < app.frame.maxY - 50 { break }; app.swipeUp() }
    XCTAssertTrue(provider.exists)
    capture("refinement-food-settings", app)
    app.buttons["Zurück"].firstMatch.tap()
    app.buttons["Zurück"].firstMatch.tap()
    try reviewFoodKeyboard(app)
  }

  func testFoodKeyboard() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    try reviewFoodKeyboard(app)
  }

  private func reviewFoodKeyboard(_ app: XCUIApplication) throws {
    let dashboard = app.otherElements["dashboard-scroll"]
    let food = app.buttons["dashboard-food"]
    for _ in 0..<6 { if food.isHittable { break }; dashboard.swipeUp() }
    XCTAssertTrue(food.isHittable); food.tap()
    let search = app.textFields.firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 15))
    search.tap(); search.typeText("Review yogurt")
    let result = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Review yogurt with berries and toasted pumpkin seeds")).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 20)); result.tap()
    let wheel = app.descendants(matching: .any)["food-entry-amount-wheel"]
    XCTAssertTrue(wheel.waitForExistence(timeout: 15))
    for _ in 0..<6 { if wheel.isHittable { break }; app.swipeUp() }
    capture("refinement-food-details", app)
    wheel.tap()
    let amount = app.textFields["food-entry-amount-input"]
    XCTAssertTrue(amount.waitForExistence(timeout: 10))
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
    try assertKeyboardBarAttached(app)
    let amountBar = app.descendants(matching: .any)["food-entry-keyboard-actions"]
    let amountVisible = NSPredicate { _, _ in amount.frame.maxY <= amountBar.frame.minY - 12 }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: amountVisible, object: app)], timeout: 10), .completed)
    capture("refinement-amount-keyboard", app)
    // The native gesture container owns testID; its accessible child is the button.
    // Exercise the current visible center of that same native action.
    app.descendants(matching: .any)["keyboard-action-done"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let keyboardGone = NSPredicate { _, _ in !app.keyboards.firstMatch.exists }
    let dismissed = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: keyboardGone, object: app)], timeout: 10)
    capture("refinement-keyboard-dismissed", app)
    XCTAssertEqual(dismissed, .completed)
    let options = app.buttons["food-entry-more-options"]
    for _ in 0..<8 { if options.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(options.isHittable); options.tap()
    let note = app.textViews.firstMatch
    for _ in 0..<10 { if note.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(note.isHittable); note.tap()
    let noteText = String(repeating: "Synthetic review note. ", count: 12) + "END-REFINEMENT"
    note.typeText(noteText)
    try assertKeyboardBarAttached(app)
    let add = app.descendants(matching: .any)["keyboard-action-add"]
    let bar = app.descendants(matching: .any)["food-entry-keyboard-actions"]
    let visibility = XCTAttachment(string: "Note bottom: \(note.frame.maxY); action bar top: \(bar.frame.minY)")
    visibility.name = "refinement-note-measurement"
    visibility.lifetime = .keepAlways
    self.add(visibility)
    let noteVisible = NSPredicate { _, _ in note.frame.maxY <= bar.frame.minY - 12 }
    let visible = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: noteVisible, object: app)], timeout: 10)
    capture("refinement-note-keyboard", app)
    XCTAssertEqual(visible, .completed)
    XCTAssertTrue(add.isHittable)
    add.tap()
    try waitForMutation("POST", quantity: 100, note: noteText)
    capture("refinement-food-saved", app)
  }

  private func assertKeyboardBarAttached(_ app: XCUIApplication) throws {
    let bar = app.descendants(matching: .any)["food-entry-keyboard-actions"]
    let keyboard = app.keyboards.firstMatch
    capture("refinement-keyboard-before-settling", app)
    XCTAssertTrue(bar.waitForExistence(timeout: 10))
    // XCUIKeyboard.frame excludes the panel's top inset and bottom safe area.
    // Compare with the OS keyboard event emitted by the isolated review app.
    let metricEvent = try events().last(where: { $0["method"] as? String == "KEYBOARD" })
    let metrics = metricEvent?["metrics"] as? [String: Any]
    let keyboardTop = try XCTUnwrap(metrics?["screenY"] as? Double)
    XCTAssertGreaterThan(keyboard.frame.height, 0)
    let attached = NSPredicate { _, _ in abs(bar.frame.maxY - keyboardTop) <= 2 }
    let result = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: attached, object: app)], timeout: 10)
    capture("refinement-keyboard-geometry", app)
    let doneFrame = app.descendants(matching: .any)["keyboard-action-done"].frame
    let measurement = XCTAttachment(string: "Action bar bottom: \(bar.frame.maxY); OS keyboard panel top: \(keyboardTop); key-region top: \(keyboard.frame.minY); Done frame: \(doneFrame)")
    measurement.name = "refinement-keyboard-measurement"
    measurement.lifetime = .keepAlways
    add(measurement)
    XCTAssertEqual(result, .completed, "Action bar bottom \(bar.frame.maxY), OS keyboard panel top \(keyboardTop)")
    XCTAssertFalse(app.buttons["Done"].exists)
  }

  /// Focused v38 review: production controls with isolated synthetic transport.
  func testV38Corrections() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    let dashboard = app.otherElements["dashboard-scroll"]
    XCTAssertTrue(dashboard.waitForExistence(timeout: 30))
    XCTAssertTrue(app.buttons["dashboard-edit-goal"].exists)
    let progress = app.buttons["dashboard-progress-open"]
    XCTAssertTrue(progress.waitForExistence(timeout: 15))
    XCTAssertGreaterThanOrEqual(progress.frame.height, 44)
    capture("v38-dashboard", app)
    let nextTask = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "dashboard-category-")).firstMatch
    for _ in 0..<6 { if nextTask.isHittable { break }; dashboard.swipeUp() }
    XCTAssertTrue(nextTask.isHittable); nextTask.tap()
    capture("v38-next-task-destination", app)
    app.buttons["Zurück"].firstMatch.tap()
    XCTAssertTrue(dashboard.waitForExistence(timeout: 10))
    let food = app.buttons["dashboard-food"]
    for _ in 0..<6 { if food.isHittable { break }; dashboard.swipeUp() }
    XCTAssertTrue(food.isHittable)
    food.tap()
    let search = app.textFields.firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 15))
    search.tap(); search.typeText("Review yogurt")
    let result = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Review yogurt with berries and toasted pumpkin seeds")).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 20)); result.tap()
    let options = app.buttons["food-entry-more-options"]
    for _ in 0..<10 { if options.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(options.isHittable); options.tap()
    let moreNutrients = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Weitere Nährstoffe anzeigen")).firstMatch
    for _ in 0..<6 { if moreNutrients.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(moreNutrients.waitForExistence(timeout: 10)); moreNutrients.tap()
    let magnesium = app.staticTexts["Magnesium"].firstMatch
    for _ in 0..<8 { if magnesium.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(magnesium.isHittable)
    XCTAssertTrue(app.staticTexts["Vitamin B12"].firstMatch.exists)
    capture("v38-nutrients", app)
    let note = app.textViews.firstMatch
    for _ in 0..<8 { if note.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(note.isHittable); note.tap()
    note.typeText("Synthetic retained draft")
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
    capture("v38-note-keyboard", app)
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.4)).press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.72)))
    let keyboardGone = NSPredicate { _, _ in !app.keyboards.firstMatch.exists }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: keyboardGone, object: app)], timeout: 10), .completed)
    XCTAssertTrue((note.value as? String ?? "").contains("Synthetic retained draft"))
    capture("v38-note-dismissed", app)
    app.buttons["food-entry-add-cancel"].tap()
    let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Schließen", "Close"])).firstMatch
    XCTAssertTrue(close.waitForExistence(timeout: 10)); close.tap()
    for _ in 0..<10 { if app.buttons["open-settings"].isHittable { break }; app.swipeDown() }
    app.buttons["open-settings"].tap()
    let foodSettings = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Essen")).firstMatch
    for _ in 0..<8 { if foodSettings.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(foodSettings.isHittable); foodSettings.tap()
    let mealSettings = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Mahlzeitenarten")).firstMatch
    XCTAssertTrue(mealSettings.waitForExistence(timeout: 10)); mealSettings.tap()
    let edit = app.buttons["edit-custom-review-custom-meal"]
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
    capture("v38-meal-settings", app)
    edit.tap()
    let icon = app.descendants(matching: .any)["meal-icon-water"]
    XCTAssertTrue(icon.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(icon.frame.height, 44); XCTAssertGreaterThanOrEqual(icon.frame.width, 44)
    icon.tap(); capture("v38-meal-icon-picker", app)
    let save = app.buttons["Mahlzeitenart speichern"]
    for _ in 0..<5 { if save.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(save.isHittable); save.tap()
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
    edit.tap(); capture("v38-meal-icon-reopened", app)
    // Use the visible save action; the backdrop's accessibility frame includes
    // covered content and cannot serve as a reliable large-text dismiss target.
    for _ in 0..<5 { if save.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(save.isHittable); save.tap()
    let sheetDismissed = NSPredicate { _, _ in !app.buttons["Mahlzeitenart speichern"].exists }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: sheetDismissed, object: app)], timeout: 10), .completed)
    for _ in 0..<4 {
      if app.buttons["Mehr"].exists { break }
      app.buttons["Zurück"].firstMatch.tap()
      Thread.sleep(forTimeInterval: 0.5)
    }
    let more = app.buttons["Mehr"]
    XCTAssertTrue(more.waitForExistence(timeout: 10)); more.tap()
    let plans = app.descendants(matching: .any)["more-training-plans"]
    for _ in 0..<6 { if plans.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(plans.isHittable); plans.tap()
    let editPlan = app.buttons["Bearbeiten"].firstMatch
    XCTAssertTrue(editPlan.waitForExistence(timeout: 10)); editPlan.tap()
    let name = app.textFields["weekly-plan-name"]
    XCTAssertTrue(name.waitForExistence(timeout: 10)); name.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
    let start = app.buttons["weekly-plan-start-date"]
    // At accessibility sizes the date row is below the keyboard. Drag the
    // form's visible content to dismiss it rather than tapping through it.
    if start.frame.maxY >= app.keyboards.firstMatch.frame.minY {
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.35)).press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.68)))
      XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: keyboardGone, object: app)], timeout: 10), .completed)
    }
    for _ in 0..<6 { if start.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(start.isHittable); start.tap()
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: keyboardGone, object: app)], timeout: 10), .completed)
    capture("v38-plan-calendar", app)
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.1)).tap()
    XCTAssertTrue(start.waitForExistence(timeout: 10))
    capture("v38-plan-date-controls", app)
    verifyWorkoutPlanTime(app)
  }

  func testWorkoutPlanTime() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let more = app.buttons["Mehr"]
    XCTAssertTrue(more.waitForExistence(timeout: 10)); more.tap()
    let plans = app.descendants(matching: .any)["more-training-plans"]
    for _ in 0..<6 { if plans.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(plans.isHittable); plans.tap()
    let edit = app.buttons["Bearbeiten"].firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 10)); edit.tap()
    verifyWorkoutPlanTime(app)
  }

  private func verifyWorkoutPlanTime(_ app: XCUIApplication) {
    let time = app.buttons["weekly-plan-time"].firstMatch
    for _ in 0..<12 { if time.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(time.isHittable)
    XCTAssertGreaterThanOrEqual(time.frame.height, 44)
    time.tap()
    XCTAssertFalse(app.keyboards.firstMatch.exists)
    let timeDone = app.buttons["Erledigt"].firstMatch
    let hasTimeDone = timeDone.waitForExistence(timeout: 10)
    capture("v38-plan-time-picker", app)
    XCTAssertTrue(hasTimeDone)
    let hours = app.buttons["Stunden"].firstMatch
    let hasTimeSelectors = hours.exists
    if hasTimeSelectors {
      hours.tap()
      let hour = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "08")).firstMatch
      XCTAssertTrue(hour.waitForExistence(timeout: 10))
      let options = app.descendants(matching: .any)["timesheet-options"].firstMatch
      XCTAssertTrue(options.waitForExistence(timeout: 10))
      scrollTimeOption(hour, in: options)
      XCTAssertTrue(hour.isHittable); hour.tap()
      XCTAssertTrue(timeDone.waitForExistence(timeout: 10))
      app.buttons["Minuten"].firstMatch.tap()
      let minute = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "05")).firstMatch
      XCTAssertTrue(minute.waitForExistence(timeout: 10))
      XCTAssertTrue(options.waitForExistence(timeout: 10))
      scrollTimeOption(minute, in: options)
      XCTAssertTrue(minute.isHittable); minute.tap()
      XCTAssertTrue(timeDone.waitForExistence(timeout: 10))
      capture("v38-plan-time-selected", app)
    }
    timeDone.tap()
    let timeDismissed = NSPredicate { _, _ in !app.buttons["Erledigt"].exists }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: timeDismissed, object: app)], timeout: 10), .completed)
    if hasTimeSelectors { XCTAssertEqual(time.value as? String, "08:05") }
    let clearTime = app.buttons["weekly-plan-clear-time"].firstMatch
    XCTAssertTrue(clearTime.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(clearTime.frame.height, 44)
    clearTime.tap()
    XCTAssertFalse(clearTime.exists)
    capture("v38-plan-time-controls", app)
  }

  private func scrollTimeOption(_ option: XCUIElement, in list: XCUIElement) {
    for _ in 0..<12 {
      if option.isHittable { return }
      let below = option.frame.midY > list.frame.midY
      let start = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: below ? 0.75 : 0.25))
      let end = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: below ? 0.35 : 0.65))
      start.press(forDuration: 0.1, thenDragTo: end)
    }
  }

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
    let picker = app.buttons["food-entry-unit-picker"]
    XCTAssertTrue(picker.isHittable)
    picker.tap()
    let portion = app.buttons.matching(NSPredicate(format: "label IN %@", ["1 Portion (21,5 g)", "1 serving (21.5 g)"])).firstMatch
    XCTAssertTrue(portion.waitForExistence(timeout: 10))
    capture("food-serving-options", app)
    portion.tap()
    wheel.tap()
    let amountInput = app.textFields["food-entry-amount-input"]
    XCTAssertTrue(amountInput.waitForExistence(timeout: 10))
    replace(amountInput, with: "2")
    app.descendants(matching: .any)["keyboard-action-done"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let totalWeight = app.staticTexts["food-entry-amount-weight"]
    XCTAssertTrue(totalWeight.waitForExistence(timeout: 10))
    XCTAssertTrue(totalWeight.label.contains("43 g"))
    capture("food-serving-two-portions", app)
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
  func testWellnessLogging() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.cg.phi")
    app.activate()
    XCTAssertTrue(app.otherElements["dashboard-scroll"].waitForExistence(timeout: 30))
    let more = app.buttons.matching(NSPredicate(format: "label IN %@", ["More", "Mehr"])).firstMatch
    more.tap()
    let wellness = app.descendants(matching: .any)["more-wellness"]
    for _ in 0..<6 { if wellness.exists && wellness.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(wellness.waitForExistence(timeout: 10))
    capture("wellness-more", app)
    wellness.tap()
    let sauna = app.buttons.matching(NSPredicate(format: "label IN %@", ["Log Sauna", "Sauna erfassen"])).firstMatch
    XCTAssertTrue(sauna.waitForExistence(timeout: 10))
    for _ in 0..<12 {
      if sauna.isHittable { break }
      let above = sauna.frame.midY < app.frame.midY
      let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: above ? 0.45 : 0.7))
      let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: above ? 0.7 : 0.45))
      start.press(forDuration: 0.05, thenDragTo: end)
    }
    XCTAssertTrue(sauna.isHittable)
    XCTAssertGreaterThanOrEqual(sauna.frame.height, 44)
    capture("wellness-empty", app)
    sauna.tap()
    let undo = app.buttons.matching(NSPredicate(format: "label IN %@", ["Remove Sauna from this day", "Sauna für diesen Tag entfernen"])).firstMatch
    XCTAssertTrue(undo.waitForExistence(timeout: 10))
    capture("wellness-logged", app)
    let history = app.buttons.matching(NSPredicate(format: "label IN %@", ["History · last 30 days", "Verlauf · letzte 30 Tage"])).firstMatch
    for _ in 0..<5 { if history.isHittable { break }; app.swipeUp() }
    history.tap()
    capture("wellness-history", app)
    app.buttons["wellness-back"].tap()
    let diary = app.buttons.matching(NSPredicate(format: "label IN %@", ["Diary", "Tagebuch"])).firstMatch
    diary.tap()
    XCTAssertTrue(undo.waitForExistence(timeout: 10))
    for _ in 0..<10 { if undo.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(undo.isHittable)
    XCTAssertFalse(sauna.exists)
    XCTAssertFalse(app.textFields["wellness-name"].exists)
    capture("wellness-diary", app)
    undo.tap()
    let disappeared = NSPredicate(format: "exists == false")
    expectation(for: disappeared, evaluatedWith: undo)
    waitForExpectations(timeout: 10)
    capture("wellness-after-undo", app)
  }

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
    // Summary cards can grow with task counts and text size; find the actions
    // rather than assuming that three downward swipes leave them visible.
    for _ in 0..<8 {
      if food.isHittable && food.frame.maxY < app.frame.maxY - 140 { break }
      dashboard.swipeUp(velocity: .slow)
    }
    XCTAssertTrue(food.isHittable)
    XCTAssertGreaterThanOrEqual(food.frame.height, 44)
    XCTAssertGreaterThanOrEqual(food.frame.width, 44)
    for identifier in ["dashboard-food", "dashboard-exercise-running", "dashboard-water", "dashboard-scan"] {
      let action = app.buttons[identifier]
      XCTAssertTrue(action.isHittable)
      XCTAssertGreaterThanOrEqual(action.frame.height, 44)
      XCTAssertGreaterThanOrEqual(action.frame.width, 44)
    }
    capture("dashboard-quick-actions", app)
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
