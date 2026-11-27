/** Keep bundler externals and staged runtime dependency roots aligned. */
// Filesystem-loaded externals need dependencies outside the bundle.
const CLI_RUNTIME_EXTERNAL_PREFIXES = [
  // Cursor ships computed Webpack imports and platform helper packages.
  "@cursor/sdk",
  // Playwright reads package.json and browsers.json beside its runtime modules.
  "playwright-core",
  "node-pty",
  "ffi-rs",
  "@yuuang/",
  "@ff-labs/",
  "transcribe-cpp",
  "@transcribe-cpp/",
  "koffi",
  "@koromix/",
  "@napi-rs/keyring",
  "node-gyp-build",
  "node-addon-api",
  "bufferutil",
  "utf-8-validate",
] as const;

// Match Cursor dependency boundaries so zod does not externalize zod-to-json-schema.
const CURSOR_RUNTIME_DEPENDENCIES = [
  "@bufbuild/protobuf",
  "@connectrpc/connect",
  "@connectrpc/connect-node",
  "@connectrpc/connect-web",
  "@statsig/js-client",
  "@statsig/client-core",
  "zod",
  "undici",
  "@fastify/busboy",
] as const;

export function isRuntimeExternalCliDependency(id: string): boolean {
  return (
    CLI_RUNTIME_EXTERNAL_PREFIXES.some((prefix) => id.startsWith(prefix)) ||
    CURSOR_RUNTIME_DEPENDENCIES.some((name) => id === name || id.startsWith(`${name}/`))
  );
}

/** Use neverBundle: false from alwaysBundle means no opinion and leaves transitive packages bundled. */
export function isExternalCliDependency(id: string): boolean {
  return isRuntimeExternalCliDependency(id);
}

export function shouldBundleCliDependency(id: string): boolean {
  if (id.startsWith("node:")) return false;
  return !isExternalCliDependency(id);
}

export type RuntimeBuildProfile = "full" | "minimal";
export type RuntimeTargetPlatform = "mac" | "linux" | "win";

export interface CliRuntimeExternalSelectionOptions {
  readonly profile?: RuntimeBuildProfile;
  readonly platform?: RuntimeTargetPlatform;
}

// Core native packages retained in minimal/corporate builds. Optional modules
// (playwright-core, transcribe-cpp, @cursor/sdk, @napi-rs/keyring, etc.) remain
// external to the bundler and degrade gracefully when absent on disk.
const MINIMAL_CLI_RUNTIME_EXTERNAL_PREFIXES = ["node-pty", "@ff-labs/"] as const;
const WINDOWS_MINIMAL_CLI_RUNTIME_EXTERNAL_PREFIXES = ["ffi-rs", "@yuuang/"] as const;

export function isMinimalCliRuntimeExternalDependency(
  id: string,
  platform?: RuntimeTargetPlatform,
): boolean {
  if (MINIMAL_CLI_RUNTIME_EXTERNAL_PREFIXES.some((prefix) => id.startsWith(prefix))) {
    return true;
  }
  if (
    platform === "win" &&
    WINDOWS_MINIMAL_CLI_RUNTIME_EXTERNAL_PREFIXES.some((prefix) => id.startsWith(prefix))
  ) {
    return true;
  }
  return false;
}

export function selectCliRuntimeExternalDependencies(
  dependencies: Readonly<Record<string, string>>,
  options?: CliRuntimeExternalSelectionOptions,
): Record<string, string> {
  const profile = options?.profile ?? "full";
  if (profile === "minimal") {
    return Object.fromEntries(
      Object.entries(dependencies).filter(([name]) =>
        isMinimalCliRuntimeExternalDependency(name, options?.platform),
      ),
    );
  }
  return Object.fromEntries(
    Object.entries(dependencies).filter(([name]) => isRuntimeExternalCliDependency(name)),
  );
}

/** regionCount distinguishes a clean bundle from a changed marker format the scan cannot see. */
export function findInlinedExternalPackages(source: string): {
  readonly regionCount: number;
  readonly inlined: ReadonlyArray<string>;
  readonly inlinedPackages: ReadonlyArray<string>;
} {
  // Rolldown marks each inlined module with a `//#region <path>` line; newer
  // releases (vite-plus 1.4) emit a bare `// <path>` line instead.
  const regionPattern = /^\/\/(?:#region)?[ \t]+(\S+)[ \t]*$/gm;
  const packagePattern = /node_modules\/((?:@[^/\s]+\/)?[^/\s]+)\//g;

  let regionCount = 0;
  const inlined = new Set<string>();
  const inlinedPackages = new Set<string>();
  for (const region of source.matchAll(regionPattern)) {
    regionCount += 1;
    const regionPath = region[1] ?? "";
    for (const candidate of regionPath.matchAll(packagePattern)) {
      const name = candidate[1];
      if (name === undefined || name === ".pnpm") continue;
      inlinedPackages.add(name);
      if (isExternalCliDependency(name)) inlined.add(name);
    }
  }

  return {
    regionCount,
    inlined: [...inlined].sort(),
    inlinedPackages: [...inlinedPackages].sort(),
  };
}
