/**
 * SFTP transport integration test against a local atmoz/sftp container:
 *   docker compose -f docker-compose.test.yml up -d
 *   TEST_SFTP=1 npm test
 * Skipped unless TEST_SFTP is set.
 */
import { describe, expect, it } from "vitest";
import SftpClient from "ssh2-sftp-client";
import { fetchSftpFiles } from "../src/files/transports.js";

const config = {
  host: process.env.TEST_SFTP_HOST ?? "127.0.0.1",
  port: Number(process.env.TEST_SFTP_PORT ?? 2222),
  username: "gateway",
  password: "gatewaypass",
  remote_path: "/inbound",
};

describe.skipIf(!process.env.TEST_SFTP)("sftp transport (atmoz/sftp container)", () => {
  it("downloads new files and skips already-processed ones", async () => {
    const name = `inv-${Date.now()}.csv`;
    const content = "sku,qty\nLT245-75R17-E,12\n";

    const client = new SftpClient();
    await client.connect({ host: config.host, port: config.port, username: config.username, password: config.password });
    await client.put(Buffer.from(content), `${config.remote_path}/${name}`);
    await client.end();

    const files = await fetchSftpFiles(config, new Set());
    const mine = files.find((f) => f.name === name);
    expect(mine).toBeDefined();
    expect(mine!.content).toBe(content);
    expect(mine!.key).toBe(name);

    const again = await fetchSftpFiles(config, new Set([name]));
    expect(again.find((f) => f.name === name)).toBeUndefined();
  }, 30_000);
});
