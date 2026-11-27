import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { testEmployee, testUser } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import type { Employee } from "../../../employees";
import type { Restaurant } from "../../../restaurants";
import { useAddedRowsStore } from "../../addedRowsStore";
import type { AvailabilityHint, ScheduleEntry } from "../../types";
import { ScheduleList } from "../ScheduleList/ScheduleList";

const stamp = "2026-11-11T22:00:00.000Z";
// Riverside is closed on Mondays.
const riverside: Restaurant = {
  id: 1,
  name: "Riverside",
  colour: "teal",
  createdAt: stamp,
  updatedAt: stamp,
  openingHours: [2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    openTime: "11:00",
    closeTime: "23:00",
  })),
  shiftTimes: [
    { shiftId: 1, name: "Früh", startTime: "08:00", endTime: "16:00", shade: "early", ownTimes: false },
    { shiftId: 2, name: "Spät", startTime: "16:00", endTime: "00:00", shade: "late", ownTimes: false },
  ],
};

// Both in Service. Lea has left, but still has a shift this week.
const jonas: Employee = testEmployee;
const lea: Employee = {
  ...testEmployee,
  id: 8,
  userId: 80,
  firstName: "Lea",
  lastName: "Roth",
  status: "left",
  leftOn: "2026-11-30",
};

function entry(fields: Partial<ScheduleEntry> & Pick<ScheduleEntry, "id" | "employeeId">): ScheduleEntry {
  return { workDate: "2026-11-17", shiftId: 2, startTime: null, endTime: null, note: null, ...fields };
}
// Tuesday: Spät ab 18:00 | 181. Wednesday: Lea Früh.
const jonasSpaet = entry({ id: 1, employeeId: jonas.id, startTime: "18:00", note: "181" });
const leaFrueh = entry({ id: 2, employeeId: lea.id, workDate: "2026-11-18", shiftId: 1 });

const WEEK_PATH = "/schedules?restaurantId=1&weekStart=2026-11-16";

const get = vi.spyOn(apiClient, "get");
const post = vi.spyOn(apiClient, "post");
const put = vi.spyOn(apiClient, "put");
const remove = vi.spyOn(apiClient, "delete");

beforeEach(() => {
  // Wednesday 18.11.2026: this week starts on Monday 16.11.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 18, 12));
});

afterEach(() => {
  vi.useRealTimers();
  for (const spy of [get, post, put, remove]) spy.mockReset();
  useAddedRowsStore.setState({ rows: {} });
});

function setup(
  restaurant: Restaurant = riverside,
  { employees = [jonas, lea], availability = [] }: { employees?: Employee[]; availability?: AvailabilityHint[] } = {},
) {
  get.mockImplementation(async (path) => {
    if (path === "/restaurants") return { restaurants: [restaurant] };
    // The fixtures' only position: testEmployee's Service (red).
    if (path === "/positions") return { positions: testEmployee.positions };
    if (path === "/employees?restaurantId=1") return { employees };
    const match = /^\/schedules\?restaurantId=1&weekStart=(\S+)$/.exec(String(path));
    if (match) {
      const thisWeek = match[1] === "2026-11-16";
      return {
        schedule: {
          restaurantId: 1,
          weekStart: match[1],
          entries: thisWeek ? [jonasSpaet, leaFrueh] : [],
          availability: thisWeek ? availability : [],
        },
      };
    }
    throw new Error(`Unexpected GET ${String(path)}`);
  });
  const user = userEvent.setup();
  const view = renderRoutes([{ path: "/dashboard/schedule", element: <ScheduleList /> }], {
    path: "/dashboard/schedule",
    user: testUser,
  });
  return { ...view, user };
}

/** The button of one person's cell, e.g. ("Jonas Becker", "Thursday 19.11."). */
async function findCell(name: string, day: string) {
  const table = await screen.findByRole("table", { name: "Riverside" });
  return within(table).findByRole("button", { name: new RegExp(`^${name}, ${day}:`) });
}

function weekRequests() {
  return get.mock.calls.filter(([path]) => path === WEEK_PATH).length;
}

