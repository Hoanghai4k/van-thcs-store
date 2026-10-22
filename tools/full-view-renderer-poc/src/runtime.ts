import { spawn } from "node:child_process";

export interface SpawnExecutionResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: Error;
}

/**
 * Safely executes an external process with an argument array.
 * NEVER concatenates arguments into shell strings.
 * Enforces timeout and handles spaces in Windows paths safely.
 */
export function safeSpawn(
  executable: string,
  args: string[],
  options?: {
    timeoutMs?: number;
    cwd?: string;
  }
): Promise<SpawnExecutionResult> {
  const timeoutMs = options?.timeoutMs ?? 30000;

  return new Promise((resolve) => {
    let stdoutData = "";
    let stderrData = "";
    let timedOut = false;

    let timer: NodeJS.Timeout | undefined;

    const child = spawn(executable, args, {
      cwd: options?.cwd,
      windowsHide: true,
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

export interface RuntimeAudit {
  nodeVersion: string;
  npmVersion?: string;
  dockerAvailable: boolean;
  libreOfficeAvailable: boolean;
  popplerAvailable: boolean;
  cwebpAvailable: boolean;
}

/**
 * Probes the local machine environment for available rendering tools
 * without throwing unhandled exceptions.
 */
export async function auditLocalRuntime(): Promise<RuntimeAudit> {
  const nodeVersion = process.version;

  const [dockerRes, sofficeRes, popplerRes, cwebpRes] = await Promise.all([
    safeSpawn("docker", ["--version"], { timeoutMs: 3000 }),
    safeSpawn("soffice", ["--version"], { timeoutMs: 3000 }),
    safeSpawn("pdftoppm", ["-v"], { timeoutMs: 3000 }),
    safeSpawn("cwebp", ["-version"], { timeoutMs: 3000 }),
  ]);

  return {
    nodeVersion,
    dockerAvailable: dockerRes.code === 0,
    libreOfficeAvailable: sofficeRes.code === 0,
    popplerAvailable: popplerRes.code === 0,
    cwebpAvailable: cwebpRes.code === 0,
  };
}
