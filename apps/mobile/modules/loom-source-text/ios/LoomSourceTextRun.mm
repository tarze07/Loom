#import "LoomSourceTextRun.h"
#import <React/RCTFabricComponentsPlugins.h>
#import "LoomSourceTextRunComponentDescriptor.h"
#import <react/renderer/components/LoomSourceTextSpec/Props.h>
#import <react/renderer/components/LoomSourceTextSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface LoomSourceTextRun () <RCTT3SourceTextRunViewProtocol>

@end

@implementation LoomSourceTextRun {
  NSString *_text;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
      LoomSourceTextRunComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const LoomSourceTextRunProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<LoomSourceTextRunProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<LoomSourceTextRunProps const>(props);

  if (newViewProps.text != oldViewProps.text) {
    NSString *text = [NSString stringWithUTF8String:newViewProps.text.c_str()];
    _text = text;
  }

  [super updateProps:props oldProps:oldProps];
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

Class<RCTComponentViewProtocol> LoomSourceTextRunCls(void) {
  return LoomSourceTextRun.class;
}

@end
