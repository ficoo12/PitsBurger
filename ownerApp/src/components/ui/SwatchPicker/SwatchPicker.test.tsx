import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SwatchPicker, type SwatchOption } from "./SwatchPicker";

const options: SwatchOption<"red" | "yellow" | "green">[] = [
  { value: "red", label: "Red", colours: ["var(--palette-red-early)"] },
  { value: "yellow", label: "Yellow", colours: ["var(--palette-yellow-early)"], takenBy: "Kitchen" },
  { value: "green", label: "Green", colours: ["var(--palette-green-early)"] },
];

/** The picker with its value in state, as a form holds it. */
function Form({ error }: { error?: string }) {
  const [value, setValue] = useState<"red" | "yellow" | "green" | null>("red");
  return (
    <>
      <SwatchPicker
        legend="Colour"
        name="colour"
        options={options}
        value={value}
        onChange={setValue}
        hint="Pick one"
        error={error}
      />
      <output>{value}</output>
    </>
  );
}

describe("SwatchPicker", () => {
  it("shows the picked swatch and picks another on click", async () => {
    render(<Form />);

    expect(screen.getByRole("group", { name: "Colour" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Red" })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "Green" }));

    expect(screen.getByRole("radio", { name: "Green" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("green");
  });

  it("disables another record's colour and says whose it is", async () => {
    render(<Form />);

    const taken = screen.getByRole("radio", { name: "Yellow, used by Kitchen" });
    expect(taken).toBeDisabled();
    expect(taken.closest("label")).toHaveAttribute("title", "Used by Kitchen");

    await userEvent.click(taken);
    expect(screen.getByRole("radio", { name: "Red" })).toBeChecked();
  });

  it("moves with the arrow keys and skips a taken swatch", async () => {
    render(<Form />);

    await userEvent.click(screen.getByRole("radio", { name: "Red" }));
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Green" })).toBeChecked();
  });

  it("shows the error instead of the hint", () => {
    const { rerender } = render(<Form />);
    expect(screen.getByRole("group", { name: "Colour" })).toHaveAccessibleDescription("Pick one");

    rerender(<Form error="Pick a colour." />);

    const group = screen.getByRole("group", { name: "Colour" });
    expect(group).toHaveAccessibleDescription("Pick a colour.");
    expect(group).toHaveAttribute("aria-invalid", "true");
  });
});
