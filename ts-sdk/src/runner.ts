import { spawn, type ChildProcess } from "child_process";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { buildConfigYaml } from "./config";
import { ensureBinary } from "./downloader";
import { findOpenPort } from "./utils";
import type {
  HealthCheckOptions,
  RunningProxy,
  StartProxyOptions,
} from "./types";

export async function startProxy(options: StartProxyOptions): Promise<RunningProxy> {
  const version = options.version ?? "latest";
  const targetPort = await findOpenPort(options.port ?? options.config.port);
  const configYaml = buildConfigYaml(options.config, targetPort);
  const configPath = await writeTempConfig(configYaml);
  const binary = options.binaryPath ?? (await ensureBinary(version));

  options.onStatus?.("starting");
  const child = spawn(binary, ["--config", configPath], {
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  streamLines(child.stdout, "stdout", options.logConsumer);
  streamLines(child.stderr, "stderr", options.logConsumer);

  const readyPromise = waitForReady(targetPort, options.healthCheck, options.readyTimeoutMs, options.config);
  const exitPromise = new Promise<number>((resolve, reject) => {
    child.once("exit", (code) => resolve(code ?? -1));
    child.once("error", reject);
  });

  const code = await Promise.race([readyPromise.then(() => undefined), exitPromise]);
  if (typeof code === "number") {
    options.onStatus?.("exited", code);
    throw new Error(`CLIProxyAPI exited before ready (code ${code})`);
  }
  options.onStatus?.("ready");

  const stop = async () => {
    child.kill();
    const exitCode = await exitPromise.catch(() => -1);
    options.onStatus?.("exited", exitCode);
    await cleanupTemp(configPath);
  };

  return {
    url: `http://127.0.0.1:${targetPort}`,
    port: targetPort,
    configPath,
    process: child,
    stop,
  };
}

function streamLines(
  stream: NodeJS.ReadableStream | null,
  source: "stdout" | "stderr",
  consumer?: (entry: { source: "stdout" | "stderr"; line: string }) => void,
) {
  if (!stream || !consumer) return;
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      consumer({ source, line });
    }
  });
  stream.on("end", () => {
    if (buffer.length > 0) {
      consumer({ source, line: buffer.trimEnd() });
    }
  });
}

async function waitForReady(
  port: number,
  health: HealthCheckOptions | undefined,
  timeoutMs: number | undefined,
  config: StartProxyOptions["config"],
): Promise<void> {
  const apiKey = health?.apiKey ?? config.apiKeys?.[0];
  const healthPath = health?.path ?? "/v1/models";
  const interval = health?.intervalMs ?? 200;
  const retries = health?.retries ?? 60;

  const controller = new AbortController();
  const timer =
    timeoutMs !== undefined
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  try {
    for (let i = 0; i < retries; i += 1) {
      try {
        const headers: Record<string, string> | undefined = apiKey
          ? { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey }
          : undefined;
        const res = await fetch(`http://127.0.0.1:${port}${healthPath}`, {
          headers,
          signal: controller.signal,
        });
        if ((res.status >= 200 && res.status < 500) || res.status === 101) return;
      } catch {
        // keep retrying
      }
      await delay(interval, controller);
    }
    throw new Error("proxy did not become ready in time");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function delay(ms: number, controller?: AbortController): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    controller?.signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("wait cancelled"));
    });
  });
}

async function writeTempConfig(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cliproxyapi-"));
  const file = path.join(dir, "config.yaml");
  await fs.writeFile(file, content, "utf8");
  return file;
}

async function cleanupTemp(configPath: string): Promise<void> {
  try {
    const dir = path.dirname(configPath);
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
