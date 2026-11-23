import { resolveFilesystemReadAccess } from "@loom/client-runtime/state/filesystem";
import { isScratchProject } from "@loom/client-runtime/state/projects";
import type { EnvironmentProject } from "@loom/client-runtime/state/shell";
import type { ProjectReadFileResult } from "@loom/contracts";
import { DEFAULT_SERVER_SETTINGS, LOOM_PROJECT_FILE_NAME } from "@loom/contracts";
import { resolveNewThreadEnvMode, resolveProjectSettings } from "@loom/shared/projectSettings";
import { parseLoomProjectFile } from "@loom/shared/loomProjectFile";

import { useEnvironmentServerConfig } from "../../state/entities";
import { useEnvironmentPresentation } from "../../state/presentation";
import { useProjectHasThreads } from "../../state/project-has-threads";
import { projectEnvironment } from "../../state/projects";
import { useEnvironmentQuery } from "../../state/query";
import { environmentSession } from "../../state/session";

/**
 * A project's new-task defaults: server settings merged with its loom.json. The
 * new-task flow and the home pending-drafts list both read the default
 * workspace mode here, so a draft that never picked one shows what it sends.
 * Every read is a shared per-environment or per-project atom.
 */
export function useNewTaskProjectDefaults(project: EnvironmentProject | null) {
  const serverConfig = useEnvironmentServerConfig(project?.environmentId ?? null);
  const isScratch =
    project !== null && isScratchProject(project, serverConfig?.scratchWorkspaceRoot);
  const hasWorkspace = project !== null && project.workspaceRoot !== "";
  const fileAccessSession = useEnvironmentQuery(
    hasWorkspace ? environmentSession.sessionStateAtom(project.environmentId) : null,
  );
  const fileEnvironment = useEnvironmentPresentation(project?.environmentId ?? null);
  const fileAccess = resolveFilesystemReadAccess({
    isCatalogReady: fileEnvironment.isReady,
    connection: fileEnvironment.presentation?.connection ?? null,
    session: fileAccessSession.data,
    sessionError: fileAccessSession.error,
  });
  const fileAccessPending = hasWorkspace && fileAccess.isPending;
  const loomProjectFileQuery = useEnvironmentQuery(
    fileAccess.canReadFiles && hasWorkspace
      ? projectEnvironment.readFile({
          environmentId: project.environmentId,
          input: {
            cwd: project.workspaceRoot,
            relativePath: LOOM_PROJECT_FILE_NAME,
            allowMissing: true,
          },
        })
      : null,
  );
  const loomProjectFileData = loomProjectFileQuery.data as ProjectReadFileResult | null;
  const loomProjectFile =
    loomProjectFileData === null ||
    loomProjectFileData.exists === false ||
    loomProjectFileData.truncated
      ? null
      : parseLoomProjectFile(loomProjectFileData.contents);
  const projectSettings = resolveProjectSettings(
    serverConfig?.settings ?? DEFAULT_SERVER_SETTINGS,
    project?.id ?? null,
    project,
    loomProjectFile,
  );
  const projectHasThreads = useProjectHasThreads(project);
  const defaultWorkspaceMode = isScratch
    ? "local"
    : resolveNewThreadEnvMode({
        projectSettings,
        workspaceRoot: project?.workspaceRoot ?? null,
        newProjectsRoot: serverConfig?.newProjectsRoot,
        projectHasThreads,
      });
  // While loom.json loads, the environment default is provisional; loom.json may replace it.
  const defaultWorkspaceModeSettled =
    projectSettings.sources.defaultThreadEnvMode !== "environment" ||
    (!loomProjectFileQuery.isPending && !fileAccessPending);
  return {
    serverConfig,
    isScratch,
    projectSettings,
    defaultWorkspaceMode,
    defaultWorkspaceModeSettled,
  };
}
