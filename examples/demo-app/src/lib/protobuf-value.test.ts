import { describe, expect, test } from "bun:test";

import {
  scanValueToAnyValue,
  vContractId,
  vList,
  vNumeric,
  vParty,
  vRecord,
  vText,
  vTextMap,
  vTimestamp,
} from "./protobuf-value";

describe("protobuf-value helpers", () => {
  test("vRecord nests correctly", () => {
    expect(
      vRecord([
        [
          "transfer",
          vRecord([
            ["sender", vParty("sender::1220")],
            ["amount", vNumeric("1.00")],
          ]),
        ],
      ]),
    ).toEqual({
      record: {
        fields: [
          {
            label: "transfer",
            value: {
              record: {
                fields: [
                  { label: "sender", value: { party: "sender::1220" } },
                  { label: "amount", value: { numeric: "1.00" } },
                ],
              },
            },
          },
        ],
      },
    });
  });

  test("vTextMap preserves entry order and values", () => {
    expect(
      vTextMap([
        { key: "alpha", value: vText("one") },
        { key: "beta", value: vContractId("00deadbeef") },
      ]),
    ).toEqual({
      textMap: {
        entries: [
          { key: "alpha", value: { text: "one" } },
          { key: "beta", value: { contractId: "00deadbeef" } },
        ],
      },
    });
  });

  test("scanValueToAnyValue converts Scan tagged values into protobuf AnyValue variants", () => {
    expect(scanValueToAnyValue({ tag: "AV_ContractId", value: "00abc" })).toEqual({
      variant: {
        constructor: "AV_ContractId",
        value: { contractId: "00abc" },
      },
    });

    expect(scanValueToAnyValue({ tag: "AV_Text", value: "hello" })).toEqual({
      variant: {
        constructor: "AV_Text",
        value: { text: "hello" },
      },
    });

    expect(scanValueToAnyValue({ tag: "AV_Bool", value: true })).toEqual({
      variant: {
        constructor: "AV_Bool",
        value: { bool: true },
      },
    });

    expect(
      scanValueToAnyValue({
        tag: "AV_List",
        value: ["hello", { tag: "AV_ContractId", value: "00def" }],
      }),
    ).toEqual({
      variant: {
        constructor: "AV_List",
        value: {
          list: {
            elements: [
              {
                variant: {
                  constructor: "AV_Text",
                  value: { text: "hello" },
                },
              },
              {
                variant: {
                  constructor: "AV_ContractId",
                  value: { contractId: "00def" },
                },
              },
            ],
          },
        },
      },
    });
  });

  test("typed helper input produces the expected protobuf JSON shape", () => {
    expect(
      vRecord([
        ["receiver", vParty("receiver::1220")],
        ["requestedAt", vTimestamp("2026-04-21T12:34:56.000Z")],
        ["inputHoldingCids", vList([vContractId("cid-1"), vContractId("cid-2")])],
      ]),
    ).toEqual({
      record: {
        fields: [
          { label: "receiver", value: { party: "receiver::1220" } },
          { label: "requestedAt", value: { timestamp: "1776774896000000" } },
          {
            label: "inputHoldingCids",
            value: {
              list: {
                elements: [{ contractId: "cid-1" }, { contractId: "cid-2" }],
              },
            },
          },
        ],
      },
    });
  });
});
