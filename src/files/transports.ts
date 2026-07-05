import { createHash } from "node:crypto";
import SftpClient from "ssh2-sftp-client";

export interface RemoteFile {
  /** Stable identity used to remember processed files (name for SFTP, content hash for HTTPS). */
  key: string;
  name: string;
  content: string;
}

export interface SftpEndpointConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  private_key?: string;
  remote_path: string;
}

export interface HttpsEndpointConfig {
  url: string;
  auth_header?: string;
}

/**
 * Lists `remote_path`, downloads regular files not yet in `processed`.
 * Credentials come only from the endpoint's config jsonb and are never logged.
 */
export async function fetchSftpFiles(config: SftpEndpointConfig, processed: Set<string>): Promise<RemoteFile[]> {
  if (!config.host || !config.username || !config.remote_path) {
    throw new Error("sftp config requires host, username, remote_path");
  }
  const client = new SftpClient();
  try {
    await client.connect({
      host: config.host,
      port: config.port ?? 22,
      username: config.username,
      password: config.password,
      privateKey: config.private_key,
      readyTimeout: 15_000,
    });
    const listing = await client.list(config.remote_path);
    const files: RemoteFile[] = [];
    for (const entry of listing) {
      if (entry.type !== "-") continue;
      if (processed.has(entry.name)) continue;
      const buf = (await client.get(`${config.remote_path.replace(/\/$/, "")}/${entry.name}`)) as Buffer;
      files.push({ key: entry.name, name: entry.name, content: buf.toString("utf8") });
    }
    return files;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Fetches the configured URL; the content hash is the processed-file identity
 * so an unchanged document is not ingested twice.
 */
export async function fetchHttpsFile(config: HttpsEndpointConfig, processed: Set<string>): Promise<RemoteFile[]> {
  if (!config.url) throw new Error("https config requires url");
  const headers: Record<string, string> = {};
  if (config.auth_header) headers.Authorization = config.auth_header;
  const res = await fetch(config.url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`fetch failed with status ${res.status}`);
  const content = await res.text();
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 32);
  if (processed.has(hash)) return [];
  const name = new URL(config.url).pathname.split("/").pop() || "download";
  return [{ key: hash, name, content }];
}
