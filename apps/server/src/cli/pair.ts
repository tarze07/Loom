import {
  type AuthEnvironmentScope,
  AuthStandardClientScopes,
  ExecutionEnvironmentDescriptor,
  ORCHESTRATION_PROTOCOL_VERSION,
} from "@loom/contracts";
import { resolveWorktreeLoomHome } from "@loom/shared/devHome";
import * as HostProcess from "@loom/shared/HostProcess";
import { formatHostForUrl, isWildcardHost } from "@loom/shared/hostClassification";
import { DEFAULT_SIGNAL_EXPORT } from "@loom/shared/observability";
import { buildPairingAppLink } from "@loom/shared/remote";
import * as OtelEnvironment from "@loom/shared/otelEnvironment";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as References from "effect/References";
import * as Schema from "effect/Schema";
import { Command, Flag, GlobalFlag } from "effect/cli";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../config.ts";
import * as ManagedLimits from "../policy/managedLimits.ts";
import { resolveBaseDir } from "../os-jank.ts";
import {
  type PersistedServerRuntimeState,
  isProcessAlive,
  readPersistedServerRuntimeState,
} from "../serverRuntimeState.ts";
import {
  buildPairingUrl,
  isLoopbackHost,
  renderTerminalQrCode,
  resolveHeadlessConnectionString,
} from "../startupAccess.ts";
import { authScopesFlag } from "./authScopes.ts";
import { baseDirFlag, DurationFromString } from "./config.ts";
import { resolveHostCliCommand } from "./invocation.ts";

const WELL_KNOWN_ENVIRONMENT_PATH = "/.well-known/t3/environment";
const PAIR_PROBE_TIMEOUT = Duration.millis(2_500);

export type PairStateVariant = "userdata" | "dev";

// Only devUrl's presence selects dev state; its value is unused.
const DEV_VARIANT_PLACEHOLDER_URL = new URL("http://localhost");

export class NoRunningServerError extends Schema.TaggedError<NoRunningServerError>()(
  "NoRunningServerError",
  {
    checkedStatePaths: Schema.Array(Schema.String),
    inLinkedWorktree: Schema.Boolean,
    serveCommand: Schema.String,
    connectCommand: Schema.String,
  },
) {
  override get message(): string {
    return [
      "No running Loom server found.",
      ...this.checkedStatePaths.map((statePath) => `  checked ${statePath}`),
      ...(this.inLinkedWorktree
        ? ["In a linked worktree, pass --base-dir to pair with a server outside it."]
        : []),
      `Start one with \`${this.serveCommand}\`, or connect this machine with Loom Connect: \`${this.connectCommand}\`.`,
    ].join("\n");
  }
}

export class IncompatibleServerProtocolError extends Schema.TaggedError<IncompatibleServerProtocolError>()(
  "IncompatibleServerProtocolError",
  { serverVersion: Schema.String, serverProtocolVersion: Schema.Number },
) {
  override get message(): string {
    return [
      `The running Loom server (${this.serverVersion}) speaks orchestration protocol ${String(this.serverProtocolVersion)}, but this CLI speaks protocol ${String(ORCHESTRATION_PROTOCOL_VERSION)}.`,
      `Pair with the matching CLI instead: \`npx t3@${this.serverVersion} pair\`.`,
    ].join("\n");
  }
}

const formatPairOutput = (input: {
  readonly serverLabel: string;
  readonly origin: string;
  readonly pairingUrl: string;
  readonly token: string;
  readonly expiresAt: DateTime.Utc;
  readonly notes: ReadonlyArray<string>;
}): string =>
  [
    `Pairing with ${input.serverLabel} (${input.origin}).`,
    "",
    renderTerminalQrCode(input.pairingUrl),
    "",
    `Pairing URL: ${input.pairingUrl}`,
    `App link: ${buildPairingAppLink(input.pairingUrl)}`,
    `Token: ${input.token}`,
    `Expires: ${DateTime.formatIso(input.expiresAt)}`,
    ...input.notes.flatMap((note) => ["", `Note: ${note}`]),
    "",
  ].join("\n");

type EnvironmentProbeResult =
  | { readonly _tag: "descriptor"; readonly descriptor: ExecutionEnvironmentDescriptor }
  | { readonly _tag: "unreachable" }
  | { readonly _tag: "not-a-loom-server" };

