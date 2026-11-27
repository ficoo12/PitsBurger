import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { deferred } from "../../../../test/deferred";
import { testAvailabilityWeek as week, testEmployee } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import type { AvailabilityWeek } from "../../types";
import { Availability } from "./Availability";

const get = vi.spyOn(apiClient, "get");
const post = vi.spyOn(apiClient, "post");

afterEach(() => {
  get.mockReset();
  post.mockReset();
});

const submitted: AvailabilityWeek = {
  ...week,
  savesLeft: 2,
  submission: { note: "Only after 12", days: [{ weekday: 1, shiftId: 7 }] },
};

function renderScreen(...weeks: AvailabilityWeek[]) {
  for (const w of weeks) get.mockResolvedValueOnce({ availability: w });
  return renderRoutes([{ path: "/", element: <Availability /> }], { user: testEmployee });
}

const day = (name: string) => screen.getByRole("radiogroup", { name });

describe("Availability", () => {
  it("shows a spinner while loading", () => {
    get.mockReturnValue(deferred().promise);
    renderRoutes([{ path: "/", element: <Availability /> }], { user: testEmployee });

    expect(screen.getByRole("status")).toHaveTextContent("Loading your availability");
    expect(screen.getByText("Jonas Becker")).toBeInTheDocument();
  });

  it("shows a load error and tries again", async () => {
    get.mockRejectedValueOnce(new ApiError(500, "Internal server error"));
    get.mockResolvedValueOnce({ availability: week });
    renderRoutes([{ path: "/", element: <Availability /> }], { user: testEmployee });

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Availability" })).toBeInTheDocument();
  });

  it("shows next week's open days, every day at – (not available)", async () => {
    renderScreen(week);

    expect(await screen.findByRole("heading", { name: "Availability" })).toBeInTheDocument();
    expect(screen.getByText("For week 49")).toBeInTheDocument();
    expect(screen.getByText("30 Nov – 6 Dec 2026")).toBeInTheDocument();
    expect(screen.getByText("You can enter your availability")).toBeInTheDocument();
    expect(screen.getAllByRole("radiogroup")).toHaveLength(6);
    expect(screen.queryByRole("radiogroup", { name: /Sunday/ })).not.toBeInTheDocument();
    for (const group of screen.getAllByRole("radiogroup")) {
      expect(within(group).getByRole("radio", { name: "Not available" })).toBeChecked();
    }
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    expect(screen.getByText("After submitting you can change it twice.")).toBeInTheDocument();
  });

  it("moves the pick with the arrow keys", async () => {
    renderScreen(week);
    const monday = await screen.findByRole("radiogroup", { name: "Monday 30 Nov" });

    await userEvent.click(within(monday).getByRole("radio", { name: "Früh" }));
    await userEvent.keyboard("{ArrowRight}");

    expect(within(monday).getByRole("radio", { name: "Spät" })).toBeChecked();
    expect(within(monday).getByRole("radio", { name: "Spät" })).toHaveFocus();
  });

  it("confirms the first submit in a sheet, then shows it as saved", async () => {
    renderScreen(week, submitted);
    post.mockResolvedValue({
      availability: { weekStart: week.weekStart, note: "Only after 12", days: [{ weekday: 1, shiftId: 7 }], savesLeft: 2 },
    });
    await userEvent.click(
      within(await screen.findByRole("radiogroup", { name: "Monday 30 Nov" })).getByRole("radio", { name: "Früh" }),
    );
    await userEvent.type(screen.getByLabelText("Note for your manager (optional)"), " Only after 12 ");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    const sheet = screen.getByRole("dialog", { name: "Submit your availability?" });
    expect(within(sheet).getByRole("listitem", { name: "Monday: Früh" })).toBeInTheDocument();
    expect(within(sheet).getByRole("listitem", { name: "Sunday: closed" })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await userEvent.click(within(sheet).getByRole("button", { name: "Submit" }));

    expect(post).toHaveBeenCalledWith("/availability", {
      days: [{ weekday: 1, shiftId: 7 }],
      note: "Only after 12",
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Open · 2 changes left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(within(day("Monday 30 Nov")).getByRole("radio", { name: "Früh" })).toBeChecked();
    // The cache was checked with the server after saving.
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("goes back from the sheet without saving", async () => {
    renderScreen(week);
    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));

    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Back" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
  });

  it("saves a change directly once the week was submitted", async () => {
    const after = { note: "Only after 12", days: [{ weekday: 2, shiftId: 8 }] };
    renderScreen(submitted, { ...submitted, savesLeft: 1, submission: after });
    post.mockResolvedValue({
      availability: { weekStart: week.weekStart, ...after, savesLeft: 1 },
    });
    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();
    expect(screen.getByText("Change a day to save.")).toBeInTheDocument();
    expect(screen.getByLabelText("Note for your manager (optional)")).toHaveValue("Only after 12");

    await userEvent.click(within(day("Monday 30 Nov")).getByRole("radio", { name: "Not available" }));
    await userEvent.click(within(day("Tuesday 1 Dec")).getByRole("radio", { name: "Spät" }));
    expect(screen.getByText("After this you have 1 change left.")).toBeInTheDocument();
    await userEvent.click(save);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/availability", {
      days: [{ weekday: 2, shiftId: 8 }],
      note: "Only after 12",
    });
    expect(await screen.findByText("Open · 1 change left")).toBeInTheDocument();
  });

  it("is read-only once no changes are left", async () => {
    renderScreen({ ...submitted, savesLeft: 0 });

    expect(await screen.findByText("No changes left")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit|Save/ })).not.toBeInTheDocument();
    expect(screen.getByText("Früh")).toBeInTheDocument();
    expect(screen.getByText("Only after 12")).toBeInTheDocument();
  });

  it("shows the submitted week read-only while the window is closed", async () => {
    renderScreen({ ...submitted, isOpen: false, nextOpening: { date: "2026-12-04", time: "00:00" } });

    expect(await screen.findByText("Entries closed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This is what you submitted for week 49. You can enter next week's availability from Friday, 4 Dec, 00:00.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not available")).toHaveLength(5);
  });

  it("shows Not submitted on every day when nothing was saved and the window is closed", async () => {
    renderScreen({ ...week, isOpen: false, nextOpening: { date: "2026-12-04", time: "00:00" } });

    expect(await screen.findByText(/You didn't submit anything for week 49/)).toBeInTheDocument();
    expect(screen.getAllByText("Not submitted")).toHaveLength(6);
  });

  it("shows a 409, and reloads the screen", async () => {
    renderScreen(submitted, { ...submitted, isOpen: false, nextOpening: { date: "2026-12-04", time: "00:00" } });
    post.mockRejectedValue(new ApiError(409, "The availability window is closed"));
    await userEvent.click(
      within(await screen.findByRole("radiogroup", { name: "Tuesday 1 Dec" })).getByRole("radio", { name: "Spät" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Entries closed")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("shows the server's message for a day under the day list", async () => {
    renderScreen(submitted);
    post.mockRejectedValue(
      new ApiError(400, "Invalid input", { days: ["Your restaurant is closed on Monday"] }),
    );
    await userEvent.click(
      within(await screen.findByRole("radiogroup", { name: "Tuesday 1 Dec" })).getByRole("radio", { name: "Spät" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your restaurant is closed on Monday");
  });

  it("shows a general server error", async () => {
    renderScreen(submitted);
    post.mockRejectedValue(new ApiError(0, "Can't reach the server."));
    await userEvent.click(
      within(await screen.findByRole("radiogroup", { name: "Tuesday 1 Dec" })).getByRole("radio", { name: "Spät" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save");
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the server.");
  });

  it("checks the note length before sending", async () => {
    renderScreen(week);
    const note = await screen.findByLabelText("Note for your manager (optional)");
    await userEvent.click(note);
    await userEvent.paste("x".repeat(101));

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Keep the note to 100 characters.")).toBeInTheDocument();
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("logs out", async () => {
    renderScreen(week);
    post.mockResolvedValue(null);

    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(post).toHaveBeenCalledWith("/employees/logout");
  });
});
