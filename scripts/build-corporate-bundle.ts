#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off - NodeCrypto.createHash computes SHA-256 checksums for release files.
/** Assembles a self-contained corporate/air-gapped distribution folder (archives, SHA256SUMS, SBOM, installers, policy template). */
import * as NodeCrypto from "node:crypto";

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { Command, Flag } from "effect/cli";

import { fromYaml } from "@loom/shared/schemaYaml";
import rootPackageJson from "../package.json" with { type: "json" };
import serverPackageJson from "../apps/server/package.json" with { type: "json" };
import desktopPackageJson from "../apps/desktop/package.json" with { type: "json" };

import { resolveFffNativeDependencies } from "./build-desktop-artifact.ts";
import {
  selectCliRuntimeExternalDependencies,
  type RuntimeBuildProfile,
  type RuntimeTargetPlatform,
} from "./lib/cli-external-packages.ts";
import { selectDesktopRuntimeExternalDependencies } from "./lib/desktop-external-packages.ts";
import { resolveCatalogDependencies } from "./lib/resolve-catalog.ts";

const BuildPlatform = Schema.Literals(["linux", "win"]);
const BuildArch = Schema.Literals(["x64", "arm64"]);
const BuildProfile = Schema.Literals(["minimal", "full"]);

const WorkspaceConfig = Schema.Struct({
  catalog: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});
const decodeWorkspaceConfig = Schema.decodeEffect(fromYaml(WorkspaceConfig));
const encodePrettyJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown, { space: 2 }));

const RepoRoot = Effect.service(Path.Path).pipe(
  Effect.flatMap((path) => path.fromFileUrl(new URL("..", import.meta.url))),
);

export class CorporateBundleInputMissingError extends Schema.TaggedError<CorporateBundleInputMissingError>()(
  "CorporateBundleInputMissingError",
  { inputPath: Schema.String },
) {
  override get message(): string {
    return `Missing corporate bundle input: ${this.inputPath}`;
  }
}

export interface CycloneDxComponent {
  readonly type: "library" | "framework";
  readonly name: string;
  readonly version: string;
  readonly purl?: string;
}

export interface CycloneDxSbom {
  readonly bomFormat: "CycloneDX";
  readonly specVersion: "1.5";
  readonly version: 1;
  readonly metadata: {
    readonly component: {
      readonly type: "application";
      readonly name: string;
      readonly version: string;
    };
    readonly properties: ReadonlyArray<{ readonly name: string; readonly value: string }>;
  };
  readonly components: ReadonlyArray<CycloneDxComponent>;
}

/** Generates a minimal CycloneDX 1.5 SBOM for the staged runtime external dependencies. */
export function buildCorporateSbom(input: {
  readonly version: string;
  readonly platform: RuntimeTargetPlatform;
  readonly arch: "x64" | "arm64";
  readonly profile: RuntimeBuildProfile;
  readonly nodeVersion: string;
  readonly externalDependencies: Readonly<Record<string, string>>;
  readonly includeDesktopElectronVersion?: string;
}): CycloneDxSbom {
  const components: CycloneDxComponent[] = [
    {
      type: "framework",
      name: "nodejs-runtime",
      version: input.nodeVersion,
    },
  ];
  if (input.includeDesktopElectronVersion) {
    components.push({
      type: "framework",
      name: "electron",
      version: input.includeDesktopElectronVersion,
      purl: `pkg:npm/electron@${input.includeDesktopElectronVersion}`,
    });
  }
  for (const name of Object.keys(input.externalDependencies).sort()) {
    const rawVersion = input.externalDependencies[name] ?? "unknown";
    const cleanVersion = rawVersion.replace(/^[~^]/, "");
    const encodedName = name.startsWith("@") ? name.replace("@", "%40") : name;
    components.push({
      type: "library",
      name,
      version: cleanVersion,
      purl: `pkg:npm/${encodedName}@${cleanVersion}`,
    });
  }
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "loom",
        version: input.version,
      },
      properties: [
        { name: "loom:profile", value: input.profile },
        { name: "loom:platform", value: input.platform },
        { name: "loom:arch", value: input.arch },
      ],
    },
    components,
  };
}

