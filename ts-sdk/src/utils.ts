import { spawn } from "child_process";
import { createWriteStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import * as os from "os";
import * as path from "path";
import * as net from "net";
import type { SupportedArch, SupportedOS } from "./types";

export function resolvePlatform(): { os: SupportedOS; arch: SupportedArch } {
  const platform = os.platform();
  const arch = os.arch();

  const osMap: Partial<Record<NodeJS.Platform, SupportedOS>> = {
    linux: "linux",
    darwin: "darwin",
    win32: "windows",
    aix: "linux",
    freebsd: "linux",
    openbsd: "linux",
    sunos: "linux",
    android: "linux",
    haiku: "linux",
    cygwin: "windows",
    netbsd: "linux",
  };

  const archMap: Record<string, SupportedArch> = {
    x64: "amd64",
    amd64: "amd64",
    arm64: "arm64",
    ia32: "386",
  };

  const mappedOS = osMap[platform] ?? "linux";
  const mappedArch = archMap[arch] ?? "amd64";

  return { os: mappedOS, arch: mappedArch };
}

export function buildAssetInfo(
  version: string,
  osName: SupportedOS,
  arch: SupportedArch,
): { url: string; archiveName: string; isZip: boolean } {
  const isZip = osName === "windows";
  const sanitizedVersion = version.replace(/^v/, "");
  const archiveName = `CLIProxyAPI_${sanitizedVersion}_${osName}_${arch}${isZip ? ".zip" : ".tar.gz"}`;
  const tag = version === "latest" ? "latest" : version;
  const url = `https://github.com/router-for-me/CLIProxyAPI/releases/download/${tag}/${archiveName}`;
  return { url, archiveName, isZip };
}

export async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const fileStream = createWriteStream(dest);
  await pipeline(res.body, fileStream);
}

export async function extractArchive(archive: string, dest: string, isZip: boolean): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  if (isZip) {
    const powershell = process.env.ComSpec?.toLowerCase().includes("powershell")
      ? process.env.ComSpec
      : "powershell";
    await runCommand(powershell, [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path "${archive}" -DestinationPath "${dest}" -Force`,
    ]);
  } else {
    await runCommand("tar", ["-xzf", archive, "-C", dest]);
  }
}

export async function runCommand(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

export async function findBinary(dest: string): Promise<string | undefined> {
  const preferred = new Set([
    "cliproxyapi",
    "cliproxyapi.exe",
    "CLIProxyAPI",
    "CLIProxyAPI.exe",
    "cli-proxy-api",
    "cli-proxy-api.exe",
  ]);

  const stack = [dest];
  while (stack.length) {
    const dir = stack.pop() as string;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (preferred.has(entry.name)) {
        return full;
      }
    }
  }
  return undefined;
}

export async function chmodExecutable(binary: string): Promise<void> {
  if (os.platform() === "win32") return;
  await fs.chmod(binary, 0o755);
}

export function cacheDir(): string {
  const envDir =
    process.env.CLIPROXYAPI_CACHE_DIR ||
    process.env.CLIPROXY_CACHE_DIR ||
    process.env.CLI_PROXY_API_CACHE_DIR;
  if (envDir && envDir.trim() !== "") {
    return path.resolve(envDir, "bin");
  }
  // Default to project-local cache under the current working directory.
  return path.join(process.cwd(), ".cliproxy-cache", "bin");
}

export async function findOpenPort(preferred?: number): Promise<number> {
  if (preferred) {
    const ok = await isPortAvailable(preferred);
    if (ok) return preferred;
  }
  return new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const address = srv.address();
      if (typeof address === "object" && address?.port) {
        const port = address.port;
        srv.close(() => resolve(port));
      } else {
        srv.close();
        reject(new Error("failed to allocate port"));
      }
    });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, () => {
      srv.close(() => resolve(true));
    });
  });
}
