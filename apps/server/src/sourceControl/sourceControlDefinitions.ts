import * as AzureDevOpsDriver from "@loom/source-control-azure-devops/server/driver";
import * as BitbucketDriver from "@loom/source-control-bitbucket/server/driver";
import * as CursorOriginDriver from "@loom/source-control-cursor-origin/server/driver";
import { builtInSourceControlDefinitions } from "@loom/source-control-definitions/registry";
import * as ForgejoDriver from "@loom/source-control-forgejo/server/driver";
import * as GitCafeDriver from "@loom/source-control-gitcafe/server/driver";
import * as GitHubDriver from "@loom/source-control-github/server/driver";
import * as GitLabDriver from "@loom/source-control-gitlab/server/driver";

/** In the shared registry's order, which is the order hosts are listed and probed in. */
export const BUILT_IN_SOURCE_CONTROL_DRIVER_LIST = [
  GitHubDriver.driver,
  CursorOriginDriver.driver,
  GitLabDriver.driver,
  GitCafeDriver.driver,
  ForgejoDriver.driver,
  BitbucketDriver.driver,
  AzureDevOpsDriver.driver,
] as const;

export const sourceControlDefinitions = builtInSourceControlDefinitions;
