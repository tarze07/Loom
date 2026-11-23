import * as DateTime from "effect/DateTime";

import type { ConnectionAttemptError, ConnectionHop, SupervisorConnectionState } from "./model.ts";

export type ConnectionHopResult = "ok" | "failed" | "unchecked";

export interface ConnectionDiagnosisHop {
  readonly hop: ConnectionHop;
  readonly label: string;
  readonly result: ConnectionHopResult;
}

export interface ConnectionDiagnosis {
  /** Names the part that failed. */
  readonly headline: string;
  readonly hops: ReadonlyArray<ConnectionDiagnosisHop>;
  readonly steps: ReadonlyArray<string>;
  readonly facts: ReadonlyArray<readonly [label: string, value: string]>;
}

export interface ConnectionDiagnosisInput {
  readonly hostLabel: string;
  readonly state: SupervisorConnectionState;
  readonly clientVersion?: string | undefined;
  readonly serverVersion?: string | null | undefined;
}

type Located = {
  readonly hop: ConnectionHop;
  /** The failure named no hop, so the hops before this one were never probed. */
  readonly guessed?: true;
};

function locate(input: ConnectionDiagnosisInput): Located | null {
  const failure = input.state.lastFailure;
  if (input.state.network === "offline" || input.state.phase === "offline") {
    return { hop: "device" };
  }
  if (failure?._tag === "ConnectionBlockedError" && failure.serverUpdateRequired) {
    return { hop: "server" };
  }
  if (failure?.hop !== undefined) {
    return { hop: failure.hop };
  }
  if (failure !== null) {
    return { hop: "server", guessed: true };
  }
  return null;
}

function headline(host: string, located: Located, failure: ConnectionAttemptError | null): string {
  switch (located.hop) {
    case "device":
      return "This device is offline or could not prepare the connection";
    case "server":
      return failure?.reason === "authentication" || failure?.reason === "permission"
        ? `Loom on ${host} did not accept this device`
        : failure?._tag === "ConnectionBlockedError" && failure.serverUpdateRequired
          ? `${host} runs an older Loom`
          : `Loom on ${host} did not answer`;
  }
}

function steps(host: string, located: Located): string[] {
  switch (located.hop) {
    case "device":
      return [
        "Connect this device to the internet and restart Loom on it.",
        `If it keeps failing, remove ${host} from this device and add it again.`,
      ];
    case "server":
      return [
        `Make sure Loom is running on ${host}.`,
        "Retry. If it keeps failing, copy the diagnostics.",
      ];
  }
}

function hopLabel(hop: ConnectionHop, host: string): string {
  switch (hop) {
    case "device":
      return "This device";
    case "server":
      return `Loom on ${host}`;
  }
}

/**
 * Turns a connection state into what failed, in order, and what to try. Returns
 * null when nothing has failed. Web and mobile render this same model.
 */
export function presentConnectionDiagnosis(
  input: ConnectionDiagnosisInput,
): ConnectionDiagnosis | null {
  const located = locate(input);
  if (located === null) return null;
  const host = input.hostLabel;
  const failure = input.state.lastFailure;
  const order: ReadonlyArray<ConnectionHop> = ["device", "server"];
  const failedIndex = order.indexOf(located.hop);
  const hops = order.map((hop, index): ConnectionDiagnosisHop => ({
    hop,
    label: hopLabel(hop, host),
    result:
      index === failedIndex
        ? "failed"
        : index < failedIndex && located.guessed !== true
          ? "ok"
          : "unchecked",
  }));

  const facts: Array<readonly [string, string]> = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") facts.push([label, String(value)]);
  };
  add("Cause", failure?.reason);
  add("HTTP status", failure?.httpStatus);
  add("Attempts", input.state.attempt > 0 ? input.state.attempt : null);
  add(
    "Next retry",
    input.state.retryAt === null
      ? null
      : DateTime.formatIso(DateTime.makeUnsafe(input.state.retryAt)),
  );
  add("App version", input.clientVersion);
  add("Host version", input.serverVersion);
  add("Error", failure?.detail);
  add("Trace ID", failure?.traceId);

  return {
    headline: headline(host, located, failure),
    hops,
    steps: steps(host, located),
    facts,
  };
}

const HOP_MARK = { ok: "ok", failed: "FAILED", unchecked: "not checked" } as const;

/** One plain-text block for bug reports. */
export function connectionDiagnosisText(hostLabel: string, diagnosis: ConnectionDiagnosis): string {
  return [
    `Loom connection to ${hostLabel}: ${diagnosis.headline}`,
    "",
    ...diagnosis.hops.map((hop) => `${hop.label}: ${HOP_MARK[hop.result]}`),
    "",
    ...diagnosis.facts.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
}
