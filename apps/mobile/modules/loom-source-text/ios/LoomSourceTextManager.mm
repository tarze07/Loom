#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface LoomSourceTextManager : RCTViewManager
@end

@implementation LoomSourceTextManager

RCT_EXPORT_MODULE(LoomSourceText)

- (UIView *)view {
  return [[UIView alloc] init];
}

@end

@interface LoomSourceTextRunManager : RCTViewManager
@end

@implementation LoomSourceTextRunManager

RCT_EXPORT_MODULE(LoomSourceTextRun)

- (UIView *)view {
  return nil;
}

@end
