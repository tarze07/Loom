import * as HostProcess from "@loom/shared/HostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import packageJson from "../../package.json" with { type: "json" };
import {
  decodeServiceLauncherContext,
  decodeServiceLauncherParentMessage,
  SERVICE_LAUNCHER_CONTEXT_ENV,
  type SupportedLauncherProtocol,
} from "./serviceProtocol.ts";

export class ServiceLauncherClientError extends Schema.TaggedError<ServiceLauncherClientError>()(
  "ServiceLauncherClientError",
  {
    operation: Schema.Literals([
      "decode-context",
      "version-mismatch",
      "unmanaged",
      "send",
      "disconnect",
      "timeout",
    ]),
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    switch (this.operation) {
      case "decode-context":
        return "The service launcher supplied invalid startup context.";
      case "version-mismatch":
        return "The service launcher started a different t3 version.";
      case "unmanaged":
        return "This server is not managed by the launcher.";
      case "send":
        return "Could not send a request to the service launcher.";
      case "disconnect":
        return "The service launcher disconnected before acknowledging the request.";
      case "timeout":
        return "The service launcher did not respond within 30 seconds.";
    }
  }
}

interface ServiceLauncherProcess {
  readonly connected: boolean;
  readonly on: (
    event: "message" | "disconnect",
    listener: (...args: ReadonlyArray<unknown>) => void,
  ) => void;
  readonly off: (
    event: "message" | "disconnect",
    listener: (...args: ReadonlyArray<unknown>) => void,
  ) => void;
}

export const ServiceLauncherHostProcess = Context.Reference<ServiceLauncherProcess>(
  "t3/cloud/serviceLauncherHostProcess",
  {
    defaultValue: () => ({
      connected: process.connected && process.send !== undefined,
      on: (event, listener) => {
        process.on(event, listener);
      },
      off: (event, listener) => {
        process.off(event, listener);
      },
    }),
  },
);

export class ServiceLauncherClient extends Context.Service<
  ServiceLauncherClient,
  {
    readonly managed: boolean;
    /** The supervising launcher's protocol. A remote update never replaces the launcher,
        so it can be older than this runtime's own. */
    readonly protocol: SupportedLauncherProtocol | undefined;
  }
>()("loom/cloud/serviceLauncherClient") {}

const resolveStartup = Effect.fn("cloud.service_launcher_client.resolve_startup")(
  function* (options?: { readonly currentVersion?: string }) {
    const host = yield* ServiceLauncherHostProcess;
    const environment = yield* HostProcess.Environment;
    const currentVersion = options?.currentVersion ?? packageJson.version;
    // IPC channels are not inherited; without one, launcher context belongs to an ancestor.
    const rawContext = host.connected ? environment[SERVICE_LAUNCHER_CONTEXT_ENV] : undefined;
    const context = rawContext === undefined ? undefined : decodeServiceLauncherContext(rawContext);

    if (rawContext !== undefined && context === undefined) {
      return yield* new ServiceLauncherClientError({ operation: "decode-context" });
    }
    if (context !== undefined && context.childVersion !== currentVersion) {
      return yield* new ServiceLauncherClientError({ operation: "version-mismatch" });
    }

    const managed = context !== undefined;

    return { host, context, managed };
  },
);

export const resolveServiceLauncherMode = Effect.fn("cloud.service_launcher_client.resolve_mode")(
  function* () {
    const { managed } = yield* resolveStartup();
    return { managed };
  },
);

/** Completes when the launcher asks this server to stop, which Windows cannot signal. */
export const awaitServiceLauncherStop = Effect.fn("cloud.service_launcher_client.await_stop")(
  function* (options?: { readonly currentVersion?: string }) {
    const startup = yield* resolveStartup(options).pipe(Effect.option);
    if (Option.isNone(startup) || !startup.value.managed) return yield* Effect.never;
    const { host } = startup.value;
    return yield* Effect.callback<void>((resume) => {
      const onMessage = (...args: ReadonlyArray<unknown>) => {
        if (decodeServiceLauncherParentMessage(args[0])?.type === "stop") resume(Effect.void);
      };
      host.on("message", onMessage);
      return Effect.sync(() => host.off("message", onMessage));
    });
  },
);

export const make = Effect.fn("cloud.service_launcher_client.make")(function* (options?: {
  readonly currentVersion?: string;
}) {
  const { context, managed } = yield* resolveStartup(options);

  return ServiceLauncherClient.of({
    managed,
    protocol: context?.protocol,
  });
});

export const layer = Layer.effect(ServiceLauncherClient, make());
