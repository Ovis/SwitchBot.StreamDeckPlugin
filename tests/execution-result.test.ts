import { describe, expectTypeOf, it } from "vitest";
import type {
  ExecutionFailureResult,
  ExecutionResult,
  ExecutionSuccessResult
} from "../src/execution/execution-result.js";

describe("ExecutionResult", () => {
  it("successでresponseとerrorの型を判別できる", () => {
    const assertResult = (result: ExecutionResult): void => {
      if (result.success) {
        expectTypeOf(result).toEqualTypeOf<ExecutionSuccessResult>();
        expectTypeOf(result.response.httpStatus).toEqualTypeOf<number>();
      } else {
        expectTypeOf(result).toEqualTypeOf<ExecutionFailureResult>();
        expectTypeOf(result.error.category).toMatchTypeOf<string>();
      }
    };

    expectTypeOf(assertResult).toBeFunction();
  });
});
