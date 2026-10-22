import { spawn } from "node:child_process";

export interface SafeSpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: Error;
}

export interface SafeSpawnOptions {
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Safely executes an external CLI process using an explicit argument array.
 * NEVER concatenates command arguments into shell strings, completely avoiding shell injection.
 * Enforces strict timeout watchdog and clean resource cleanup.
 */
export function safeSpawn(
  executable: string,
  args: string[],
  options?: SafeSpawnOptions
): Promise<SafeSpawnResult> {
  const timeoutMs = options?.timeoutMs ?? 30000;

  return new Promise((resolve) => {
    let stdoutData = "";
    let stderrData = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    const child = spawn(executable, args, {
      cwd: options?.cwd,
      env: options?.env ?? process.env,
      windowsHide: true,
      shell: false, // Strict: no shell invocation
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutData += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrData += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        code: null,
        stdout: stdoutData,
        stderr: stderrData,
        timedOut,
        error: err,
      });
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        code,
        stdout: stdoutData,
        stderr: stderrData,
        timedOut,
      });
    });
  });
}
