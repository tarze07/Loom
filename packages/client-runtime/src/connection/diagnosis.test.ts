import { describe, expect, it } from "@effect/vitest";

import { presentConnectionDiagnosis } from "./diagnosis.ts";
import { mapRemoteEnvironmentError } from "./errors.ts";
import {
  AVAILABLE_CONNECTION_STATE,
  ConnectionBlockedError,
  type ConnectionAttemptError,
  type SupervisorConnectionState,
} from "./model.ts";
import { RemoteEnvironmentAuthFetchError } from "../rpc/http.ts";

const backoff = (lastFailure: ConnectionAttemptError): SupervisorConnectionState => ({
  ...AVAILABLE_CONNECTION_STATE,
  desired: true,
  network: "online",
  phase: "backoff",
  attempt: 3,
  lastFailure,
  retryAt: Date.UTC(2026, 9, 19, 12, 0, 30),
});

const diagnose = (state: SupervisorConnectionState) =>
  presentConnectionDiagnosis({ hostLabel: "Mac mini", state });

const results = (state: SupervisorConnectionState) =>
  diagnose(state)?.hops.map((hop) => `${hop.hop}:${hop.result}`);

describe("presentConnectionDiagnosis", () => {
  it("reports this device as offline before any other hop", () => {
    const state = { ...backoff(new ConnectionBlockedError({
      reason: "authentication",
      detail: "Refused.",
    })), network: "offline" as const };
    expect(diagnose(state)?.headline).toBe("This device is offline or could not prepare the connection");
    expect(results(state)?.[0]).toBe("device:failed");
  });

  it("blames the server on a network failure without a named hop", () => {
    const failure = mapRemoteEnvironmentError(
      new RemoteEnvironmentAuthFetchError({ message: "Failed to fetch", cause: new TypeError() }),
    );
    const diagnosis = diagnose(backoff(failure));
    expect(diagnosis?.headline).toBe("Loom on Mac mini did not answer");
    expect(diagnosis?.hops.map((hop) => `${hop.hop}:${hop.result}`)).toEqual([
      "device:ok",
      "server:failed",
    ]);
  });

  it("reports an outdated server", () => {
    const failure = new ConnectionBlockedError({
      reason: "unsupported",
      detail: "This client requires a newer server.",
      serverUpdateRequired: true,
    });
    expect(diagnose(backoff(failure))?.headline).toBe("Mac mini runs an older Loom");
  });

  it("does not report hops as working when the failure names none", () => {
    const failure = new ConnectionBlockedError({
      reason: "authentication",
      detail: "The environment credential is invalid.",
    });
    expect(results(backoff(failure))).not.toContainEqual(expect.stringMatching(/:ok$/));
  });

  it("collects facts about the failure", () => {
    const failure = new ConnectionBlockedError({
      reason: "authentication",
      detail: "The environment credential is invalid.",
      traceId: "trace-1",
      httpStatus: 401,
    });
    const facts = diagnose(backoff(failure))?.facts.map(([label]) => label);
    expect(facts).toContain("Cause");
    expect(facts).toContain("HTTP status");
    expect(facts).toContain("Trace ID");
  });
});
