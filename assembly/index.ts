import { describe, test, it, afterAll, afterEach, beforeAll, beforeEach, todo } from "./internal/test/describe";
import { expect, Expectation } from "./internal/Expectation";

import { log } from "./internal/test/log";
import {
  performanceEnabled,
  maxSamples,
  maxTestRunTime,
  roundDecimalPlaces,
  reportAverage,
  reportMedian,
  reportStdDev,
  reportMax,
  reportMin,
  reportVariance,
} from "./internal/performance";
export { __call } from "./internal/call";

// @ts-ignore: Decorators *are* valid here
@start
export function __main(): void {}
