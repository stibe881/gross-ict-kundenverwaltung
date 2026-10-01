Pod::Spec.new do |s|
  s.name           = 'TapToPayEducation'
  s.version        = '1.0.0'
  s.summary        = 'Apple ProximityReaderDiscovery merchant education for Tap to Pay on iPhone'
  s.description    = 'Zeigt die von Apple bereitgestellte Haendler-Anleitung (How to Tap) an.'
  s.author         = 'Gross ICT'
  s.homepage       = 'https://gross-ict.ch'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
end
