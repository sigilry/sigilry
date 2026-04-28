import { describe, expect, test } from "bun:test";
import { useExerciseChoice } from "../src/hooks/useExerciseChoice.js";
import {
  act,
  DISCONNECTED_STATUS,
  createHookWrapper,
  createMockProvider,
  installMockProvider,
  registerTestIsolation,
  renderHook,
} from "./testUtils.js";

registerTestIsolation();

describe("useExerciseChoice", () => {
  test("sends Canton ExerciseCommand payloads with the choice field", async () => {
    let submittedParams: unknown;

    installMockProvider(
      createMockProvider(({ method, params }) => {
        if (method === "status") return DISCONNECTED_STATUS;
        if (method === "prepareExecuteAndWait") {
          submittedParams = params;
          return {
            tx: {
              status: "executed",
              commandId: "command-1",
              payload: {
                updateId: "update-1",
                completionOffset: 1,
              },
            },
          };
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useExerciseChoice(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.exerciseAsync({
        contractId: "contract-1",
        templateId: "Splice.Wallet.Payment:PaymentRequest",
        choice: "PaymentRequest_Accept",
        choiceArgument: { accepted: true },
        actAs: ["alice::1220"],
      });
    });

    expect(submittedParams).toEqual({
      commandId: undefined,
      commands: [
        {
          ExerciseCommand: {
            templateId: "Splice.Wallet.Payment:PaymentRequest",
            contractId: "contract-1",
            choice: "PaymentRequest_Accept",
            choiceArgument: { accepted: true },
          },
        },
      ],
      actAs: ["alice::1220"],
      readAs: undefined,
      synchronizerId: undefined,
    });
  });
});