const probeEnvironmentDescriptor: (
  baseUrl: string,
) => Effect.Effect<EnvironmentProbeResult, never, HttpClient.HttpClient> = Effect.fn(
  "pair.probeEnvironmentDescriptor",
)(
  function* (baseUrl: string) {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(new URL(WELL_KNOWN_ENVIRONMENT_PATH, baseUrl).toString());
    const response = yield* client.execute(request).pipe(
      Effect.timeout(PAIR_PROBE_TIMEOUT),
      Effect.mapError(() => ({ _tag: "unreachable" }) as const),
    );
    // Gateway errors identify stale proxy mappings that pairing may repair.
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return { _tag: "unreachable" } as const;
    }
    const descriptor = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(ExecutionEnvironmentDescriptor)),
      Effect.mapError(() => ({ _tag: "not-a-loom-server" }) as const),
    );
    return { _tag: "descriptor", descriptor } as const;
  },
  Effect.catch((outcome) => Effect.succeed(outcome)),
);

interface DiscoveredPairTarget {
  readonly baseDir: string;
  readonly variant: PairStateVariant;
  readonly state: PersistedServerRuntimeState;
  readonly descriptor: ExecutionEnvironmentDescriptor;
}

const discoverPairTarget = Effect.fn("pair.discoverPairTarget")(function* (
  explicitBaseDir: string | undefined,
) {
  const bases: Array<string> = [];
  let inLinkedWorktree = false;
  const hasExplicitBaseDir = explicitBaseDir !== undefined && explicitBaseDir.trim().length > 0;
  if (hasExplicitBaseDir) {
    bases.push(yield* resolveBaseDir(explicitBaseDir));
  } else {
    // Same precedence as dev-runner: inside a linked worktree only its own
    // `.loom` counts. Minting opens the target database with this checkout's
    // migrations, so falling back to the shared home could migrate the live
    // install with unreleased schema.
    const worktreeHome = yield* resolveWorktreeLoomHome(yield* HostProcess.WorkingDirectory);
    if (worktreeHome !== undefined) {
      bases.push(worktreeHome);
      inLinkedWorktree = true;
    } else {
      const envHome = yield* Config.String("LOOM_HOME").pipe(Config.option);
      bases.push(yield* resolveBaseDir(Option.getOrUndefined(envHome)));
    }
  }

  const checkedStatePaths: Array<string> = [];
  for (const baseDir of new Set(bases)) {
    for (const variant of ["userdata", "dev"] as const) {
      const derivedPaths = yield* ServerConfig.deriveServerPaths(
        baseDir,
        variant === "dev" ? DEV_VARIANT_PLACEHOLDER_URL : undefined,
        {},
      );
      const statePath = derivedPaths.serverRuntimeStatePath;
      checkedStatePaths.push(statePath);
      const state = yield* readPersistedServerRuntimeState(statePath);
      if (Option.isNone(state)) {
        continue;
      }
      // A dead server's port may be reused; do not mint tokens in its old database for another server.
      if (!isProcessAlive(state.value.pid)) {
        continue;
      }
      const probed = yield* probeEnvironmentDescriptor(state.value.origin);
      if (probed._tag !== "descriptor") {
        continue;
      }
      return {
        baseDir,
        variant,
        state: state.value,
        descriptor: probed.descriptor,
      } satisfies DiscoveredPairTarget;
    }
  }
  const baseDirArgs = hasExplicitBaseDir ? ["--base-dir", explicitBaseDir] : [];
  return yield* new NoRunningServerError({
    checkedStatePaths,
    inLinkedWorktree,
    serveCommand: (yield* resolveHostCliCommand("serve", baseDirArgs)).command,
    connectCommand: (yield* resolveHostCliCommand("connect", baseDirArgs)).command,
  });
});

const resolveDirectPairingBaseUrl = (state: PersistedServerRuntimeState): string =>
  state.devUrl ??
  resolveHeadlessConnectionString(state.host, state.port, {
    privateNetworkOnly: state.privateNetworkOnly,
  });

/** Use the discovered state directory, independent of ambient config variables. */
const makePairServerConfig = Effect.fn(function* (input: {
  readonly target: DiscoveredPairTarget;
  readonly logLevel: ServerConfig.ServerConfig["Service"]["logLevel"];
}) {
  const { baseDir, variant, state } = input.target;
  // Worktree dev servers can use `userdata`; only the recorded devUrl marks a dev server.
  const devUrl = state.devUrl !== undefined ? new URL(state.devUrl) : undefined;
  const derivedPaths = yield* ServerConfig.deriveServerPaths(
    baseDir,
    variant === "dev" ? DEV_VARIANT_PLACEHOLDER_URL : undefined,
    {},
  );
  return ServerConfig.make({
    logLevel: input.logLevel,
    traceMinLevel: "Info",
    traceTimingEnabled: false,
    traceBatchWindowMs: 1_000,
    traceMaxBytes: 10 * 1024 * 1024,
    traceMaxFiles: 10,
    otlpTracesUrl: undefined,
    otlpMetricsUrl: undefined,
    otlpLogsUrl: undefined,
    otlpTracesExport: DEFAULT_SIGNAL_EXPORT,
    otlpMetricsExport: DEFAULT_SIGNAL_EXPORT,
    otlpLogsExport: DEFAULT_SIGNAL_EXPORT,
    otelEnvironment: OtelEnvironment.none,
    mode: "web",
    port: state.port,
    host: state.host,
    cwd: process.cwd(),
    baseDir,
    ...derivedPaths,
    staticDir: undefined,
    devUrl,
    devAllowedOrigins: [],
    noBrowser: true,
    startupPresentation: "headless",
    desktopBootstrapToken: undefined,
    desktopTelemetryFd: undefined,
    desktopBrowserFd: undefined,
    desktopBrowserControlFd: undefined,
    desktopTelemetryControlFd: undefined,
    resourceMonitorPath: undefined,
    autoBootstrapProjectFromCwd: false,
    logWebSocketEvents: false,
  });
});

