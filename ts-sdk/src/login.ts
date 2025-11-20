import { spawn } from "child_process";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { buildConfigYaml } from "./config";
import { ensureBinary } from "./downloader";
import type { LoginOptions, LoginProvider } from "./types";

export async function performLogin(options: LoginOptions): Promise<void> {
  const version = options.version ?? "latest";
  const provider: LoginProvider = options.provider ?? "gemini";
  const binary = options.binaryPath ?? (await ensureBinary(version));

  const authDir = options.authDir;
  await fs.mkdir(authDir, { recursive: true });

  const flag = providerFlag(provider);
  // Build a minimal config that sets auth-dir; port 0 is fine for login mode.
  const configYaml = buildConfigYaml({ authDir }, 0);
  const configPath = await writeTempConfig(configYaml);

  const args = [flag, "--config", configPath];
  if (options.noBrowser) args.push("--no-browser");
  if (options.projectId) args.push("--project_id", options.projectId);

  const child = spawn(binary, args, {
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  streamLines(child.stdout, "stdout", options.logConsumer);
  streamLines(child.stderr, "stderr", options.logConsumer);

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      void cleanupTemp(configPath);
      if (code === 0) resolve();
      else reject(new Error(`login flow exited with code ${code ?? -1}`));
    });
  });
}

function providerFlag(provider: LoginProvider): string {
  switch (provider) {
    case "gemini":
      return "--login";
    case "codex":
      return "--codex-login";
    case "claude":
      return "--claude-login";
    case "qwen":
      return "--qwen-login";
    case "iflow":
      return "--iflow-login";
    case "iflow-cookie":
      return "--iflow-cookie";
    default:
      return "--login";
  }
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
    if (buffer.length > 0) consumer({ source, line: buffer.trimEnd() });
  });
}

async function writeTempConfig(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cliproxyapi-login-"));
  const file = path.join(dir, "config.yaml");
  await fs.writeFile(file, content, "utf8");
  return file;
}

async function cleanupTemp(configPath: string): Promise<void> {
  try {
    await fs.rm(path.dirname(configPath), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
