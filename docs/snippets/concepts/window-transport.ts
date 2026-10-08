import { createCantonClient, WindowTransport } from "@sigilry/dapp";

async function getStatus() {
  const transport = new WindowTransport(window, {
    timeout: 30000,
    targetOrigin: "*",
  });

  const client = createCantonClient(transport);
  return await client.status();
}

getStatus().then(console.log);
