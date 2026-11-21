import { EnvironmentId } from "@loom/contracts";
import { type EnvironmentConnectionPhase } from "@loom/client-runtime/connection";

export interface SavedRemoteConnection {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly pairingUrl: string;
  readonly displayUrl: string;
  readonly httpBaseUrl: string;
  readonly wsBaseUrl: string;
  readonly bearerToken: string | null;
  readonly authenticationMethod?: "bearer";
}

export type RemoteClientConnectionState = EnvironmentConnectionPhase;
