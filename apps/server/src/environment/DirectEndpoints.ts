import type { ServerDirectEndpoint } from "@loom/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeNet from "node:net";
import * as NodeOS from "node:os";

import * as HostProcess from "@loom/shared/HostProcess";
import { formatHostForUrl, isWildcardHost } from "@loom/shared/hostClassification";

import * as ServerConfig from "../config.ts";
import { isLoopbackHost, isPrivateNetworkAddress, VIRTUAL_INTERFACE } from "../startupAccess.ts";

type NetworkInterfacesMap = ReturnType<typeof NodeOS.networkInterfaces>;

export class DirectEndpoints extends Context.Service<
  DirectEndpoints,
  {
    readonly resolveAvailable: () => Effect.Effect<ReadonlyArray<ServerDirectEndpoint>>;
    readonly resolve: () => Effect.Effect<ReadonlyArray<ServerDirectEndpoint>>;
  }
>()("loom/environment/DirectEndpoints") {}

// Credentials travel over HTTP; public IPs leak them and hostnames can resolve differently per client.
const isAdvertisableAddress = (address: string): boolean =>
  NodeNet.isIPv4(address) && !address.startsWith("127.") && isPrivateNetworkAddress(address);

// Windows adapter names are mutable; Linux bridges can inherit these MACs.
const WINDOWS_HOST_ADAPTER_MAC = /^(0a:00:27|00:50:56:c0:00):/i;

// Other VPNs (Cloudflare WARP, some corporate clients) also use 100.64.0.0/10, so the
// interface decides: Tailscale names it tailscale* or gives it an address in its fd7a:115c:a1e0::/48.
const TAILSCALE_INTERFACE_NAME = /^tailscale/i;
const TAILSCALE_ULA = /^fd7a:115c:a1e0:/i;
const isCgnatAddress = (address: string): boolean => {
  const [first, second] = address.split(".").map(Number);
  return first === 100 && second !== undefined && second >= 64 && second <= 127;
};

function tailnetAddresses(interfaces: NetworkInterfacesMap): ReadonlySet<string> {
  return new Set(
    Object.entries(interfaces).flatMap(([name, entries = []]) =>
      TAILSCALE_INTERFACE_NAME.test(name) ||
      entries.some((entry) => TAILSCALE_ULA.test(entry.address))
        ? entries
            .filter((entry) => entry.family === "IPv4" && isCgnatAddress(entry.address))
            .map((entry) => entry.address)
        : [],
    ),
  );
}

export function resolveBoundEndpoints(input: {
  readonly platform: NodeJS.Platform;
  readonly host: string | undefined;
  readonly port: number;
  readonly interfaces: NetworkInterfacesMap;
  /** A cloud VM's private network is its provider's, which no client shares; only its tailnet is. */
  readonly onCloudVm?: boolean;
}): ReadonlyArray<ServerDirectEndpoint> {
  if (isLoopbackHost(input.host)) return [];
  const addresses = isWildcardHost(input.host)
    ? Object.entries(input.interfaces)
        .flatMap(([name, entries]) => (VIRTUAL_INTERFACE.test(name) ? [] : (entries ?? [])))
        .filter(
          (entry) =>
            !entry.internal &&
            entry.family === "IPv4" &&
            isAdvertisableAddress(entry.address) &&
            !(input.platform === "win32" && WINDOWS_HOST_ADAPTER_MAC.test(entry.mac)),
        )
        .map((entry) => entry.address)
    : [input.host!].filter(isAdvertisableAddress);
  const tailnet = tailnetAddresses(input.interfaces);
  return [...new Set(addresses)]
    .map((address) => ({
      kind: tailnet.has(address) ? ("tailnet" as const) : ("lan" as const),
      httpBaseUrl: `http://${formatHostForUrl(address)}:${input.port}/`,
    }))
    .filter((endpoint) => !input.onCloudVm || endpoint.kind === "tailnet");
}

/**
 * AWS, GCP, Azure, DigitalOcean, Hetzner, Linode, Vultr, and Oracle all serve
 * instance metadata at this address. A plain TCP connect skips HTTP proxies,
 * which would otherwise answer for a machine that is not in a cloud.
 */
const CLOUD_METADATA_ADDRESS = "169.254.169.254";
const CLOUD_METADATA_TIMEOUT_MS = 300;

const probeCloudMetadata = Effect.callback<boolean>((resume) => {
  const socket = NodeNet.connect({
    host: CLOUD_METADATA_ADDRESS,
    port: 80,
    timeout: CLOUD_METADATA_TIMEOUT_MS,
  });
  let settled = false;
  const settle = (found: boolean) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    resume(Effect.succeed(found));
  };
  socket.once("connect", () => settle(true));
  socket.once("timeout", () => settle(false));
  socket.once("error", () => settle(false));
  return Effect.sync(() => socket.destroy());
});

/** @public */
export const make = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const platform = yield* HostProcess.Platform;
  // Only the service default listens on every interface without being asked,
  // so only it checks once whether it runs in a cloud. The check starts now so
  // the first client does not wait for its timeout.
  const onCloudVm = config.privateNetworkOnly
    ? yield* Effect.cached(probeCloudMetadata)
    : Effect.succeed(false);
  yield* Effect.forkDetach(onCloudVm);

  const resolveAvailable = Effect.fn("DirectEndpoints.resolveAvailable")(function* () {
    const endpoints = [
      ...resolveBoundEndpoints({
        platform,
        host: config.host,
        port: config.port,
        interfaces: NodeOS.networkInterfaces(),
        onCloudVm: yield* onCloudVm,
      }),
    ];
    return endpoints;
  });

  const resolve = resolveAvailable;

  return DirectEndpoints.of({ resolveAvailable, resolve });
});

export const layer = Layer.effect(DirectEndpoints, make);
