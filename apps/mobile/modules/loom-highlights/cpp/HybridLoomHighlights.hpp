#pragma once

#include "HybridLoomHighlightsSpec.hpp"

namespace margelo::nitro::loomhighlights {

class HybridLoomHighlights : public HybridLoomHighlightsSpec {
public:
  HybridLoomHighlights() : HybridObject(TAG) {}

  std::optional<std::shared_ptr<ArrayBuffer>> tokenize(SourceText source,
                                                       double language) override;
};

} // namespace margelo::nitro::loomhighlights
