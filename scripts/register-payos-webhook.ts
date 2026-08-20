/**
 * Register payOS Webhook URL.
 *
 * Server-only CLI script that confirms the webhook URL with payOS.
 * Uses the official @payos/node SDK.
 *
 * Usage:
 *   npx tsx scripts/register-payos-webhook.ts https://your-domain.com/api/payments/payos/webhook
 *
 * Requirements:
 * - PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY must be set in env
 * - The URL must be publicly reachable HTTPS
 * - The webhook endpoint must respond to payOS probe with 200
 *
 * SECURITY:
 * - Never prints API keys or checksum keys
 * - Must NOT run during build or deployment
 * - Must NOT be callable from browser
 */

import { PayOS } from "@payos/node";

async function main() {
  const webhookUrl = process.argv[2];

  if (!webhookUrl) {
    console.error("Usage: npx tsx scripts/register-payos-webhook.ts <webhook-url>");
    console.error("Example: npx tsx scripts/register-payos-webhook.ts https://your-domain.com/api/payments/payos/webhook");
    process.exit(1);
  }

  // Validate URL format
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "https:") {
      console.error("ERROR: Webhook URL must use HTTPS.");
      process.exit(1);
    }
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.startsWith("192.168.")) {
      console.error("ERROR: Webhook URL must be a public domain, not localhost.");
      process.exit(1);
    }
  } catch {
    console.error("ERROR: Invalid URL format.");
    process.exit(1);
  }

  // Check env
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    console.error("ERROR: Missing payOS credentials. Set PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY in env.");
    process.exit(1);
  }

  console.log(`Registering webhook URL: ${webhookUrl}`);
  console.log("Using payOS credentials: [present, not printed]");

  try {
    const payos = new PayOS({ clientId, apiKey, checksumKey });
    const result = await payos.webhooks.confirm(webhookUrl);

    console.log("\n✅ Webhook registered successfully!");
    console.log("Response:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n❌ Webhook registration failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
