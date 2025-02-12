/**
 * This enum is a set of compile time constants that represent the performance limits to prevent
 * unsafe statistics gathering.
 */
export const enum PerformanceLimits {
  MaxSamples = 10000,
  MaxTestRuntime = 5000,
  MinimumDecimalPlaces = 0,
  MaximumDecimalPlaces = 8,
};
