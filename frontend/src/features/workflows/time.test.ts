import { expect, it } from "vitest";
import { formatRemaining } from "./time";

it.each([
  [0, "Deadline reached"],
  [59, "0 min 59 s left"],
  [90, "1 min 30 s left"],
  [299, "4 min 59 s left"],
  [300, "5 min left"],
  [3599, "59 min left"],
  [3600, "1 h left"],
  [6300, "1 h 45 min left"],
  [10800, "3 h left"],
  [86399, "23 h 59 min left"],
])("formats %i seconds as %s", (seconds, label) =>
  expect(formatRemaining(seconds)).toBe(label),
);
