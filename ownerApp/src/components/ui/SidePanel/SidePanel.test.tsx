import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SidePanel } from "./SidePanel";

/** A button that opens the panel, as a page would. */
function Page({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">Elsewhere on the page</button>
      {open && (
        <SidePanel
          title="Add to Kitchen"
          subtitle="Riverside"
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
        >
          <p>Content</p>
        </SidePanel>
      )}
    </>
  );
}

describe("SidePanel", () => {
  it("shows the title, subtitle and content, and moves the focus to its close button", async () => {
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    const panel = screen.getByRole("dialog", { name: "Add to Kitchen" });
    expect(panel).toHaveTextContent("Riverside");
    expect(panel).toHaveTextContent("Content");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("closes on its close button and gives the focus back", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });

  it("closes on Escape inside the panel", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves the page behind it usable", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.click(screen.getByRole("button", { name: "Elsewhere on the page" }));

    expect(screen.getByRole("button", { name: "Elsewhere on the page" })).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Add to Kitchen" })).toBeInTheDocument();
  });
});