describe("CellEditor", () => {
  it("saves a shift in an empty cell and shows it in the table without loading the week again", async () => {
    const { user } = setup();
    const cell = await findCell("Jonas Becker", "Thursday 19.11.");
    const requests = weekRequests();
    post.mockResolvedValue({
      entry: entry({ id: 9, employeeId: jonas.id, workDate: "2026-11-19", startTime: "18:00", note: "181" }),
    });

    await user.click(cell);
    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    expect(editor).toHaveTextContent("Thursday 19.11. · Service");
    await user.click(within(editor).getByRole("radio", { name: /^Spät/ }));
    fireEvent.change(within(editor).getByLabelText("From"), { target: { value: "18:00" } });
    await user.type(within(editor).getByLabelText("Note"), "181");
    await user.click(within(editor).getByRole("button", { name: "Save" }));

    expect(post).toHaveBeenCalledWith("/schedules/entries", {
      employeeId: jonas.id,
      restaurantId: 1,
      workDate: "2026-11-19",
      shiftId: 2,
      startTime: "18:00",
      endTime: null,
      note: "181",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const saved = await findCell("Jonas Becker", "Thursday 19.11.");
    expect(saved).toHaveTextContent("Spät ab 18:00 | 181");
    expect(saved.closest("td")).toHaveAttribute("data-shift", "late");
    expect(saved).toHaveFocus();
    expect(weekRequests()).toBe(requests);
  });

  it("fills in a saved cell and replaces its shift", async () => {
    const { user } = setup();
    put.mockResolvedValue({ entry: { ...jonasSpaet, shiftId: 1, startTime: null } });

    await user.click(await findCell("Jonas Becker", "Tuesday 17.11."));
    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    expect(within(editor).getByRole("radio", { name: /^Spät/ })).toBeChecked();
    expect(within(editor).getByLabelText("From")).toHaveValue("18:00");
    expect(within(editor).getByLabelText("Note")).toHaveValue("181");

    await user.click(within(editor).getByRole("radio", { name: /^Früh/ }));
    fireEvent.change(within(editor).getByLabelText("From"), { target: { value: "" } });
    await user.click(within(editor).getByRole("button", { name: "Save" }));

    expect(put).toHaveBeenCalledWith("/schedules/entries/1", {
      shiftId: 1,
      startTime: null,
      endTime: null,
      note: "181",
    });
    expect(await findCell("Jonas Becker", "Tuesday 17.11.")).toHaveTextContent("Früh | 181");
  });

  it("clears a saved cell and keeps the row, even without shifts left", async () => {
    const { user } = setup();
    remove.mockResolvedValue(null);

    await user.click(await findCell("Jonas Becker", "Tuesday 17.11."));
    await user.click(screen.getByRole("button", { name: "Clear shift" }));

    expect(remove).toHaveBeenCalledWith("/schedules/entries/1");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const cleared = await findCell("Jonas Becker", "Tuesday 17.11.");
    expect(cleared).toHaveTextContent(/^$/);
    expect(cleared.closest("td")).toHaveAttribute("data-shift", "none");
    // That was Jonas's only shift: his row is now one the owner added, so it can be removed.
    expect(useAddedRowsStore.getState().rows["1:2026-11-16"]).toEqual([
      { employeeId: jonas.id, positionId: 10 },
    ]);
  });

  it("offers Clear only for a saved cell", async () => {
    const { user } = setup();

    await user.click(await findCell("Jonas Becker", "Thursday 19.11."));

    expect(screen.queryByRole("button", { name: "Clear shift" })).not.toBeInTheDocument();
  });

  it("asks for a shift before sending anything", async () => {
    const { user } = setup();

    await user.click(await findCell("Jonas Becker", "Thursday 19.11."));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Choose a shift.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    // The message goes as soon as a shift is picked.
    await user.click(screen.getByRole("radio", { name: /^Früh/ }));
    expect(screen.queryByText("Choose a shift.")).not.toBeInTheDocument();
  });

  it("shows a conflict from the server, stays open and loads the week again", async () => {
    const { user } = setup();
    await findCell("Jonas Becker", "Thursday 19.11.");
    const requests = weekRequests();
    post.mockRejectedValue(new ApiError(409, "This employee already works at Harbour on this day"));

    await user.click(await findCell("Jonas Becker", "Thursday 19.11."));
    await user.click(screen.getByRole("radio", { name: /^Früh/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "Couldn't save the shiftThis employee already works at Harbour on this day",
    );
    await waitFor(() => expect(weekRequests()).toBe(requests + 1));
  });

  it("shows the server's field errors under their inputs", async () => {
    const { user } = setup();
    post.mockRejectedValue(
      new ApiError(400, "Invalid input", { endTime: ["The shift can't start and end at the same time"] }),
    );

    await user.click(await findCell("Jonas Becker", "Thursday 19.11."));
    await user.click(screen.getByRole("radio", { name: /^Früh/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Please check the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveAccessibleDescription(
      "The shift can't start and end at the same time",
    );
  });

  it("shows in the banner that the employee doesn't work in this restaurant", async () => {
    const { user } = setup();
    post.mockRejectedValue(
      new ApiError(400, "Invalid input", {
        restaurantId: ["This employee doesn't work in this restaurant"],
      }),
    );

    await user.click(await findCell("Jonas Becker", "Thursday 19.11."));
    await user.click(screen.getByRole("radio", { name: /^Früh/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "Couldn't save the shiftThis employee doesn't work in this restaurant",
    );
  });

  it("closes on Escape and gives the focus back to the cell", async () => {
    const { user } = setup();
    const cell = await findCell("Jonas Becker", "Thursday 19.11.");

    await user.click(cell);
    expect(cell).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cell).toHaveFocus();
    expect(cell).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on closed days too", async () => {
    const { user } = setup();

    await user.click(await findCell("Jonas Becker", "Monday 16.11."));

    expect(screen.getByRole("dialog", { name: "Jonas Becker" })).toHaveTextContent(
      "Monday 16.11. · Service · Closed",
    );
  });

  it("lets the owner change the saved shifts of someone who left, but not add new ones", async () => {
    const { user } = setup();
    const table = await screen.findByRole("table", { name: "Riverside" });
    const leaRow = (await within(table).findByRole("rowheader", { name: /^Lea Roth/ })).closest("tr")!;

    // Only Wednesday, where she has a shift, is a button.
    expect(within(leaRow).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      null, // her name, which opens the remove window
      "Lea Roth, Wednesday 18.11.: Früh",
    ]);

    await user.click(within(leaRow).getByRole("button", { name: /Wednesday/ }));
    expect(screen.getByRole("dialog", { name: "Lea Roth" })).toBeInTheDocument();
  });

  it("says so when the restaurant has no shifts yet", async () => {
    const { user } = setup({ ...riverside, shiftTimes: [] });

    await user.click(await findCell("Jonas Becker", "Thursday 19.11."));

    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    expect(editor).toHaveTextContent("No shifts yet");
    expect(within(editor).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});

// Mia is in Service and on the week only because of her availability.
const mia: Employee = { ...testEmployee, id: 9, userId: 90, firstName: "Mia", lastName: "Wolf" };
const availability: AvailabilityHint[] = [
  {
    employeeId: jonas.id,
    note: "Car 181",
    // Tuesday already has his saved shift, so only Friday shows a hint.
    days: [
      { date: "2026-11-17", shiftId: 1 },
      { date: "2026-11-20", shiftId: 1 },
    ],
  },
  { employeeId: mia.id, note: null, days: [{ date: "2026-11-21", shiftId: 2 }] },
];

function setupWithAvailability() {
  return setup(riverside, { employees: [jonas, lea, mia], availability });
}

describe("availability hints", () => {
  it("shows a hint as the shift with a question mark, but not on a day with a shift", async () => {
    setupWithAvailability();

    const friday = await findCell("Jonas Becker", "Friday 20.11.");
    expect(friday).toHaveTextContent(/^Früh\?$/);
    expect(friday).toHaveAccessibleName("Jonas Becker, Friday 20.11.: available for Früh");
    expect(friday.closest("td")).toHaveAttribute("data-hint", "early");
    // The frame and name in Service's colour (red) in Früh's shade (Early).
    expect(friday.closest("td")?.getAttribute("style")).toContain(
      "--hint-colour: var(--palette-red-early)",
    );
    expect(friday.closest("td")).toHaveAttribute("data-shift", "none");

    const tuesday = await findCell("Jonas Becker", "Tuesday 17.11.");
    expect(tuesday).toHaveTextContent("Spät ab 18:00 | 181");
    expect(tuesday.closest("td")).not.toHaveAttribute("data-hint");

    // Mia has no shift, but her availability puts her on the week.
    expect(await findCell("Mia Wolf", "Saturday 21.11.")).toHaveTextContent(/^Spät\?$/);
  });

  it("shows a hint on a closed day in its own label, which the CSS draws as a tag", async () => {
    // Riverside is closed on Mondays.
    setup(riverside, {
      employees: [jonas, lea, mia],
      availability: [{ employeeId: mia.id, note: null, days: [{ date: "2026-11-16", shiftId: 1 }] }],
    });

    const monday = await findCell("Mia Wolf", "Monday 16.11.");
    expect(monday).toHaveAccessibleName("Mia Wolf, Monday 16.11.: available for Früh");
    expect(monday.closest("td")).toHaveAttribute("data-shift", "closed");
    expect(monday.closest("td")).toHaveAttribute("data-hint", "early");
    expect(monday.querySelector("span")).toHaveTextContent(/^Früh\?$/);
  });

  it("opens with the hint's shift picked and accepts it as it is", async () => {
    const { user } = setupWithAvailability();
    post.mockResolvedValue({
      entry: entry({ id: 9, employeeId: jonas.id, workDate: "2026-11-20", shiftId: 1 }),
    });

    await user.click(await findCell("Jonas Becker", "Friday 20.11."));
    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    expect(editor).toHaveTextContent("Available: Früh");
    expect(within(editor).getByRole("radio", { name: /^Früh/ })).toBeChecked();
    await user.click(within(editor).getByRole("button", { name: "Accept" }));

    expect(post).toHaveBeenCalledWith("/schedules/entries", {
      employeeId: jonas.id,
      restaurantId: 1,
      workDate: "2026-11-20",
      shiftId: 1,
      startTime: null,
      endTime: null,
      note: null,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const saved = await findCell("Jonas Becker", "Friday 20.11.");
    expect(saved).toHaveTextContent(/^Früh$/);
    expect(saved.closest("td")).not.toHaveAttribute("data-hint");
    expect(saved.closest("td")).toHaveAttribute("data-shift", "early");
  });

  it("says Save once the hint is changed, and saves the changed shift", async () => {
    const { user } = setupWithAvailability();
    post.mockResolvedValue({
      entry: entry({ id: 9, employeeId: jonas.id, workDate: "2026-11-20", startTime: "18:00" }),
    });

    await user.click(await findCell("Jonas Becker", "Friday 20.11."));
    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    await user.click(within(editor).getByRole("radio", { name: /^Spät/ }));
    expect(within(editor).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText("From"), { target: { value: "18:00" } });
    await user.click(within(editor).getByRole("button", { name: "Save" }));

    expect(post).toHaveBeenCalledWith(
      "/schedules/entries",
      expect.objectContaining({ workDate: "2026-11-20", shiftId: 2, startTime: "18:00" }),
    );
    expect(await findCell("Jonas Becker", "Friday 20.11.")).toHaveTextContent("Spät ab 18:00");
  });

  it("dismisses a hint and keeps the row", async () => {
    const { user } = setupWithAvailability();
    post.mockResolvedValue(null);

    await user.click(await findCell("Mia Wolf", "Saturday 21.11."));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(post).toHaveBeenCalledWith("/availability/dismiss", { employeeId: mia.id, date: "2026-11-21" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const cell = await findCell("Mia Wolf", "Saturday 21.11.");
    expect(cell).toHaveTextContent(/^$/);
    expect(cell.closest("td")).not.toHaveAttribute("data-hint");
    // That was all Mia had this week: her row is now one the owner added.
    expect(useAddedRowsStore.getState().rows["1:2026-11-16"]).toEqual([
      { employeeId: mia.id, positionId: 10 },
    ]);
  });

  it("shows a failed dismiss, stays open and loads the week again", async () => {
    const { user } = setupWithAvailability();
    await findCell("Mia Wolf", "Saturday 21.11.");
    const requests = weekRequests();
    post.mockRejectedValue(new ApiError(404, "Availability not found"));

    await user.click(await findCell("Mia Wolf", "Saturday 21.11."));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    const editor = screen.getByRole("dialog", { name: "Mia Wolf" });
    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "Couldn't dismiss the availabilityAvailability not found",
    );
    await waitFor(() => expect(weekRequests()).toBe(requests + 1));
  });

  it("offers Dismiss and Accept only for a cell with a hint", async () => {
    const { user } = setupWithAvailability();

    await user.click(await findCell("Jonas Becker", "Thursday 19.11."));

    const editor = screen.getByRole("dialog", { name: "Jonas Becker" });
    expect(within(editor).queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(editor).not.toHaveTextContent("Available");
  });

  it("shows the note behind the dot after the name, and closes it on Escape", async () => {
    const { user } = setupWithAvailability();
    const table = await screen.findByRole("table", { name: "Riverside" });
    const dot = await within(table).findByRole("button", { name: "Note from Jonas Becker" });
    // Mia sent no note, so she has no dot.
    expect(within(table).queryByRole("button", { name: "Note from Mia Wolf" })).not.toBeInTheDocument();

    await user.click(dot);
    expect(screen.getByRole("dialog", { name: "Note from Jonas Becker" })).toHaveTextContent("Car 181");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(dot).toHaveFocus();
  });

  it("says a row that is there because of availability can't be removed", async () => {
    const { user } = setupWithAvailability();
    const table = await screen.findByRole("table", { name: "Riverside" });
    const row = (await within(table).findByRole("rowheader", { name: /^Mia Wolf/ })).closest("tr")!;

    await user.click(within(row).getByRole("button", { name: "Mia Wolf" }));

    const dialog = screen.getByRole("dialog", { name: "Mia Wolf can't be removed" });
    expect(dialog).toHaveTextContent("Mia Wolf sent their availability for");
    expect(within(dialog).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
