import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { testEmployee, testUser } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import type { Employee } from "../../../employees";
import type { Position } from "../../../positions";
import type { Restaurant } from "../../../restaurants";
import { useAddedRowsStore } from "../../addedRowsStore";
import { renderSchedulePdf } from "../../export/renderSchedulePdf";
import type { PdfPage } from "../../export/schedulePdfModel";
import { shareOrDownload } from "../../export/shareOrDownload";
import type { ScheduleEntry } from "../../types";
import { ScheduleList } from "./ScheduleList";

// The PDF itself isn't drawn in tests (jsPDF, fonts), nor shared or downloaded.
vi.mock("../../export/renderSchedulePdf", () => ({
  renderSchedulePdf: vi.fn(async () => new Blob(["%PDF-"], { type: "application/pdf" })),
}));
vi.mock("../../export/shareOrDownload", () => ({ shareOrDownload: vi.fn(async () => {}) }));

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
const harbour: Restaurant = { ...riverside, id: 2, name: "Harbour", colour: "green" };

// The owner's positions, one zone each, in the order they were created.
const service: Position = { id: 10, name: "Service", colour: "red" };
const kitchen: Position = { id: 11, name: "Kitchen", colour: "yellow" };
const driver: Position = { id: 12, name: "Driver", colour: "green" };

/** The inline style that carries an element's schedule colour. */
const styleOf = (element: Element) => element.getAttribute("style") ?? "";

// Riverside: Jonas and Maya have shifts this week, Mia and Bilal don't.
const jonas: Employee = testEmployee; // Service
const mia: Employee = { ...testEmployee, id: 8, userId: 80, firstName: "Mia", lastName: "Schulz" };
const bilal: Employee = {
  ...testEmployee,
  id: 11,
  userId: 110,
  firstName: "Bilal",
  lastName: "Krause",
  positions: [kitchen],
};
const maya: Employee = {
  ...testEmployee,
  id: 12,
  userId: 120,
  firstName: "Maya",
  lastName: "Meyer",
  positions: [driver, service],
};
// Harbour: Jonas works there too (the same employee), but has no shift there this week.
const jonasInHarbour: Employee = { ...jonas, otherRestaurantIds: [2] };
const lena: Employee = {
  ...testEmployee,
  id: 9,
  userId: 90,
  firstName: "Lena",
  lastName: "Wolf",
  defaultRestaurantId: 2,
};

function entry(fields: Partial<ScheduleEntry> & Pick<ScheduleEntry, "id" | "employeeId">): ScheduleEntry {
  return { workDate: "2026-11-17", shiftId: 2, startTime: null, endTime: null, note: null, ...fields };
}
const jonasSpaet = entry({ id: 1, employeeId: jonas.id, startTime: "18:00", note: "181" });
const marieFrueh = entry({ id: 2, employeeId: maya.id, workDate: "2026-11-18", shiftId: 1 });
const lenaFrueh = entry({ id: 3, employeeId: lena.id, workDate: "2026-11-19", shiftId: 1 });

const get = vi.spyOn(apiClient, "get");

beforeEach(() => {
  // Wednesday 18.11.2026: this week starts on Monday 16.11.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 18, 12));
});

afterEach(() => {
  vi.useRealTimers();
  get.mockReset();
  vi.mocked(renderSchedulePdf).mockClear();
  vi.mocked(shareOrDownload).mockClear();
  useAddedRowsStore.setState({ rows: {} });
});

/** Answers every request the page makes; `failing` is a path that fails. */
function answer(restaurants: Restaurant[] = [riverside, harbour], failing?: string) {
  get.mockImplementation(async (path) => {
    if (path === failing) throw new ApiError(500, "Internal server error");
    if (path === "/restaurants") return { restaurants };
    if (path === "/positions") return { positions: [driver, service, kitchen] };
    if (path === "/employees?restaurantId=1") return { employees: [jonas, bilal, maya, mia] };
    if (path === "/employees?restaurantId=2") return { employees: [jonasInHarbour, lena] };
    const match = /^\/schedules\?restaurantId=(\d+)&weekStart=(\S+)$/.exec(String(path));
    if (match) {
      const [, restaurantId, weekStart] = match;
      let entries: ScheduleEntry[] = [];
      if (weekStart === "2026-11-16") {
        entries = restaurantId === "1" ? [jonasSpaet, marieFrueh] : [lenaFrueh];
      }
      return { schedule: { restaurantId: Number(restaurantId), weekStart, entries, availability: [] } };
    }
    throw new Error(`Unexpected GET ${String(path)}`);
  });
}

