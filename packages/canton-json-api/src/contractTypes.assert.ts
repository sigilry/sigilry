import type {
  GetActiveContractsRequest,
  GetLedgerEndResponse,
  GetUpdatesRequest,
  GetV2InteractiveSubmissionPreferredPackageVersionData,
} from "./generated/types.gen";
import {
  zGetActiveContractsRequest,
  zGetLedgerEndResponse,
  zGetUpdatesRequest,
} from "./generated/zod.gen";
import type { output as ZodOutput } from "zod";

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type LedgerEndOffsetIsBigint = Assert<IsEqual<GetLedgerEndResponse["offset"], bigint>>;

type LedgerEndZodOutput = ZodOutput<typeof zGetLedgerEndResponse>;
type LedgerEndZodOffsetIsBigint = Assert<IsEqual<LedgerEndZodOutput["offset"], bigint>>;

type PreferredPackageVersionQuery = GetV2InteractiveSubmissionPreferredPackageVersionData["query"];
type PreferredPackageVersionVettingValidAtIsString = Assert<
  IsEqual<PreferredPackageVersionQuery["vetting_valid_at"], string | undefined>
>;

type UpdatesBeginExclusiveIsBigint = Assert<IsEqual<GetUpdatesRequest["beginExclusive"], bigint>>;
type UpdatesEndInclusiveIsBigintOrUndefined = Assert<
  IsEqual<GetUpdatesRequest["endInclusive"], bigint | undefined>
>;
type ActiveContractsOffsetIsBigint = Assert<
  IsEqual<GetActiveContractsRequest["activeAtOffset"], bigint>
>;

type UpdatesRequestZodOutput = ZodOutput<typeof zGetUpdatesRequest>;
type UpdatesBeginExclusiveZodOutputIsBigint = Assert<
  IsEqual<UpdatesRequestZodOutput["beginExclusive"], bigint>
>;

type ActiveContractsRequestZodOutput = ZodOutput<typeof zGetActiveContractsRequest>;
type ActiveContractsOffsetZodOutputIsBigint = Assert<
  IsEqual<ActiveContractsRequestZodOutput["activeAtOffset"], bigint>
>;

export type ContractTypeAssertions = [
  LedgerEndOffsetIsBigint,
  LedgerEndZodOffsetIsBigint,
  PreferredPackageVersionVettingValidAtIsString,
  UpdatesBeginExclusiveIsBigint,
  UpdatesEndInclusiveIsBigintOrUndefined,
  ActiveContractsOffsetIsBigint,
  UpdatesBeginExclusiveZodOutputIsBigint,
  ActiveContractsOffsetZodOutputIsBigint,
];
