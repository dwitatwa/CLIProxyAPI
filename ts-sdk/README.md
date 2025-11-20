# CLIProxyAPI TypeScript Wrapper

Helps TypeScript/Node projects download a CLIProxyAPI release binary from GitHub, generate a `config.yaml` from a JS object, start the proxy as a child process, stream logs/events, and wait until the server is ready.

## Install

```bash
npm install cliproxyapi-ts
```

> The package expects CLIProxyAPI releases published under `router-for-me/CLIProxyAPI` with assets named `cliproxyapi_<os>_<arch>.tar.gz` (Linux/macOS) or `cliproxyapi_<os>_<arch>.zip` (Windows).

## Usage

```ts
import { startProxy, performLogin } from "cliproxyapi-ts";

async function main() {
  // One-time login (optional helper, still uses the binary under the hood)
  await performLogin({
    authDir: process.env.HOME + "/.cli-proxy-api",
    provider: "gemini", // default
    noBrowser: false,   // set true for device-code flow
    version: "v6.3.57", // must match a release tag; assets include the version
    // binaryPath: "/path/to/CLIProxyAPI_6.3.57_linux_amd64/cli-proxy-api", // optional override
    // projectId: "<gemini-project-id>",
    logConsumer: ({ source, line }) => console.log(`[login ${source}] ${line}`),
  });

  const proxy = await startProxy({
    version: "v6.3.57", // GitHub release tag
    config: {
      apiKeys: ["example-key"],
      // Any config fields from config.example.yaml
    },
    logConsumer: ({ source, line }) => console.log(`[${source}] ${line}`),
    onStatus: (status, detail) => console.log("status", status, detail ?? ""),
  });

  console.log("Proxy ready at", proxy.url);

  // ... call the proxy ...

  await proxy.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## API surface

- `startProxy(options)` returns `{ url, port, configPath, stop, process }`.
- `performLogin(options)` runs the OAuth/device-code login flow for Gemini/Claude/Qwen/Codex/iFlow using the downloaded binary (saves tokens to `authDir`).
- `options.config` is a camelCase object that maps onto `config.example.yaml` (fields are converted to CLIProxyAPI's kebab-case keys).
- `options.version` (default `latest`) should match a release tag like `v6.3.57`. Asset names include the version (e.g., `CLIProxyAPI_6.3.57_linux_amd64.tar.gz`), so set this to the tag you want.
- `options.binaryPath` skips download if you already have a binary (valid for both `startProxy` and `performLogin`).
- `options.logConsumer` receives `{ source: "stdout" | "stderr"; line: string }`.
- `options.onStatus` emits `"starting" | "ready" | "exited" | "error"`.
- `options.healthCheck` controls path/retries; defaults to polling `/v1/models`.
- `options.cacheDir` is not a parameter; instead set env `CLIPROXYAPI_CACHE_DIR` (or `CLIPROXY_CACHE_DIR` / `CLI_PROXY_API_CACHE_DIR`) to change where binaries are cached. Default is `~/.cliproxyapi/bin`.

### OAuth helper: which provider?
- `provider: "gemini"` (default) -> `--login`
- `"codex"` -> `--codex-login`
- `"claude"` -> `--claude-login`
- `"qwen"` -> `--qwen-login`
- `"iflow"` -> `--iflow-login`
- `"iflow-cookie"` -> `--iflow-cookie`

`authDir` must be the same path you later pass to `startProxy` (so the proxy can read the saved tokens).

## Notes

- Requires Node 18+ (uses `fetch` and async/await).
- On Linux/macOS extraction uses the system `tar`; on Windows it uses `powershell Expand-Archive`.
- A temporary `config.yaml` is written under the OS temp dir and removed when `stop()` is called.

### Where are binaries cached?
- Default: `./.cliproxy-cache/bin/<version>/<os>-<arch>/` (relative to the process working directory)
- Override by setting an env var (e.g., per-project):
  - `CLIPROXYAPI_CACHE_DIR=./.cliproxy-cache` (preferred)
  - or `CLIPROXY_CACHE_DIR` / `CLI_PROXY_API_CACHE_DIR`
  The SDK appends `/bin` under that directory.
