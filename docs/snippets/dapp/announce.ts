import { announceProvider } from "@sigilry/dapp/discovery";

announceProvider({
  id: "send-extension",
  name: "Send Connect",
  icon: "data:image/svg+xml;base64,...",
  target: "send-connect",
  rdns: "it.send.connect",
  uuid: crypto.randomUUID(),
});
