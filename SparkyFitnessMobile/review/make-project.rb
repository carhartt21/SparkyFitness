# Generates a disposable UI-test project outside the application/native project.
require 'xcodeproj'
require 'fileutils'
out = ARGV.fetch(0)
FileUtils.mkdir_p(out)
project = Xcodeproj::Project.new(File.join(out, 'DashboardReview.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'DashboardReview', :ios, '17.0')
file = project.main_group.new_file(File.expand_path('DashboardReview.swift', __dir__))
target.source_build_phase.add_file_reference(file)
target.build_configurations.each do |config|
  config.build_settings.merge!({ 'PRODUCT_BUNDLE_IDENTIFIER' => 'com.xontrack.simulator-review', 'GENERATE_INFOPLIST_FILE' => 'YES', 'SWIFT_VERSION' => '5.0', 'CODE_SIGNING_ALLOWED' => 'NO', 'TARGETED_DEVICE_FAMILY' => '1', 'SUPPORTED_PLATFORMS' => 'iphonesimulator' })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'DashboardReview')
