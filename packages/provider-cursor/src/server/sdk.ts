// @effect-diagnostics nodeBuiltinImport:off -- The SDK must load from disk beside its Webpack chunks.
import * as NodeModule from "node:module";

// createRequire preserves adjacent Webpack chunks and native modules in bundled/SEA builds.
const requireCursorSdk = NodeModule.createRequire(import.meta.url);
let sdk: typeof import("@cursor/sdk") | undefined;
let sqlite: typeof import("@cursor/sdk/sqlite") | undefined;

function loadCursorModule<T>(specifier: string): T {
  try {
    return requireCursorSdk(specifier) as T;
  } catch (cause) {
    const code = (cause as { readonly code?: unknown } | null)?.code;
    if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        `Cursor SDK is not included in this minimal Loom build (${specifier} is not installed).`,
        { cause },
      );
    }
    throw cause;
  }
}

export function loadCursorSdk(): typeof import("@cursor/sdk") {
  if (sdk !== undefined) return sdk;
  const start = performance.now();
  sdk = loadCursorModule<typeof import("@cursor/sdk")>("@cursor/sdk");
  if (process.env.LOOM_STARTUP_PROFILE_DIR) {
    performance.measure("provider.cursor.importSdk", { start });
  }
  return sdk;
}

export function loadCursorSqlite(): typeof import("@cursor/sdk/sqlite") {
  if (sqlite !== undefined) return sqlite;
  const start = performance.now();
  sqlite = loadCursorModule<typeof import("@cursor/sdk/sqlite")>("@cursor/sdk/sqlite");
  if (process.env.LOOM_STARTUP_PROFILE_DIR) {
    performance.measure("provider.cursor.importSqliteStore", { start });
  }
  return sqlite;
}

// Error classification must not initialize the SDK when the load itself failed.
export function isCursorSdkError<
  K extends "AuthenticationError" | "ConfigurationError" | "CursorSdkError",
>(cause: unknown, kind: K): cause is InstanceType<(typeof import("@cursor/sdk"))[K]> {
  return sdk !== undefined && cause instanceof sdk[kind];
}
