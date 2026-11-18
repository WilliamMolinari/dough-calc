// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstRun } from "./FirstRun";

afterEach(cleanup);

describe("FirstRun", () => {
  it("seeds the formula from a style, a count and a start time", async () => {
    const onApply = vi.fn();
    const onStart = vi.fn();
    const onSkip = vi.fn();
    render(<FirstRun onApply={onApply} onStart={onStart} onSkip={onSkip} />);

    screen.getByText("Three answers and you can start weighing.");

    await userEvent.click(screen.getByRole("button", { name: /New York/ }));
    const count = screen.getByLabelText("2. How many pizzas?");
    await userEvent.clear(count);
    await userEvent.type(count, "6");

    await userEvent.click(screen.getByRole("button", { name: /Start with this dough/ }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ styleId: "new-york", ballCount: 6, startTime: "09:00" }),
    );
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("lets an experienced baker skip it", async () => {
    const onSkip = vi.fn();
    render(<FirstRun onApply={vi.fn()} onStart={vi.fn()} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole("button", { name: "I know my way around" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
