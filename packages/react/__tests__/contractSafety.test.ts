import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const hooksDir = join(import.meta.dir, "..", "src", "hooks");

function readHook(fileName: string): string {
  return readFileSync(join(hooksDir, fileName), "utf8");
}

describe("ledger contract safety guards", () => {
  test("ledger hooks do not use unsafe cast bypasses", () => {
    const files = [
      "useActiveContracts.ts",
      "useLedgerEnd.ts",
      "useLedgerUpdates.ts",
      "ledgerApiContract.ts",
    ];

    for (const file of files) {
      const source = readHook(file);
      expect(source).not.toContain("as unknown as");
      expect(source).not.toContain("as any");
    }
  });

  test("ledger hooks use canonical request body builders", () => {
    const activeContractsSource = readHook("useActiveContracts.ts");
    const updatesSource = readHook("useLedgerUpdates.ts");

    expect(activeContractsSource).toContain("buildActiveContractsRequestBody(");
    expect(activeContractsSource).not.toContain("JSON.stringify(activeContractsRequest)");

    expect(updatesSource).toContain("buildUpdatesFlatsRequestBody(");
    expect(updatesSource).not.toContain("JSON.stringify(updatesRequest)");
  });
});
