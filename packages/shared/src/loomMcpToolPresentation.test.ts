import { describe, expect, it } from "vite-plus/test";

import {
  LOOM_MCP_TOOL_NAMES,
  resolveLoomMcpSummaryAction,
  resolveLoomMcpToolDefinition,
  resolveLoomMcpToolPresentation,
} from "./loomMcpToolPresentation.ts";

describe("resolveLoomMcpToolPresentation", () => {
  it("recognizes every Loom tool across provider prefixes and completion suffixes", () => {
    for (const tool of LOOM_MCP_TOOL_NAMES) {
      const presentation = resolveLoomMcpToolPresentation(tool);
      for (const prefix of [
        "mcp__loom__",
        "mcp__loom__",
        "mcp__loom__",
        "Loom-code.",
        "loom.",
        "loom-direct.",
        "mcp__loom_direct__",
        "loom/",
        "loom:",
        "mcp_loom_",
        "Loom ",
        "loom · ",
      ]) {
        expect(resolveLoomMcpToolPresentation(`${prefix}${tool} completed`), tool).toEqual(
          presentation,
        );
      }
      expect(resolveLoomMcpToolPresentation(`mcp__another-server__${tool}`), tool).toBeNull();
    }
  });

  it("matches OpenCode 2's per-thread server names, whose thread ids hold underscores", () => {
    expect(
      resolveLoomMcpToolPresentation("loom-thread_opencode2-adapter_delegate_task")?.displayName,
    ).toBe("Delegate a child task");
    expect(resolveLoomMcpToolPresentation("loom-thread_opencode2-adapter_not_a_tool")).toBeNull();
  });
});

describe("resolveLoomMcpToolDefinition", () => {
  it("labels an action tool call as the action it ran", () => {
    expect(
      resolveLoomMcpToolDefinition("mcp__loom__preview_act", { action: "type" })?.labels,
    ).toEqual(resolveLoomMcpToolDefinition("preview_type")?.labels);
    expect(
      resolveLoomMcpToolDefinition("loom_thread_transfer", { action: "fork" })?.displayName,
    ).toBe(resolveLoomMcpToolDefinition("loom_thread_fork")?.displayName);
    expect(resolveLoomMcpToolDefinition("preview_act", { action: "unknown" })?.labels[2]).toBe(
      "Used",
    );
  });
});

describe("resolveLoomMcpSummaryAction", () => {
  it("summarizes an action tool by the action each call ran", () => {
    expect(resolveLoomMcpSummaryAction("mcp__loom__t3_queue", { action: "list" })).toBe(
      "queue-list",
    );
    expect(resolveLoomMcpSummaryAction("loom_queue", { action: "edit" })).toBe("queue-edit");
    expect(resolveLoomMcpSummaryAction("loom_thread_transfer", { action: "status" })).toBe(
      "thread-transfers",
    );
    expect(resolveLoomMcpSummaryAction("loom_thread_configure", {})).toBe("thread-configuration");
    expect(resolveLoomMcpSummaryAction("schedule_task", { scheduledTaskId: "task-1" })).toBe(
      "schedule-update",
    );
    expect(resolveLoomMcpSummaryAction("delegate_task", { task: "x" })).toBe("delegate");
  });
});
