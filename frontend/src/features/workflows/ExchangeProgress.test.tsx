import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExchangeProgress } from "./ExchangeProgress";
import type { Exchange } from "./data";
const auth = vi.hoisted(() => ({ userId: 1 }));
vi.mock("../identity/AuthContext", () => ({
  useAuth: () => ({ session: { user: { user_id: auth.userId } } }),
}));
afterEach(cleanup);
const exchange = {
  status: "Completed",
  donor_id: 1,
  receiver_id: 2,
  volunteer_id: 3,
  pickup_status: "Delivered",
  my_rating: null,
} as Exchange;
describe("personal exchange completion", () => {
  it("finishes all steps for the member who rated", () => {
    auth.userId = 1;
    const { container } = render(
      <ExchangeProgress exchange={{ ...exchange, my_rating: 5 }} />,
    );
    expect(screen.getByText("Done for you")).toBeVisible();
    expect(container.querySelectorAll('[data-state="done"]')).toHaveLength(5);
    expect(container.querySelector("[aria-current]")).toBeNull();
  });
  it("keeps the other member’s rating step current", () => {
    auth.userId = 2;
    const { container } = render(<ExchangeProgress exchange={exchange} />);
    expect(screen.queryByText("Done for you")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Your rating",
    );
    expect(container.querySelectorAll('[data-state="done"]')).toHaveLength(4);
  });
  it("also completes a receiver’s own submitted rating", () => {
    auth.userId = 2;
    render(<ExchangeProgress exchange={{ ...exchange, my_rating: 4 }} />);
    expect(screen.getByText("Done for you")).toBeVisible();
  });
  it("does not ask an assigned volunteer for an ineligible rating", () => {
    auth.userId = 3;
    render(<ExchangeProgress exchange={exchange} />);
    expect(screen.getByText("Not required")).toBeVisible();
    expect(screen.getByText("Done for you")).toBeVisible();
  });
  it("keeps unfinished delivery steps current", () => {
    auth.userId = 1;
    const { container } = render(
      <ExchangeProgress
        exchange={{
          ...exchange,
          status: "Confirmed",
          pickup_status: "PickedUp",
        }}
      />,
    );
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Picked up",
    );
    expect(screen.queryByText("Done for you")).not.toBeInTheDocument();
  });
});
