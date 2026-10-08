import { requestProviders } from "@sigilry/dapp/discovery";

// Listen for announcements and trigger a request for any wallet already present.
const unsubscribe = requestProviders((detail) => {
  console.log("announced:", detail.rdns, detail.name);
});

// Later, when the picker unmounts:
unsubscribe?.();
