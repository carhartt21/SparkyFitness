Pod::Spec.new do |s|
  s.name = 'PresentationCapabilitiesModule'
  s.version = '1.0.0'
  s.summary = 'Reports Live Activity authorization for X on Track.'
  s.author = 'X on Track'
  s.homepage = 'https://github.com/CodeWithCJ/SparkyFitness'
  s.platforms = { :ios => '15.1' }
  s.source = { git: '' }
  s.static_framework = true
  s.license = 'AGPL-3.0'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