function setup(path = "/dashboard/schedule", restaurants?: Restaurant[]) {
  answer(restaurants);
  return renderRoutes([{ path: "/dashboard/schedule", element: <ScheduleList /> }], {
    path,
    user: testUser,
  });
}

/** The table of one restaurant, found by its heading. */
async function findSchedule(name: string) {
  return screen.findByRole("table", { name });
}

/** The names in a table, top to bottom, without the restaurant cell. */
function rowNames(table: HTMLElement) {
  return within(table)
    .getAllByRole("rowheader")
    .slice(1)
    .map((cell) => cell.textContent);
}

/** A stand-in for the browser's DataTransfer, which jsdom doesn't have. */
function fakeDataTransfer() {
  const data = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "all",
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  };
}

describe("ScheduleList", () => {
  it("shows every restaurant's schedule for this week, one under another, named on the left", async () => {
    setup();

    expect(await findSchedule("Riverside")).toBeInTheDocument();
    expect(await findSchedule("Harbour")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Riverside",
      "Harbour",
    ]);
    expect(screen.getByText("16.11. – 22.11.2026 · Week 47")).toBeInTheDocument();
    // Riverside: Jonas, Maya and Service's add row, then Kitchen's and Driver's add rows.
    const riversideTable = await findSchedule("Riverside");
    await within(riversideTable).findByRole("rowheader", { name: "Jonas Becker" });
    expect(within(riversideTable).getByRole("rowheader", { name: "Riverside" })).toHaveAttribute(
      "rowspan",
      "5",
    );
    expect(get).toHaveBeenCalledWith("/schedules?restaurantId=1&weekStart=2026-11-16");
    expect(get).toHaveBeenCalledWith("/schedules?restaurantId=2&weekStart=2026-11-16");
  });

  it("lists only the people with a shift there this week, each zone ending in an add row", async () => {
    setup();

    const riversideTable = await findSchedule("Riverside");
    await within(riversideTable).findByRole("rowheader", { name: "Jonas Becker" });
    expect(rowNames(riversideTable)).toEqual([
      "Jonas Becker",
      "Maya Meyer",
      "+ Add employee",
      "+ Add employee",
      "+ Add employee",
    ]);
    for (const zone of ["Service", "Kitchen", "Driver"]) {
      expect(
        within(riversideTable).getByRole("button", { name: `Add employee to ${zone} in Riverside` }),
      ).toBeInTheDocument();
    }

    // Jonas works in Harbour too, but has no shift there this week.
    const harbourTable = await findSchedule("Harbour");
    await within(harbourTable).findByRole("rowheader", { name: "Lena Wolf" });
    expect(within(harbourTable).queryByText("Jonas Becker")).not.toBeInTheDocument();
  });

  it("puts each cell in its employee's row and day column, in the zone's colour and the shift's shade", async () => {
    setup();

    const table = await findSchedule("Riverside");
    const name = await within(table).findByRole("rowheader", { name: "Jonas Becker" });
    const cells = within(name.closest("tr")!).getAllByRole("cell");

    expect(cells).toHaveLength(7);
    // Monday: no shift on a closed day is grey; Wednesday: no shift is black.
    expect(cells[0]).toHaveTextContent(/^$/);
    expect(cells[0]).toHaveAttribute("data-shift", "closed");
    expect(cells[2]).toHaveAttribute("data-shift", "none");
    expect(styleOf(cells[0]!)).toBe("");
    // Tuesday: Jonas is in Service (red), and Spät is a Late shift.
    expect(cells[1]).toHaveTextContent("Spät ab 18:00 | 181");
    expect(cells[1]).toHaveAttribute("title", "18:00–00:00");
    expect(cells[1]).toHaveAttribute("data-shift", "late");
    expect(styleOf(cells[1]!)).toContain("--cell-fill: var(--palette-red-late)");
    expect(styleOf(name)).toContain("var(--palette-red-early)");
  });

  it("draws the restaurant column in the restaurant's colour, whatever its name", async () => {
    setup();

    const table = await findSchedule("Harbour");
    await within(table).findByRole("rowheader", { name: "Lena Wolf" });

    expect(styleOf(within(table).getByRole("rowheader", { name: "Harbour" }))).toContain(
      "linear-gradient(180deg, var(--palette-green-early), var(--palette-green-late))",
    );
  });

  it("marks the days a restaurant is closed", async () => {
    setup();

    const table = await findSchedule("Riverside");
    const headers = within(table).getAllByRole("columnheader");

    // Two header rows: the seven weekdays, then the seven dates.
    expect(headers.slice(0, 7).map((h) => h.textContent)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(headers[7]).toHaveTextContent("16.11.Closed");
    expect(headers[8]).toHaveTextContent("17.11.");
    expect(headers[8]).not.toHaveTextContent("Closed");
  });

  it("prefetches next week for every restaurant", async () => {
    setup();

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith("/schedules?restaurantId=1&weekStart=2026-11-23");
      expect(get).toHaveBeenCalledWith("/schedules?restaurantId=2&weekStart=2026-11-23");
    });
  });

  it("moves every restaurant to the next and previous week and keeps the week in the URL", async () => {
    const user = userEvent.setup();
    const { router } = setup();
    await within(await findSchedule("Riverside")).findByText("Spät ab 18:00 | 181");

    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(screen.getByText("23.11. – 29.11.2026 · Week 48")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?week=2026-11-23");
    // Prefetched, so the new week's tables are there at once, without a spinner.
    expect(screen.queryByText(/Loading the schedule/)).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Riverside" })).toBeInTheDocument();
    expect(screen.queryByText("Jonas Becker")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/schedules?restaurantId=1&weekStart=2026-11-30"),
    );

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));

    expect(screen.getByText("09.11. – 15.11.2026 · Week 46")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?week=2026-11-09");
  });

  it("starts on the week from the URL and jumps back to this week", async () => {
    const user = userEvent.setup();
    const { router } = setup("/dashboard/schedule?week=2026-12-07");

    expect(await screen.findByText("07.12. – 13.12.2026 · Week 50")).toBeInTheDocument();
    const thisWeek = screen.getByRole("button", { name: "This week" });
    expect(thisWeek).toBeEnabled();

    await user.click(thisWeek);

    expect(screen.getByText("16.11. – 22.11.2026 · Week 47")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?week=2026-11-16");
    expect(thisWeek).toBeDisabled();
  });

  it("shows this week when the URL's week isn't a Monday", async () => {
    setup("/dashboard/schedule?week=2026-12-08");

    expect(await screen.findByText("16.11. – 22.11.2026 · Week 47")).toBeInTheDocument();
  });

  describe("adding people to a week", () => {
    it("opens a panel with the restaurant's people for that zone who aren't in it yet", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");

      await user.click(
        await within(table).findByRole("button", { name: "Add employee to Kitchen in Riverside" }),
      );

      const panel = screen.getByRole("dialog", { name: "Add to Kitchen" });
      expect(panel).toHaveTextContent("Riverside · 16.11. – 22.11.2026 · Week 47");
      expect(within(panel).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Bilal KrauseKitchenAdd",
      ]);
      expect(within(panel).getByRole("button", { name: "Close" })).toHaveFocus();
    });

    it("adds a person under the zone's rows with the Add button and takes them out of the panel", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");
      await user.click(
        await within(table).findByRole("button", { name: "Add employee to Kitchen in Riverside" }),
      );

      await user.click(screen.getByRole("button", { name: "Add Bilal Krause" }));

      expect(rowNames(table)).toEqual([
        "Jonas Becker",
        "Maya Meyer",
        "+ Add employee",
        "Bilal Krause",
        "+ Add employee",
        "+ Add employee",
      ]);
      const bilalRow = within(table).getByRole("rowheader", { name: "Bilal Krause" });
      expect(styleOf(bilalRow)).toContain("var(--palette-yellow-early)");
      const panel = screen.getByRole("dialog", { name: "Add to Kitchen" });
      expect(panel).toHaveTextContent("Everyone in Kitchen at Riverside is already on this week.");
    });

    it("lets someone with two positions be in two zones, showing their shifts in both rows", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");
      // Maya is in Service because of her shift; she can also drive.
      await user.click(
        await within(table).findByRole("button", { name: "Add employee to Driver in Riverside" }),
      );

      await user.click(screen.getByRole("button", { name: "Add Maya Meyer" }));

      const rows = within(table).getAllByRole("rowheader", { name: "Maya Meyer" });
      expect(rows.map(styleOf)).toEqual([
        expect.stringContaining("--palette-red-early"),
        expect.stringContaining("--palette-green-early"),
      ]);
      for (const row of rows) {
        expect(within(row.closest("tr")!).getAllByRole("cell")[2]).toHaveTextContent("Früh");
      }
    });

    it("adds a person dropped on the zone of the open panel, and ignores drops on other zones", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");
      await user.click(
        await within(table).findByRole("button", { name: "Add employee to Kitchen in Riverside" }),
      );
      const dataTransfer = fakeDataTransfer();
      const bilalItem = within(screen.getByRole("dialog", { name: "Add to Kitchen" })).getByRole(
        "listitem",
      );
      fireEvent.dragStart(bilalItem, { dataTransfer });

      // Service's add row: not the open panel's zone.
      const serviceAdd = within(table).getByRole("button", { name: "Add employee to Service in Riverside" });
      fireEvent.dragOver(serviceAdd, { dataTransfer });
      fireEvent.drop(serviceAdd, { dataTransfer });
      expect(within(table).queryByText("Bilal Krause")).not.toBeInTheDocument();

      const kitchenDays = screen.getByText("Drag people here to add them to Kitchen");
      fireEvent.dragOver(kitchenDays, { dataTransfer });
      expect(kitchenDays).toHaveTextContent("Drop to add");
      fireEvent.drop(kitchenDays, { dataTransfer });

      expect(styleOf(within(table).getByRole("rowheader", { name: "Bilal Krause" }))).toContain(
        "var(--palette-yellow-early)",
      );
    });

    it("keeps an added row in its week while the owner looks at other weeks", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");
      await user.click(
        await within(table).findByRole("button", { name: "Add employee to Kitchen in Riverside" }),
      );
      await user.click(screen.getByRole("button", { name: "Add Bilal Krause" }));
      await user.click(screen.getByRole("button", { name: "Close" }));

      await user.click(screen.getByRole("button", { name: "Next week" }));
      expect(screen.queryByText("Bilal Krause")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Previous week" }));

      expect(within(await findSchedule("Riverside")).getByText("Bilal Krause")).toBeInTheDocument();
    });

    it("closes the panel on Escape and gives the focus back to its add button", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");
      const addButton = await within(table).findByRole("button", {
        name: "Add employee to Kitchen in Riverside",
      });
      await user.click(addButton);

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { name: "Add to Kitchen" })).not.toBeInTheDocument();
      expect(addButton).toHaveFocus();
    });
  });

  describe("removing people from a week", () => {
    it("removes a row the owner added", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");
      await user.click(
        await within(table).findByRole("button", { name: "Add employee to Kitchen in Riverside" }),
      );
      await user.click(screen.getByRole("button", { name: "Add Bilal Krause" }));
      await user.click(screen.getByRole("button", { name: "Close" }));

      await user.click(within(table).getByRole("button", { name: "Bilal Krause" }));
      const dialog = screen.getByRole("dialog", { name: "Remove Bilal Krause?" });
      expect(dialog).toHaveTextContent(
        "This takes Bilal Krause out of Kitchen at Riverside for 16.11. – 22.11.2026 · Week 47.",
      );
      await user.click(within(dialog).getByRole("button", { name: "Remove" }));

      expect(within(table).queryByText("Bilal Krause")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Remove Bilal Krause?" })).not.toBeInTheDocument(),
      );
    });

    it("keeps a row with saved shifts and says to clear them first", async () => {
      const user = userEvent.setup();
      setup();
      const table = await findSchedule("Riverside");

      await user.click(await within(table).findByRole("button", { name: "Jonas Becker" }));

      const dialog = screen.getByRole("dialog", { name: "Jonas Becker can't be removed yet" });
      expect(dialog).toHaveTextContent(
        "Jonas Becker has 1 shift at Riverside this week. Clear it first, then remove the row.",
      );
      expect(within(dialog).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Close" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(within(table).getByText("Jonas Becker")).toBeInTheDocument();
    });
  });

  it("shows an error in the restaurant whose schedule failed and keeps the others", async () => {
    answer(undefined, "/schedules?restaurantId=2&weekStart=2026-11-16");
    renderRoutes([{ path: "/dashboard/schedule", element: <ScheduleList /> }], {
      path: "/dashboard/schedule",
      user: testUser,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the scheduleInternal server error",
    );
    expect(await findSchedule("Riverside")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Harbour" })).not.toBeInTheDocument();
  });

  it("asks for a restaurant first when there is none", async () => {
    setup("/dashboard/schedule", []);

    expect(await screen.findByText("No restaurants yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next week" })).not.toBeInTheDocument();
  });

  describe("exporting the week", () => {
    /** Each page as its restaurant and the names on it. */
    function pageNames(pages: PdfPage[]) {
      return pages.map((page) => [page.restaurantName, page.rows.map((row) => row.name)]);
    }

    it("puts every restaurant's shown week in one PDF and hands it over", async () => {
      const user = userEvent.setup();
      setup();
      await findSchedule("Harbour");

      await user.click(screen.getByRole("button", { name: "Export PDF" }));

      await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1));
      const [pages, weekStart] = vi.mocked(renderSchedulePdf).mock.calls[0]!;
      expect(weekStart).toBe("2026-11-16");
      expect(pageNames(pages)).toEqual([
        ["Riverside", ["Jonas Becker", "Maya Meyer"]],
        ["Harbour", ["Lena Wolf"]],
      ]);
      expect(vi.mocked(shareOrDownload).mock.calls[0]![1]).toBe("schedule-2026-W47.pdf");
      expect(screen.queryByText("Couldn't export the schedules")).not.toBeInTheDocument();
    });

    it("leaves out people who were only added on screen", async () => {
      const user = userEvent.setup();
      useAddedRowsStore.getState().add(1, "2026-11-16", { employeeId: mia.id, positionId: service.id });
      setup();
      expect(await within(await findSchedule("Riverside")).findByText("Mia Schulz")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Export PDF" }));

      await waitFor(() => expect(renderSchedulePdf).toHaveBeenCalledTimes(1));
      const [pages] = vi.mocked(renderSchedulePdf).mock.calls[0]!;
      expect(pageNames(pages)[0]).toEqual(["Riverside", ["Jonas Becker", "Maya Meyer"]]);
    });

    it("says so instead of exporting a week with nothing planned", async () => {
      const user = userEvent.setup();
      setup("/dashboard/schedule?week=2026-11-23");
      await findSchedule("Harbour");

      await user.click(screen.getByRole("button", { name: "Export PDF" }));

      expect(await screen.findByText("Nothing planned this week")).toBeInTheDocument();
      expect(renderSchedulePdf).not.toHaveBeenCalled();
      expect(shareOrDownload).not.toHaveBeenCalled();

      // The message was about that week: it goes when the week changes.
      await user.click(screen.getByRole("button", { name: "Previous week" }));
      expect(screen.queryByText("Nothing planned this week")).not.toBeInTheDocument();
    });

    it("shows an error when a schedule can't be loaded for the export", async () => {
      const user = userEvent.setup();
      answer(undefined, "/schedules?restaurantId=2&weekStart=2026-11-16");
      renderRoutes([{ path: "/dashboard/schedule", element: <ScheduleList /> }], {
        path: "/dashboard/schedule",
        user: testUser,
      });
      await findSchedule("Riverside");

      await user.click(screen.getByRole("button", { name: "Export PDF" }));

      expect(await screen.findByText("Couldn't export the schedules")).toBeInTheDocument();
      expect(renderSchedulePdf).not.toHaveBeenCalled();
    });
  });
});
