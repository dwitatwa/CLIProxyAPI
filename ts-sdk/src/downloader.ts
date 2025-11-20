import { promises as fs } from "fs";
import * as path from "path";
import {
  buildAssetInfo,
  cacheDir,
  chmodExecutable,
  downloadToFile,
  extractArchive,
  findBinary,
  resolvePlatform,
} from "./utils";

export async function ensureBinary(version = "latest"): Promise<string> {
  const { os, arch } = resolvePlatform();
  const baseDir = path.join(cacheDir(), version, `${os}-${arch}`);
  const existing = await tryFindExisting(baseDir);
  if (existing) return existing;

  const { url, archiveName, isZip } = buildAssetInfo(version, os, arch);
  const archivePath = path.join(baseDir, archiveName);
  await downloadToFile(url, archivePath);
  const extractDest = path.join(baseDir, "extracted");
  await extractArchive(archivePath, extractDest, isZip);
  const binary = await findBinary(extractDest);
  if (!binary) {
    throw new Error(`failed to locate CLIProxyAPI binary after extracting ${archiveName}`);
  }
  await chmodExecutable(binary);
  return binary;
}

async function tryFindExisting(baseDir: string): Promise<string | undefined> {
  try {
    await fs.access(baseDir);
  } catch {
    return undefined;
  }
  const extracted = path.join(baseDir, "extracted");
  const bin = await findBinary(extracted);
  if (bin) return bin;
  // Fall back to searching directly under baseDir in case archive unpacked differently.
  return findBinary(baseDir);
}
