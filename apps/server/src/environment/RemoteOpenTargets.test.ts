// @effect-diagnostics nodeBuiltinImport:off -- replace the native OS lookup and sync its ESM bindings.
import * as NodeModule from "node:module";
import { it } from "@effect/vitest";
import * as HostProcess from "@loom/shared/HostProcess";
import * as NetService from "@loom/shared/Net";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { afterEach, describe, expect, vi } from "vite-plus/test";

import * as RemoteOpenTargets from "./RemoteOpenTargets.ts";

afterEach(() => {
  vi.restoreAllMocks();
  NodeModule.syncBuiltinESMExports();
});

const layerNet = (input: { readonly ipv4: boolean; readonly ipv6: boolean }) =>
  Layer.succeed(NetService.NetService, {
    canListenOnHost: () => Effect.succeed(true),
    isPortAvailableOnLoopback: () => Effect.succeed(true),
    hasListenerOnHost: (_port, host) =>
      Effect.succeed(host === "127.0.0.1" ? input.ipv4 : host === "::1" ? input.ipv6 : false),
    reserveLoopbackPort: () => Effect.succeed(40_000),
    findAvailablePort: (preferred) => Effect.succeed(preferred),
  });

const resolveTargets = (input: {
  readonly sshd: { readonly ipv4: boolean; readonly ipv6: boolean };
  readonly hostname: string;
  readonly username: string | null;
}) =>
  Effect.flatMap(RemoteOpenTargets.RemoteOpenTargets, (service) => service.resolveTargets()).pipe(
    Effect.provideService(HostProcess.Hostname, input.hostname),
    Effect.provideService(HostProcess.Username, input.username),
    Effect.provide(RemoteOpenTargets.layer.pipe(Layer.provide(layerNet(input.sshd)))),
  );

describe("RemoteOpenTargets", () => {
  it.effect("advertises nothing when no sshd accepts", () =>
    Effect.gen(function* () {
      const targets = yield* resolveTargets({
        sshd: { ipv4: false, ipv6: false },
        hostname: "bb-1",
        username: "loom-user",
      });
      expect(targets).toEqual([]);
    }),
  );

  it.effect("accepts an sshd bound to IPv6 loopback only", () =>
    Effect.gen(function* () {
      const targets = yield* resolveTargets({
        sshd: { ipv4: false, ipv6: true },
        hostname: "bb-1",
        username: "loom-user",
      });
      expect(targets).toEqual([{ kind: "mdns", host: "bb-1.local", username: "loom-user" }]);
    }),
  );
});
