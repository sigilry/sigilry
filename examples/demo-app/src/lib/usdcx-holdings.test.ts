import { describe, expect, test } from "bun:test";

import {
  extractUsdcxHoldingsFromPayload,
  selectHoldingsForAmount,
  type UsdcxHolding,
} from "./usdcx-holdings";

const USDCX = {
  admin:
    "decentralized-usdc-interchain-rep::122049e2af8a725bd19759320fc83c638e7718973eac189d8f201309c512d1ffec61",
  id: "USDCx",
} as const;

const SENDER = "sender::1220abcd";

const holding = (overrides: Partial<UsdcxHolding>): UsdcxHolding => ({
  contractId: "cid-1",
  owner: SENDER,
  amount: "1.00",
  instrumentAdmin: USDCX.admin,
  instrumentId: USDCX.id,
  locked: false,
  ...overrides,
});

const holdingViewValue = ({
  owner = { party: SENDER },
  amount = { numeric: "4.25" },
  instrumentAdmin = { party: USDCX.admin },
  instrumentId = { text: USDCX.id },
  lock = null,
  extraFields = [] as Array<{ label: string; value: unknown }>,
}: {
  owner?: unknown;
  amount?: unknown;
  instrumentAdmin?: unknown;
  instrumentId?: unknown;
  lock?: unknown;
  extraFields?: Array<{ label: string; value: unknown }>;
}) => ({
  record: {
    fields: [
      { label: "owner", value: owner },
      { label: "amount", value: amount },
      {
        label: "instrumentId",
        value: {
          record: {
            fields: [
              { label: "admin", value: instrumentAdmin },
              { label: "id", value: instrumentId },
            ],
          },
        },
      },
      { label: "lock", value: lock },
      ...extraFields,
    ],
  },
});

const holdingsPayload = (viewValue: unknown) => ({
  result: {
    updates: [
      {
        createdEvent: {
          contractId: "00holding",
          interfaceViews: [{ viewValue }],
        },
      },
    ],
  },
});

describe("selectHoldingsForAmount", () => {
  test("picks the minimum set by preferring larger holdings first", () => {
    const result = selectHoldingsForAmount(
      [
        holding({ contractId: "cid-1", amount: "2.00" }),
        holding({ contractId: "cid-2", amount: "4.00" }),
        holding({ contractId: "cid-3", amount: "3.00" }),
      ],
      "5.00",
    );

    expect(result).toEqual({
      selected: [
        holding({ contractId: "cid-2", amount: "4.00" }),
        holding({ contractId: "cid-3", amount: "3.00" }),
      ],
      total: 7,
    });
  });

  test("returns every holding when the available balance is insufficient", () => {
    const result = selectHoldingsForAmount(
      [
        holding({ contractId: "cid-1", amount: "1.50" }),
        holding({ contractId: "cid-2", amount: "0.25" }),
      ],
      "10.00",
    );

    expect(result).toEqual({
      selected: [
        holding({ contractId: "cid-1", amount: "1.50" }),
        holding({ contractId: "cid-2", amount: "0.25" }),
      ],
      total: 1.75,
    });
  });
});

describe("extractUsdcxHoldingsFromPayload", () => {
  test("extracts matching holdings from created-event interface views", () => {
    const payload = {
      result: {
        updates: [
          {
            createdEvent: {
              contractId: "00holding",
              interfaceViews: [
                {
                  viewValue: holdingViewValue({
                    extraFields: [{ label: "memo", value: { text: "ignored" } }],
                  }),
                },
                {
                  viewValue: holdingViewValue({
                    amount: { numeric: "9.99" },
                    instrumentAdmin: { party: "other-admin::1220" },
                    instrumentId: { text: "OTHER" },
                    lock: { record: { fields: [] } },
                  }),
                },
              ],
            },
          },
        ],
      },
    };

    expect(
      extractUsdcxHoldingsFromPayload(payload, {
        senderPartyId: SENDER,
        usdcx: USDCX,
      }),
    ).toEqual([
      {
        contractId: "00holding",
        owner: SENDER,
        amount: "4.25",
        instrumentAdmin: USDCX.admin,
        instrumentId: USDCX.id,
        locked: false,
      },
    ]);
  });

  test("throws when amount is missing instead of fabricating from another field", () => {
    const payload = holdingsPayload({
      record: {
        fields: [
          { label: "owner", value: { party: SENDER } },
          {
            label: "instrumentId",
            value: {
              record: {
                fields: [
                  { label: "admin", value: { party: USDCX.admin } },
                  { label: "id", value: { text: USDCX.id } },
                ],
              },
            },
          },
          { label: "lock", value: null },
        ],
      },
    });

    expect(() =>
      extractUsdcxHoldingsFromPayload(payload, {
        senderPartyId: SENDER,
        usdcx: USDCX,
      }),
    ).toThrow(/amount/i);
  });

  test("throws when the lock field is missing", () => {
    const payload = holdingsPayload({
      record: {
        fields: [
          { label: "owner", value: { party: SENDER } },
          { label: "amount", value: { numeric: "4.25" } },
          {
            label: "instrumentId",
            value: {
              record: {
                fields: [
                  { label: "admin", value: { party: USDCX.admin } },
                  { label: "id", value: { text: USDCX.id } },
                ],
              },
            },
          },
        ],
      },
    });

    expect(() =>
      extractUsdcxHoldingsFromPayload(payload, {
        senderPartyId: SENDER,
        usdcx: USDCX,
      }),
    ).toThrow(/lock/i);
  });

  test("throws when required holding fields have the wrong types", () => {
    const payload = holdingsPayload(
      holdingViewValue({
        amount: { bool: true },
      }),
    );

    expect(() =>
      extractUsdcxHoldingsFromPayload(payload, {
        senderPartyId: SENDER,
        usdcx: USDCX,
      }),
    ).toThrow(/amount/i);
  });
});
