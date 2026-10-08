import { createCantonClient, WindowTransport } from "@sigilry/dapp";

export async function getStatus() {
  const transport = new WindowTransport(window, { timeout: 30000 });
  const client = createCantonClient(transport);
  return await client.status();
}
