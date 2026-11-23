import { assert, describe, it } from "vite-plus/test";

import { resolveTailscaleAdvertisedEndpoints } from "./tailscaleEndpointProvider.ts";

const protonAndTailscaleInterfaces = {
  pvpnksintrf1: [{ address: "100.85.0.1", family: "IPv4", internal: false }],
  tailscale0: [{ address: "100.74.126.34", family: "IPv4", internal: false }],
};

describe("tailscale endpoint provider", () => {
  it("advertises Tailscale's adapter address, not another VPN's in the same range", () => {
    for (const interfaceName of ["tailscale0", "Tailscale"]) {
      const endpoints = resolveTailscaleAdvertisedEndpoints({
        port: 3773,
        networkInterfaces: {
          pvpnksintrf1: protonAndTailscaleInterfaces.pvpnksintrf1,
          [interfaceName]: protonAndTailscaleInterfaces.tailscale0,
        },
      });
      assert.deepEqual(
        endpoints.map((endpoint) => endpoint.httpBaseUrl),
        ["http://100.74.126.34:3773/"],
      );
    }
  });

  it("recognizes a macOS Tailscale tunnel by its IPv6 address", () => {
    const endpoints = resolveTailscaleAdvertisedEndpoints({
      port: 3773,
      networkInterfaces: {
        utun3: [{ address: "100.85.0.1", family: "IPv4", internal: false }],
        utun4: [
          { address: "100.74.126.34", family: "IPv4", internal: false },
          { address: "fd7a:115c:a1e0::1234", family: "IPv6", internal: false },
        ],
      },
    });
    assert.deepEqual(
      endpoints.map((endpoint) => endpoint.httpBaseUrl),
      ["http://100.74.126.34:3773/"],
    );
  });
});
