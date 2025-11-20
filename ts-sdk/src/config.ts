import * as os from "os";
import * as path from "path";
import YAML from "yaml";
import type { ProxyConfig } from "./types";

export function buildConfigYaml(config: ProxyConfig, enforcedPort: number): string {
  const doc: Record<string, unknown> = {};
  doc.port = enforcedPort;

  doc["auth-dir"] = config.authDir ?? path.join(os.homedir(), ".cli-proxy-api");
  if (config.remoteManagement) {
    doc["remote-management"] = {
      "allow-remote": config.remoteManagement.allowRemote,
      "secret-key": config.remoteManagement.secretKey ?? "",
      "disable-control-panel": config.remoteManagement.disableControlPanel,
    };
  }

  if (config.apiKeys) doc["api-keys"] = config.apiKeys;
  if (config.debug !== undefined) doc.debug = config.debug;
  if (config.loggingToFile !== undefined) doc["logging-to-file"] = config.loggingToFile;
  if (config.usageStatisticsEnabled !== undefined) {
    doc["usage-statistics-enabled"] = config.usageStatisticsEnabled;
  }
  if (config.proxyUrl) doc["proxy-url"] = config.proxyUrl;
  if (config.requestRetry !== undefined) doc["request-retry"] = config.requestRetry;
  if (config.quotaExceeded) {
    doc["quota-exceeded"] = {
      "switch-project": config.quotaExceeded.switchProject,
      "switch-preview-model": config.quotaExceeded.switchPreviewModel,
    };
  }
  if (config.wsAuth !== undefined) doc["ws-auth"] = config.wsAuth;
  if (config.requestLog !== undefined) doc["request-log"] = config.requestLog;

  if (config.geminiApiKey) doc["gemini-api-key"] = config.geminiApiKey;
  if (config.generativeLanguageApiKey) {
    doc["generative-language-api-key"] = config.generativeLanguageApiKey;
  }
  if (config.codexApiKey) doc["codex-api-key"] = config.codexApiKey;
  if (config.claudeApiKey) doc["claude-api-key"] = config.claudeApiKey;
  if (config.openaiCompatibility) doc["openai-compatibility"] = config.openaiCompatibility;
  if (config.payload) doc.payload = config.payload;
  if (config.auth) doc.auth = config.auth;
  if (config.extra) Object.assign(doc, config.extra);

  return YAML.stringify(doc);
}
