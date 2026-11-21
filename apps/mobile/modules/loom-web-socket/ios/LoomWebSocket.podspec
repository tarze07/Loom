Pod::Spec.new do |s|
  s.name = 'LoomWebSocket'
  s.version = '1.0.0'
  s.summary = 'WebSocket client with permessage-deflate for Loom mobile.'
  s.description = 'React Native ships SocketRocket on iOS, which never negotiates compression. This module dials the Loom server through URLSessionWebSocketTask, which offers permessage-deflate on its own.'
  s.author = 'Loom'
  s.homepage = 'https://loom.com'
  s.platform = :ios, '18.0'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
end
