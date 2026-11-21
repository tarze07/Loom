import { assert, it } from "@effect/vitest";

import {
  repositoryPathFromRemoteUrl,
  transportSafeSourceControlErrorValue,
} from "./SourceControlProvider.ts";

it("removes URL credentials, query parameters, and fragments from error transport values", () => {
  assert.strictEqual(
    transportSafeSourceControlErrorValue(
      "https://user:secret@example.test/org/repo/pull/42?token=secret#discussion",
    ),
    "https://example.test/org/repo/pull/42",
  );
});

it.each([
  ["git@github.com:Loom/loom.git", "Loom/loom"],
  ["github.com:Loom/loom.git", "Loom/loom"],
  ["gitlab.com:Loom/platform/loom", "Loom/platform/loom"],
  ["https://github.com/Loom/loom.git", "Loom/loom"],
  ["https://github.com/Loom/loom.git?view=compact", "Loom/loom"],
  ["https://github.com/Loom/loom.git#section", "Loom/loom"],
  ["C:/repos/loom", null],
])("reads the repository path of %s", (remoteUrl, expected) => {
  assert.strictEqual(repositoryPathFromRemoteUrl(remoteUrl), expected);
});
