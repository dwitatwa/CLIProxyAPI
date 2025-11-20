import type { ChildProcess } from "child_process";

export type SupportedOS = "linux" | "darwin" | "windows";
export type SupportedArch = "amd64" | "arm64" | "386";

export interface RemoteManagementConfig {
  allowRemote?: boolean;
  secretKey?: string;
  disableControlPanel?: boolean;
}

export interface QuotaExceededConfig {
  switchProject?: boolean;
  switchPreviewModel?: boolean;
}

export interface ModelAlias {
  name: string;
  alias?: string;
}

export interface APIKeyEntry {
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  proxyUrl?: string;
  models?: ModelAlias[];
}

export interface OpenAICompatibilityEntry {
  name: string;
  baseUrl: string;
  headers?: Record<string, string>;
  apiKeyEntries?: Array<{ apiKey: string; proxyUrl?: string }>;
  apiKeys?: string[];
  models?: ModelAlias[];
}

export interface PayloadRule {
  models: Array<{ name: string; protocol?: string }>;
  params: Record<string, unknown>;
}

export interface PayloadConfig {
  default?: PayloadRule[];
  override?: PayloadRule[];
}

export interface ProxyConfig {
  port?: number;
  remoteManagement?: RemoteManagementConfig;
  authDir?: string;
  apiKeys?: string[];
  debug?: boolean;
  loggingToFile?: boolean;
  usageStatisticsEnabled?: boolean;
  proxyUrl?: string;
  requestRetry?: number;
  quotaExceeded?: QuotaExceededConfig;
  wsAuth?: boolean;
  requestLog?: boolean;
  geminiApiKey?: APIKeyEntry[];
  generativeLanguageApiKey?: string[];
  codexApiKey?: APIKeyEntry[];
  claudeApiKey?: APIKeyEntry[];
  openaiCompatibility?: OpenAICompatibilityEntry[];
  payload?: PayloadConfig;
  auth?: unknown;
  extra?: Record<string, unknown>;
}

export type StatusEvent = "starting" | "ready" | "exited" | "error";

export interface HealthCheckOptions {
  path?: string;
  apiKey?: string;
  intervalMs?: number;
  retries?: number;
}

export interface StartProxyOptions {
  version?: string;
  config: ProxyConfig;
  binaryPath?: string;
  port?: number;
  env?: Record<string, string>;
  logConsumer?: (entry: { source: "stdout" | "stderr"; line: string }) => void;
  onStatus?: (status: StatusEvent, detail?: unknown) => void;
  healthCheck?: HealthCheckOptions;
  readyTimeoutMs?: number;
}

export interface RunningProxy {
  url: string;
  port: number;
  configPath: string;
  process: ChildProcess;
  stop: () => Promise<void>;
}

export type LoginProvider =
  | "gemini"
  | "codex"
  | "claude"
  | "qwen"
  | "iflow"
  | "iflow-cookie";

export interface LoginOptions {
  authDir: string;
  version?: string;
  binaryPath?: string;
  provider?: LoginProvider;
  noBrowser?: boolean;
  projectId?: string;
  env?: Record<string, string>;
  logConsumer?: (entry: { source: "stdout" | "stderr"; line: string }) => void;
}
