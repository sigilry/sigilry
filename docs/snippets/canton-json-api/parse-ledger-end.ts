import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";

const parsed = zGetLedgerEndResponse.parse({ offset: "42" });
const offset: bigint = parsed.offset;
console.log(offset);
