import { GlobalRegistrator } from "@happy-dom/global-registrator";

const globalState = globalThis as typeof globalThis & {
  __sigilryReactTestDomRegistered__?: boolean;
};

if (!globalState.__sigilryReactTestDomRegistered__) {
  GlobalRegistrator.register();
  globalState.__sigilryReactTestDomRegistered__ = true;
}
