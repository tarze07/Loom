import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Loom Connect relay deliveries are gone; nothing reads or writes this table.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`DROP INDEX IF EXISTS idx_scheduled_task_webhook_relay_deliveries_seen`;
  yield* sql`DROP TABLE IF EXISTS scheduled_task_webhook_relay_deliveries`;
});
