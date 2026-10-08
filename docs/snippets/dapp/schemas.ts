declare const data: unknown;
// ---cut---
import { StatusEventSchema, type StatusEvent } from "@sigilry/dapp/schemas";

const status: StatusEvent = StatusEventSchema.parse(data);
