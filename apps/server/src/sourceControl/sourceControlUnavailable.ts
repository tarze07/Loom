import * as Cause from "effect/Cause";

// Each provider package keeps its errors private, so they are named by tag. Keep one entry per
// provider error that means "not set up here" (no CLI, no credential, host turned off).
const UNAVAILABLE_TAGS: ReadonlySet<string> = new Set([
  "GitHubCliMissingError",
  "GitHubNotSignedInError",
  "GitHubHostDisabledError",
  "GitHubApiAuthenticationError",
  "GitLabCliUnavailableError",
  "GitLabCliAuthenticationError",
  "AzureDevOpsCliUnavailableError",
  "AzureDevOpsCliAuthenticationError",
  "GitCafeCliMissingError",
  "GitCafeNotSignedInError",
  "SettingsSecretUnresolvedError",
]);

interface TaggedRecord {
  readonly _tag?: unknown;
  readonly cause?: unknown;
  readonly reason?: unknown;
  readonly status?: unknown;
}

function isUnavailableError(error: unknown, depth: number): boolean {
  if (typeof error !== "object" || error === null || depth > 8) return false;
  const record = error as TaggedRecord;
  switch (record._tag) {
    case "ForgejoCliError":
      if (record.reason === "missing-cli" || record.reason === "authentication") return true;
      break;
    case "BitbucketResponseError":
      if (record.status === 401) return true;
      break;
    default:
      if (typeof record._tag === "string" && UNAVAILABLE_TAGS.has(record._tag)) return true;
  }
  return isUnavailableError(record.cause, depth + 1);
}

/** Source control failed because it is not set up on this server, not because a lookup broke. */
export function isSourceControlUnavailableCause(cause: Cause.Cause<unknown>): boolean {
  return isUnavailableError(Cause.squash(cause), 0);
}