export const CORPORATE_POLICY_TEMPLATE = {
  schemaVersion: 1,
  organization: "Your Organization",
  settings: {
    enableProviderUpdateChecks: { value: false, locked: true },
    enableAgentBrowserAccess: { value: false, locked: true },
    defaultRuntimeMode: { value: "approval-required", locked: false },
  },
  limits: {
    maxRuntimeMode: "auto-accept-edits",
    clients: ["desktop", "local-browser"],
    webhookTasks: false,
    browserCookieImport: false,
  },
} as const;

const sha256File = Effect.fn("sha256File")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(filePath);
  return NodeCrypto.createHash("sha256").update(bytes).digest("hex");
});

const buildCorporateBundle = Effect.fn("buildCorporateBundle")(function* (input: {
  readonly version: string;
  readonly platform: typeof BuildPlatform.Type;
  readonly arch: typeof BuildArch.Type;
  readonly profile: typeof BuildProfile.Type;
  readonly archive: string;
  readonly desktopArtifact: Option.Option<string>;
  readonly outputDir: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* RepoRoot;

  if (!(yield* fs.exists(input.archive))) {
    return yield* new CorporateBundleInputMissingError({ inputPath: input.archive });
  }
  const desktopArtifactPath = Option.getOrUndefined(input.desktopArtifact);
  if (desktopArtifactPath !== undefined && !(yield* fs.exists(desktopArtifactPath))) {
    return yield* new CorporateBundleInputMissingError({ inputPath: desktopArtifactPath });
  }

  const workspace = yield* decodeWorkspaceConfig(
    yield* fs.readFileString(path.join(repoRoot, "pnpm-workspace.yaml")),
  );
  const catalog = workspace.catalog ?? {};
  const serverDeps = resolveCatalogDependencies(
    serverPackageJson.dependencies,
    catalog,
    "apps/server",
  );
  const desktopDeps = resolveCatalogDependencies(
    desktopPackageJson.dependencies,
    catalog,
    "apps/desktop",
  );
  const fffNodeVersion = serverDeps["@ff-labs/fff-node"] ?? "0.0.0";
  const stagedDeps: Record<string, string> = {
    ...selectCliRuntimeExternalDependencies(serverDeps, {
      profile: input.profile,
      platform: input.platform,
    }),
    ...resolveFffNativeDependencies(input.platform, input.arch, fffNodeVersion),
    ...(desktopArtifactPath
      ? selectDesktopRuntimeExternalDependencies(desktopDeps, {
          profile: input.profile,
          platform: input.platform,
        })
      : {}),
  };

  const versionDir = path.join(input.outputDir, `v${input.version}`);
  yield* fs.makeDirectory(versionDir, { recursive: true });

  const archiveName = path.basename(input.archive);
  const archiveTarget = path.join(versionDir, archiveName);
  yield* fs.copyFile(input.archive, archiveTarget);

  const checksumEntries: Array<string> = [`${yield* sha256File(archiveTarget)}  ${archiveName}`];

  if (desktopArtifactPath !== undefined) {
    const desktopName = path.basename(desktopArtifactPath);
    const desktopTarget = path.join(versionDir, desktopName);
    yield* fs.copyFile(desktopArtifactPath, desktopTarget);
    checksumEntries.push(`${yield* sha256File(desktopTarget)}  ${desktopName}`);
  }

  const checksumsPath = path.join(versionDir, "SHA256SUMS");
  yield* fs.writeFileString(checksumsPath, `${checksumEntries.join("\n")}\n`);
  yield* fs.writeFileString(path.join(input.outputDir, "latest.txt"), `v${input.version}\n`);

  const installerName = input.platform === "win" ? "install.ps1" : "install.sh";
  const installerTarget = path.join(input.outputDir, installerName);
  yield* fs.copyFile(path.join(repoRoot, "scripts", installerName), installerTarget);
  if (input.platform === "linux") {
    yield* fs.chmod(installerTarget, 0o755);
  }

  const sbom = buildCorporateSbom({
    version: input.version,
    platform: input.platform,
    arch: input.arch,
    profile: input.profile,
    nodeVersion: rootPackageJson.engines.node,
    externalDependencies: stagedDeps,
    ...(desktopArtifactPath ? { includeDesktopElectronVersion: desktopDeps.electron } : {}),
  });
  yield* fs.writeFileString(
    path.join(versionDir, `sbom-${input.platform}-${input.arch}.cdx.json`),
    `${yield* encodePrettyJson(sbom)}\n`,
  );
  yield* fs.writeFileString(
    path.join(input.outputDir, "policy.example.json"),
    `${yield* encodePrettyJson(CORPORATE_POLICY_TEMPLATE)}\n`,
  );

  const readme =
    input.platform === "win"
      ? [
          `Loom ${input.version} (${input.profile}, win32-${input.arch}) — Corporate Offline Bundle`,
          "",
          "Offline installation (no network required):",
          `  .\\install.ps1 -ArchivePath .\\v${input.version}\\${archiveName} -ChecksumsPath .\\v${input.version}\\SHA256SUMS -NoModifyPath`,
          "",
          "Internal HTTP mirror installation:",
          `  $env:LOOM_RELEASE_BASE_URL = "https://artifacts.corp.local/loom"`,
          `  $env:LOOM_PROFILE = "${input.profile}"`,
          "  .\\install.ps1",
          "",
          "Managed Policy:",
          "  Edit policy.example.json and deploy to C:\\Program Files\\Loom\\policy.json or via Windows GPO.",
          "",
        ].join("\r\n")
      : [
          `Loom ${input.version} (${input.profile}, linux-${input.arch}) — Corporate Offline Bundle`,
          "",
          "Offline installation (no network required):",
          `  sh ./install.sh --archive ./v${input.version}/${archiveName} --checksums ./v${input.version}/SHA256SUMS --no-modify-path`,
          "",
          "Internal HTTP mirror installation:",
          `  LOOM_RELEASE_BASE_URL=https://artifacts.corp.local/loom LOOM_PROFILE=${input.profile} sh ./install.sh`,
          "",
          "Managed Policy:",
          "  Edit policy.example.json and deploy to /etc/loom/policy.json (root-writable only).",
          "",
        ].join("\n");
  yield* fs.writeFileString(path.join(input.outputDir, "README-INSTALL.txt"), readme);

  yield* Effect.log(
    `[corporate-bundle] Wrote ${input.outputDir} (${checksumEntries.length} artifact(s)).`,
  );
});

const command = Command.make(
  "build-corporate-bundle",
  {
    version: Flag.String("version"),
    platform: Flag.Literals("platform", BuildPlatform.literals),
    arch: Flag.Literals("arch", BuildArch.literals).pipe(Flag.withDefault("x64")),
    profile: Flag.Literals("profile", BuildProfile.literals).pipe(Flag.withDefault("minimal")),
    archive: Flag.String("archive").pipe(
      Flag.withDescription("Path to the built CLI archive (.tar.gz or .zip)."),
    ),
    desktopArtifact: Flag.String("desktop-artifact").pipe(
      Flag.withDescription("Optional path to the built Desktop installer (.deb, AppImage, .exe)."),
      Flag.optional,
    ),
    outputDir: Flag.String("output-dir").pipe(Flag.withDefault("release-corporate")),
  },
  (input) => buildCorporateBundle(input),
).pipe(
  Command.withDescription(
    "Assemble an offline/mirror-ready corporate installation bundle with SHA256SUMS, CycloneDX SBOM, and policy template.",
  ),
);

if (import.meta.main) {
  Command.run(command, { version: "0.0.0" }).pipe(
    Effect.provide(Layer.mergeAll(Logger.layer([Logger.consolePretty()]), NodeServices.layer)),
    NodeRuntime.runMain,
  );
}
