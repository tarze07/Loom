import { SourceControlProviderError, SourceControlProviderKind } from "@loom/contracts";
import * as Cause from "effect/Cause";
import { describe, expect, it } from "vite-plus/test";

import { isSourceControlUnavailableCause } from "./sourceControlUnavailable.ts";

const wrapped = (provider: string, cause: unknown) =>
  Cause.fail(
    new SourceControlProviderError({
      provider: SourceControlProviderKind.make(provider),
      operation: "listChangeRequests",
      cwd: "/repo",
      detail: "Lookup failed.",
      cause,
    }),
  );

describe("isSourceControlUnavailableCause", () => {
  it.each([
    ["github", { _tag: "GitHubCliMissingError" }],
    ["github", { _tag: "GitHubNotSignedInError" }],
    ["github", { _tag: "GitHubHostDisabledError" }],
    ["github", { _tag: "GitHubApiAuthenticationError" }],
    ["gitlab", { _tag: "GitLabCliUnavailableError" }],
    ["gitlab", { _tag: "GitLabCliAuthenticationError" }],
    ["azure-devops", { _tag: "AzureDevOpsCliUnavailableError" }],
    ["azure-devops", { _tag: "AzureDevOpsCliAuthenticationError" }],
    ["gitcafe", { _tag: "GitCafeCliMissingError" }],
    ["gitcafe", { _tag: "GitCafeNotSignedInError" }],
    ["forgejo", { _tag: "ForgejoCliError", reason: "missing-cli" }],
    ["forgejo", { _tag: "ForgejoCliError", reason: "authentication" }],
    ["bitbucket", { _tag: "BitbucketResponseError", status: 401 }],
    ["bitbucket", { _tag: "SettingsSecretUnresolvedError" }],
  ])("treats a wrapped %s %j as not set up", (provider, cause) => {
    expect(isSourceControlUnavailableCause(wrapped(provider, cause))).toBe(true);
  });

  it.each([
    ["github", new Error("ETIMEDOUT")],
    ["github", { _tag: "GitHubApiRateLimitError" }],
    ["forgejo", { _tag: "ForgejoCliError", reason: "not-found" }],
    ["bitbucket", { _tag: "BitbucketResponseError", status: 500 }],
  ])("keeps a real %s failure %s a failure", (provider, cause) => {
    expect(isSourceControlUnavailableCause(wrapped(provider, cause))).toBe(false);
  });
});
