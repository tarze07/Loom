import { OtlpHeadersFromString, OtlpProtocol } from "@loom/shared/observability";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Option from "effect/Option";

const trimNonEmptyOption = (value: string): Option.Option<string> => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
};

export const trimmedString = (name: string) =>
  Config.String(name).pipe(Config.option, Config.map(Option.flatMap(trimNonEmptyOption)));

const commaSeparatedStrings = (name: string) =>
  trimmedString(name).pipe(
    Config.map(
      Option.match({
        onNone: () => [],
        onSome: (value) =>
          value
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
      }),
    ),
  );

const compactEnv = (env: Readonly<Record<string, string | undefined>>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

export const DesktopConfig = Config.all({
  appDataDirectory: trimmedString("APPDATA"),
  xdgConfigHome: trimmedString("XDG_CONFIG_HOME"),
  xdgDataHome: trimmedString("XDG_DATA_HOME"),
  loomHome: trimmedString("LOOM_HOME"),
  devServerUrl: Config.URL("VITE_DEV_SERVER_URL").pipe(Config.option),
  appUserModelIdOverride: trimmedString("LOOM_DESKTOP_APP_USER_MODEL_ID"),
  devRemoteLoomServerEntryPath: trimmedString("LOOM_DEV_REMOTE_LOOM_SERVER_ENTRY_PATH"),
  configuredBackendPort: Config.Port("LOOM_PORT").pipe(Config.option),
  commitHashOverride: trimmedString("LOOM_COMMIT_HASH"),
  desktopLanHostOverride: trimmedString("LOOM_DESKTOP_LAN_HOST"),
  desktopHttpsEndpointUrls: commaSeparatedStrings("LOOM_DESKTOP_HTTPS_ENDPOINTS"),
  otlpTracesUrl: trimmedString("LOOM_OTLP_TRACES_URL"),
  otlpMetricsUrl: trimmedString("LOOM_OTLP_METRICS_URL"),
  otlpLogsUrl: trimmedString("LOOM_OTLP_LOGS_URL"),
  otlpExportIntervalMs: Config.Int("LOOM_OTLP_EXPORT_INTERVAL_MS").pipe(Config.withDefault(10_000)),
  otlpHeaders: Config.schema(OtlpHeadersFromString, "LOOM_OTLP_HEADERS").pipe(Config.option),
  otlpProtocol: Config.schema(OtlpProtocol, "LOOM_OTLP_PROTOCOL").pipe(
    Config.withDefault("http/json"),
  ),
  desktopLauncherPath: trimmedString("LOOM_DESKTOP_LAUNCHER_PATH"),
  appImagePath: trimmedString("APPIMAGE"),
});

export const layerTest = (env: Readonly<Record<string, string | undefined>>) =>
  ConfigProvider.layer(ConfigProvider.fromEnv({ env: compactEnv(env) }));
