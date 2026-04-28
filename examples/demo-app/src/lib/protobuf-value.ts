/**
 * Lifted from the canton-usdcx-transfer gist into a typed module. See
 * `.rl/audit/GIST-MAPPING.md` for provenance. Canton ISS deserializes these
 * values via `fromJson(PrepareSubmissionRequestSchema)`, which expects the
 * protobuf Value wire format.
 */

export type ProtobufValue =
  | { party: string }
  | { text: string }
  | { numeric: string }
  | { contractId: string }
  | { timestamp: string }
  | { int64: string }
  | { bool: boolean }
  | { optional: { value?: ProtobufValue } }
  | { list: { elements: ProtobufValue[] } }
  | { record: { fields: Array<{ label: string; value: ProtobufValue }> } }
  | { textMap: { entries: Array<{ key: string; value: ProtobufValue }> } }
  | { variant: { constructor: string; value: ProtobufValue } };

type ProtobufField = [label: string, value: ProtobufValue];
type ProtobufTextMapEntry = { key: string; value: ProtobufValue };
type ScanScalar = string | number | boolean | null;
type ScanObject = { [key: string]: ScanScalar };

/** AnyValue variant from Scan/transfer-factory responses. */
export type ScanAnyValue =
  | string
  | { tag: "AV_Text"; value: string }
  | { tag: "AV_ContractId"; value: string }
  | { tag: "AV_Bool"; value: boolean }
  | { tag: "AV_List"; value: ScanAnyValue[] }
  | { tag: string; value: ScanScalar | ScanAnyValue[] | ScanObject };

export const vParty = (partyId: string): ProtobufValue => ({ party: partyId });

export const vText = (text: string): ProtobufValue => ({ text });

export const vNumeric = (numeric: string | number): ProtobufValue => ({
  numeric: String(numeric),
});

export const vContractId = (contractId: string): ProtobufValue => ({ contractId });

export const vTimestamp = (isoString: string): ProtobufValue => ({
  timestamp: String(Math.floor(new Date(isoString).getTime() * 1000)),
});

export const vRecord = (fields: ProtobufField[]): ProtobufValue => ({
  record: {
    fields: fields.map(([label, value]) => ({ label, value })),
  },
});

export const vList = (elements: ProtobufValue[]): ProtobufValue => ({
  list: { elements },
});

export const vTextMap = (entries: ProtobufTextMapEntry[]): ProtobufValue => ({
  textMap: { entries },
});

const stringifyScanValue = (value: ScanScalar | ScanAnyValue[] | ScanObject): string => {
  if (typeof value === "string") {
    return value;
  }

  return String(value);
};

export function scanValueToAnyValue(value: ScanAnyValue): ProtobufValue {
  if (typeof value === "string") {
    return {
      variant: {
        constructor: "AV_Text",
        value: vText(value),
      },
    };
  }

  switch (value.tag) {
    case "AV_ContractId":
      if (typeof value.value !== "string") {
        throw new TypeError("AV_ContractId values must be strings.");
      }
      return {
        variant: {
          constructor: value.tag,
          value: vContractId(value.value),
        },
      };
    case "AV_Bool":
      if (typeof value.value !== "boolean") {
        throw new TypeError("AV_Bool values must be booleans.");
      }
      return {
        variant: {
          constructor: value.tag,
          value: { bool: value.value },
        },
      };
    case "AV_List":
      if (!Array.isArray(value.value)) {
        throw new TypeError("AV_List values must be arrays.");
      }
      return {
        variant: {
          constructor: value.tag,
          value: vList(value.value.map(scanValueToAnyValue)),
        },
      };
    default:
      return {
        variant: {
          constructor: value.tag,
          value: vText(stringifyScanValue(value.value)),
        },
      };
  }
}
