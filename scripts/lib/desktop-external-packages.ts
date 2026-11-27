/** Keep bundler externals aligned with the staged production dependency list. */
const DESKTOP_RUNTIME_EXTERNAL_PREFIXES = [
  "@napi-rs/keyring",
  "@crowecawcaw/xa11y",
  "electron-webauthn",
  "ffi-rs",
  "@yuuang/",
  // Playwright reads its runtime bundle/driver from disk; inlining cannot replace those files.
  "playwright-core",
] as const;

export function isDesktopRuntimeExternalDependency(id: string): boolean {
  return DESKTOP_RUNTIME_EXTERNAL_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export interface DesktopRuntimeExternalSelectionOptions {
  readonly profile?: "full" | "minimal";
  readonly platform?: "mac" | "linux" | "win";
}

// In minimal/corporate desktop builds, optional native addons (keyring, xa11y,
// webauthn, playwright-core) are omitted; Windows keeps ffi-rs for GPO registry reading.
const WINDOWS_MINIMAL_DESKTOP_EXTERNAL_PREFIXES = ["ffi-rs", "@yuuang/"] as const;

export function selectDesktopRuntimeExternalDependencies(
  dependencies: Readonly<Record<string, string>>,
  options?: DesktopRuntimeExternalSelectionOptions,
): Record<string, string> {
  const profile = options?.profile ?? "full";
  if (profile === "minimal") {
    if (options?.platform !== "win") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(dependencies).filter(([name]) =>
        WINDOWS_MINIMAL_DESKTOP_EXTERNAL_PREFIXES.some((prefix) => name.startsWith(prefix)),
      ),
    );
  }
  return Object.fromEntries(
    Object.entries(dependencies).filter(([name]) => isDesktopRuntimeExternalDependency(name)),
  );
}