const mintPairingLink = Effect.fn("pair.mintPairingLink")(function* (input: {
  readonly config: ServerConfig.ServerConfig["Service"];
  readonly scopes: ReadonlyArray<AuthEnvironmentScope>;
  readonly ttl: Option.Option<Duration.Duration>;
  readonly label: Option.Option<string>;
}) {
  return yield* Effect.gen(function* () {
    const environmentAuth = yield* EnvironmentAuth.EnvironmentAuth;
    return yield* environmentAuth.createPairingLink({
      scopes: input.scopes,
      subject: "one-time-token",
      label: Option.getOrElse(input.label, () => "t3 pair"),
      ...(Option.isSome(input.ttl) ? { ttl: input.ttl.value } : {}),
    });
  }).pipe(
    Effect.provide(
      EnvironmentAuth.layerRuntime.pipe(
        Layer.provide(ServerConfig.layer(input.config)),
        Layer.provide(Layer.succeed(References.MinimumLogLevel, input.config.logLevel)),
      ),
    ),
  );
});

const ttlFlag = Flag.String("ttl").pipe(
  Flag.withSchema(DurationFromString),
  Flag.withDescription(
    "Token TTL, for example `5m`, `1h`, or `15 minutes`. Defaults to 5 minutes.",
  ),
  Flag.optional,
);

const labelFlag = Flag.String("label").pipe(
  Flag.withDescription("Optional label shown in the server's connections list."),
  Flag.optional,
);

export const pairCommand = Command.make("pair", {
  baseDir: baseDirFlag,
  scopes: authScopesFlag(AuthStandardClientScopes),
  ttl: ttlFlag,
  label: labelFlag,
}).pipe(
  Command.withDescription(
    "Mint a pairing token for a running Loom server and print it as a QR code.",
  ),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      const cliLogLevel = yield* GlobalFlag.LogLevel;
      const logLevel = Option.getOrElse(cliLogLevel, () => "Warn" as const);

      const target = yield* discoverPairTarget(Option.getOrUndefined(flags.baseDir));
      // Each protocol keeps auth in its own database, so a token minted here
      // for another protocol's server would never be accepted by it. Refuse
      // before any local layer opens (and migrates) that database.
      const serverProtocolVersion = target.descriptor.orchestrationProtocolVersion ?? 1;
      if (serverProtocolVersion !== ORCHESTRATION_PROTOCOL_VERSION) {
        return yield* new IncompatibleServerProtocolError({
          serverVersion: target.descriptor.serverVersion,
          serverProtocolVersion,
        });
      }

      const notes: Array<string> = [];
      const pairingBaseUrl = resolveDirectPairingBaseUrl(target.state);
      if (isLoopbackHost(new URL(pairingBaseUrl).hostname)) {
        notes.push(
          "This URL is only reachable from this machine. To reach it from your other devices, run `t3 up`.",
        );
      } else if (target.state.privateNetworkOnly) {
        notes.push("This URL works only from this machine's local network.");
      }
      if (target.variant === "dev" && target.state.devUrl === undefined) {
        notes.push(
          "This dev server did not record its web URL; restart it so pairing can go through the web origin.",
        );
      }

      const config = yield* makePairServerConfig({ target, logLevel });
      const issued = yield* mintPairingLink({
        config,
        scopes: flags.scopes,
        ttl: flags.ttl,
        label: flags.label,
      });
      const pairingUrl = buildPairingUrl(pairingBaseUrl, issued.credential);

      yield* Console.log(
        formatPairOutput({
          serverLabel: target.descriptor.label,
          origin: target.state.origin,
          pairingUrl,
          token: issued.credential,
          expiresAt: issued.expiresAt,
          notes,
        }),
      );
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  ),
);
