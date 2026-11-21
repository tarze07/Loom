#pragma once

#include <react/renderer/components/LoomSourceTextSpec/EventEmitters.h>
#include <react/renderer/components/LoomSourceTextSpec/Props.h>
#include <react/renderer/components/LoomSourceTextSpec/States.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>

namespace facebook::react {
extern const char LoomSourceTextRunComponentName[];

using LoomSourceTextRunShadowNode =
    ConcreteViewShadowNode<LoomSourceTextRunComponentName, LoomSourceTextRunProps,
                           LoomSourceTextRunEventEmitter, LoomSourceTextRunState>;
} // namespace facebook::react
