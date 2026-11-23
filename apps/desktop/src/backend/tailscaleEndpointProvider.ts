import { createAdvertisedEndpoint } from "@loom/shared/advertisedEndpoint";
import type { AdvertisedEndpoint, AdvertisedEndpointProvider } from "@loom/contracts";
import { isSharedAddressSpaceHost, isTailnetHost } from "@loom/shared/hostClassification";

import type { NetworkInterfaces } from "./DesktopNetworkInterfaces.ts";

const TAILSCALE_ENDPOINT_PROVIDER: AdvertisedEndpointProvider = {
  id: "tailscale",
  label: "Tailscale",
  kind: "private-network",
  isAddon: true,
};

/** Tailscale addresses read from local adapters only; nothing runs the tailscale CLI. */
export function resolveTailscaleAdvertisedEndpoints(input: {
  readonly port: number;
  readonly networkInterfaces: NetworkInterfaces;
}): readonly AdvertisedEndpoint[] {
  const seen = new Set<string>();
  const endpoints: AdvertisedEndpoint[] = [];

  for (const [interfaceName, interfaceAddresses] of Object.entries(input.networkInterfaces)) {
    if (!interfaceAddresses) continue;

    // CGNAT is shared with other VPNs, so the adapter must be Tailscale's own.
    const isTailscaleInterface =
      /^tailscale(?:\d+|ipv[46])?$/iu.test(interfaceName) ||
      interfaceAddresses.some(
        (address) =>
          !address.internal && address.family === "IPv6" && isTailnetHost(address.address),
      );
    if (!isTailscaleInterface) continue;

    for (const address of interfaceAddresses) {
      if (address.internal) continue;
      if (address.family !== "IPv4") continue;
      if (!isSharedAddressSpaceHost(address.address)) continue;
      if (seen.has(address.address)) continue;
      seen.add(address.address);

      endpoints.push(
        createAdvertisedEndpoint({
          provider: TAILSCALE_ENDPOINT_PROVIDER,
          source: "desktop-addon",
          id: `tailscale-ip:http://${address.address}:${input.port}`,
          label: "Tailscale IP",
          httpBaseUrl: `http://${address.address}:${input.port}`,
          reachability: "private-network",
          status: "available",
          description: "Reachable from devices on the same Tailnet.",
        }),
      );
    }
  }

  return endpoints;
}
