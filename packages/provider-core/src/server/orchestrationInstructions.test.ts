import { assert, describe, it } from "@effect/vitest";

import {
  LOOM_DEVICE_TOOL_INSTRUCTIONS,
  LOOM_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH,
  LOOM_ORCHESTRATION_INSTRUCTIONS,
  loomAcpPromptWithInstructions,
  loomOrchestrationPrompt,
  loomOrchestrationSystemPrompt,
} from "./orchestrationInstructions.ts";

describe("Loom device instructions", () => {
  it("route device work through device_open and give Claude the line that loads the tools", () => {
    for (const intent of ["`device_list`", "`device_open`", "`agent-device`", "ssh", "`hostId`"]) {
      assert.include(LOOM_DEVICE_TOOL_INSTRUCTIONS, intent);
    }
    assert.notInclude(LOOM_DEVICE_TOOL_INSTRUCTIONS, "ToolSearch");
    const loadLine =
      " Load them with ToolSearch `select:mcp__loom__device_list,mcp__loom__device_open,mcp__loom__device_screenshot,mcp__loom__device_close`.";
    assert.include(LOOM_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH, loadLine);
    assert.equal(
      LOOM_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH.replace(loadLine, ""),
      LOOM_DEVICE_TOOL_INSTRUCTIONS,
    );
  });

  it("open the app before the returned command's snapshots, screenshots and input", () => {
    assert.include(
      LOOM_DEVICE_TOOL_INSTRUCTIONS,
      "its snapshots, screenshots and input need `open <app>` first,",
    );
  });

  it("keep the failure rule from taking over or closing a session another thread holds", () => {
    // agent-device's DEVICE_IN_USE advice is to rerun with the owner's --session or close it first.
    assert.include(
      LOOM_DEVICE_TOOL_INSTRUCTIONS,
      "follow its advice once, but never reuse or close another session; if it still fails,",
    );
  });

  it("reach OpenCode and Cursor only when the session holds device access", () => {
    assert.include(loomOrchestrationSystemPrompt(true, true), LOOM_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(loomOrchestrationSystemPrompt(true, false), "## Loom devices");
    assert.isUndefined(loomOrchestrationSystemPrompt(false, true));

    const firstRun = (hasDeviceTools: boolean) =>
      loomOrchestrationPrompt({
        prompt: "Check the login screen.",
        hasLoomMcp: true,
        hasDeviceTools,
        orchestrationDelivered: false,
        deviceInstructionsDelivered: false,
      });
    assert.include(firstRun(true), LOOM_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(firstRun(false), "## Loom devices");

    const laterRun = (deviceInstructionsDelivered: boolean) =>
      loomOrchestrationPrompt({
        prompt: "Check the login screen.",
        hasLoomMcp: true,
        hasDeviceTools: true,
        orchestrationDelivered: true,
        deviceInstructionsDelivered,
      });
    assert.include(laterRun(false), LOOM_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(laterRun(false), LOOM_ORCHESTRATION_INSTRUCTIONS.trim());
    assert.equal(laterRun(true), "Check the login screen.");
  });

  it("reach ACP agents again when device access changes mid-thread", () => {
    const state = { interactionMode: "default", hasLoomMcp: true, hasDeviceTools: false } as const;
    const withDevices = loomAcpPromptWithInstructions({
      prompt: "Check the login screen.",
      state: { ...state, hasDeviceTools: true },
      previousState: state,
    });
    assert.include(withDevices, LOOM_DEVICE_TOOL_INSTRUCTIONS);
    assert.equal(
      loomAcpPromptWithInstructions({ prompt: "Again.", state, previousState: state }),
      "Again.",
    );
    assert.notInclude(loomAcpPromptWithInstructions({ prompt: "Hi.", state }), "## Loom devices");
  });
});
