import { LOOM_PROJECT_FILE_NAME, type EnvironmentId, type LoomProjectFile } from "@loom/contracts";
import { parseLoomProjectFile } from "@loom/shared/loomProjectFile";
import { executeAtomQuery } from "@loom/client-runtime/state/runtime";

import {
  getProjectFileQueryAtom,
  resolveProjectFileQueryData,
} from "~/components/files/projectFilesQueryState";
import { appAtomRegistry } from "~/rpc/atomRegistry";

export async function readLoomProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
): Promise<LoomProjectFile | null> {
  const result = await executeAtomQuery(
    appAtomRegistry,
    getProjectFileQueryAtom(environmentId, workspaceRoot, LOOM_PROJECT_FILE_NAME),
    { reportDefect: false, reportFailure: false },
  );
  const data = resolveProjectFileQueryData(
    environmentId,
    workspaceRoot,
    LOOM_PROJECT_FILE_NAME,
    result._tag === "Success" ? result.value : null,
  );
  if (data === null || data.exists === false || data.truncated) return null;
  return parseLoomProjectFile(data.contents);
}
