Pod::Spec.new do |s|
  s.name = 'LoomVoiceTranscription'
  s.version = '1.0.0'
  s.summary = 'Local recording conversion for Loom dictation.'
  s.author = 'Loom'
  s.homepage = 'https://loom.com'
  s.platform = :ios, '18.0'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.frameworks = 'AudioToolbox'
end
