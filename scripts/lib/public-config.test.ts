// @effect-diagnostics nodeBuiltinImport:off - Tests exercise root env file precedence directly.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { loadRepoEnv } from "./public-config.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    NodeFS.rmSync(directory, { recursive: true, force: true });
  }
});

describe("loadRepoEnv", () => {
  it("applies process, root local, and root precedence in that order", () => {
    const repoRoot = makeTemporaryDirectory();
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env"),
      "LOOM_SHARED=value_root\nLOOM_ROOT_ONLY=root\n",
    );
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env.local"),
      "LOOM_SHARED=value_local\nLOOM_LOCAL_ONLY=local\n",
    );

    expect(loadRepoEnv({ baseEnv: {}, repoRoot })).toMatchObject({
      LOOM_SHARED: "value_local",
      LOOM_ROOT_ONLY: "root",
      LOOM_LOCAL_ONLY: "local",
    });
    expect(
      loadRepoEnv({
        baseEnv: { LOOM_SHARED: "value_ci" },
        repoRoot,
      }).LOOM_SHARED,
    ).toBe("value_ci");
  });
});

function makeTemporaryDirectory() {
  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "loom-public-config-"));
  temporaryDirectories.push(directory);
  return directory;
}
