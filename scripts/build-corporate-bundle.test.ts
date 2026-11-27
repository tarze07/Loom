import { assert, describe, it } from "@effect/vitest";

import { buildCorporateSbom, CORPORATE_POLICY_TEMPLATE } from "./build-corporate-bundle.ts";

describe("buildCorporateSbom", () => {
  it("emits a CycloneDX 1.5 SBOM for minimal runtime dependencies", () => {
    const sbom = buildCorporateSbom({
      version: "0.1.9",
      platform: "linux",
      arch: "x64",
      profile: "minimal",
      nodeVersion: "26.12.1",
      externalDependencies: {
        "node-pty": "^1.2.0-beta.15",
        "@ff-labs/fff-node": "0.11.0",
      },
    });
    assert.strictEqual(sbom.bomFormat, "CycloneDX");
    assert.strictEqual(sbom.specVersion, "1.5");
    assert.strictEqual(sbom.metadata.component.name, "loom");
    assert.deepStrictEqual(
      sbom.components.map((c) => `${c.name}@${c.version}`),
      ["nodejs-runtime@26.12.1", "@ff-labs/fff-node@0.11.0", "node-pty@1.2.0-beta.15"],
    );
    assert.strictEqual(sbom.components[1]?.purl, "pkg:npm/%40ff-labs/fff-node@0.11.0");
  });

  it("disables external update checks and browser access in the corporate policy template", () => {
    assert.strictEqual(CORPORATE_POLICY_TEMPLATE.settings.enableProviderUpdateChecks.value, false);
    assert.strictEqual(CORPORATE_POLICY_TEMPLATE.settings.enableAgentBrowserAccess.value, false);
    assert.strictEqual(CORPORATE_POLICY_TEMPLATE.limits.browserCookieImport, false);
  });
});
