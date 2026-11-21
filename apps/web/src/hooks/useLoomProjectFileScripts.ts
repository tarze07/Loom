import {
  LOOM_PROJECT_FILE_NAME,
  type EnvironmentId,
  type LoomProjectFile,
  type LoomProjectFileScript,
} from "@loom/contracts";
import { parseLoomProjectFile } from "@loom/shared/loomProjectFile";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";

const NO_SCRIPTS: ReadonlyArray<LoomProjectFileScript> = [];

export interface LoomProjectFileState {
  status: "loading" | "missing" | "invalid" | "valid";
  file: LoomProjectFile | null;
  scripts: ReadonlyArray<LoomProjectFileScript>;
}

export function useLoomProjectFileState(
  environmentId: EnvironmentId,
  cwd: string | null,
): LoomProjectFileState {
  const query = useProjectFileQuery(environmentId, cwd ?? "", LOOM_PROJECT_FILE_NAME, cwd !== null);
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  const isPending = query.isPending;
  if (contents === null) {
    return {
      status: isPending ? "loading" : "missing",
      file: null,
      scripts: NO_SCRIPTS,
    } as const;
  }
  const file = parseLoomProjectFile(contents);
  if (file === null) {
    return { status: "invalid", file: null, scripts: NO_SCRIPTS } as const;
  }
  return { status: "valid", file, scripts: file.scripts ?? NO_SCRIPTS } as const;
}

export function useLoomProjectFileScripts(
  environmentId: EnvironmentId,
  cwd: string | null,
): ReadonlyArray<LoomProjectFileScript> {
  return useLoomProjectFileState(environmentId, cwd).scripts;
}
