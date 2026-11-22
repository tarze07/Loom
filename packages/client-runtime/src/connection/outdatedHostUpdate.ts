import { type EnvironmentId } from "@loom/contracts";
import * as Effect from "effect/Effect";
import * as SubscriptionRef from "effect/SubscriptionRef";

import * as ConnectionResolver from "./resolver.ts";
import * as EnvironmentRegistry from "./registry.ts";
import { routeEntry, usableRoutes } from "./routes.ts";

const reachOutdatedHost = Effect.fn("clientRuntime.connection.reachOutdatedHost")(function* (
  environmentId: EnvironmentId,
) {
  const registry = yield* EnvironmentRegistry.EnvironmentRegistry;
  const resolver = yield* ConnectionResolver.ConnectionResolver;
  const entry = (yield* SubscriptionRef.get(registry.entries)).get(environmentId);
  if (entry === undefined) {
    return yield* new EnvironmentRegistry.EnvironmentNotRegisteredError({ environmentId });
  }
  const { prepared, descriptor } = yield* Effect.firstSuccessOf(
    usableRoutes(entry).map((route) => resolver.prepareForUpdate(routeEntry(entry, route))),
  );
  return { entry, prepared, descriptor };
});

// The normal session cannot read config from a host behind the protocol gate.
export const describeOutdatedHost = (environmentId: EnvironmentId) =>
  reachOutdatedHost(environmentId).pipe(Effect.map(({ descriptor }) => descriptor));
