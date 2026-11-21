import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { parseLoomProjectFile, LoomProjectFileFromJson } from "./loomProjectFile.ts";

const decodeJson = Schema.decodeUnknownSync(LoomProjectFileFromJson);

describe("LoomProjectFileFromJson", () => {
  it("decodes lenient JSONC with comments and trailing commas", () => {
    const decoded = decodeJson(`{
      // team scripts
      "iconPath": "assets/logo.svg",
      "scripts": [
        { "name": "Dev", "command": "pnpm dev", "stopOnSettle": true, },
      ],
    }`);

    expect(decoded.iconPath).toBe("assets/logo.svg");
    expect(decoded.scripts?.[0]).toEqual({ name: "Dev", command: "pnpm dev", stopOnSettle: true });
  });
});

describe("parseLoomProjectFile", () => {
  it("reads project defaults from JSONC with a URL in a block comment", () => {
    expect(
      parseLoomProjectFile(`{
        /* See https://loom.local/schema/loom.json */
        "defaultThreadEnvMode": "worktree"
      }`),
    ).toEqual({ defaultThreadEnvMode: "worktree" });
  });
});
