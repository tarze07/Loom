import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { LoomProjectFile, LOOM_PROJECT_FILE_SCHEMA_URL } from "@loom/contracts";

import { fromLenientJson } from "./schemaJson.ts";

export const LoomProjectFileFromJson = fromLenientJson(LoomProjectFile);

const decodeLoomProjectFile = Schema.decodeExit(LoomProjectFileFromJson);

export function parseLoomProjectFile(contents: string): LoomProjectFile | null {
  const decoded = decodeLoomProjectFile(contents);
  return Exit.isSuccess(decoded) ? decoded.value : null;
}

export function buildLoomProjectFileJsonSchema(): Record<string, unknown> {
  const document = Schema.toJsonSchemaDocument(LoomProjectFile, { onExcessProperty: "error" });
  const jsonSchema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: LOOM_PROJECT_FILE_SCHEMA_URL,
    ...document.schema,
  };
  if (document.definitions && Object.keys(document.definitions).length > 0) {
    jsonSchema.$defs = document.definitions;
  }
  return jsonSchema;
}
