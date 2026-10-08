import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicImpact } from "./PublicImpact";

const query = vi.hoisted(() => ({
  data: undefined as unknown,
  refresh: vi.fn(),
}));
vi.mock("../workflows/data", () => ({ useQuery: () => query }));
afterEach(cleanup);

describe("public community impact", () => {
  it("keeps the stats bar available and identifies illustrative totals", () => {
    query.data = {
      data: {
        includes_demo_data: true,
        delivered_kg: "10",
        estimated_meals: "25",
        active_listings: 3,
      },
    };
    render(<PublicImpact />);
    expect(
      screen.getByRole("region", { name: "Shared this month" }),
    ).toBeVisible();
    expect(screen.getByText("Preview totals")).toBeVisible();
    expect(screen.getByText(/Illustrative activity/)).toBeVisible();
  });
  it("shows recorded totals with the meal estimate explained", () => {
    query.data = {
      data: {
        includes_demo_data: false,
        delivered_kg: "10",
        estimated_meals: "25",
        active_listings: 0,
      },
    };
    render(<PublicImpact />);
    expect(
      screen.getByRole("region", { name: "Shared this month" }),
    ).toBeVisible();
    expect(screen.getByText("Estimated meal equivalents")).toBeVisible();
    expect(screen.getByText(/0.4 kg per meal equivalent/)).toBeVisible();
    expect(screen.getByText("Live listings").closest("div")).toHaveTextContent(
      "0",
    );
  });
  it("does not invent totals while data is unavailable", () => {
    query.data = undefined;
    render(<PublicImpact />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
