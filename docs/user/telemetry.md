# Diagnostics export

Loom does not send any product usage data, crash reports, or connection traces to Loom
Code's servers.

The server keeps a local trace log for debugging (`server.trace.ndjson` in its logs
directory). Settings → Diagnostics can additionally export those spans to an OpenTelemetry
endpoint you configure yourself, such as your own Grafana or Honeycomb collector; nothing is
sent anywhere until you set an endpoint. See [Observability](../operations/observability.md).
