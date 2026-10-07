import { expect, test } from "@playwright/test";
import { periodoPadraoRelatorio } from "../src/features/reports/client/period.js";

test("report default period contains 30 calendar days and ends today", () => {
  const period = periodoPadraoRelatorio(new Date(2026, 9, 1, 12));

  expect(period).toEqual({ inicio: "2026-09-02", fim: "2026-10-01" });
});

test("report default period crosses month and year boundaries", () => {
  const period = periodoPadraoRelatorio(new Date(2026, 0, 10, 12));

  expect(period).toEqual({ inicio: "2025-12-12", fim: "2026-01-10" });
});
