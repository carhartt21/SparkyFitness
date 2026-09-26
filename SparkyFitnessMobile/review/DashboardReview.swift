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
  }
  private func capture(_ name: String, _ app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
