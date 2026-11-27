import type { Locator, Page } from "@playwright/test";
import {
  createContract,
  createEmployee,
  createPosition,
  createRestaurant,
  createScheduleEntry,
  createShift,
  scheduleEntries,
  thisWeekStart,
  type Employee,
} from "../../support/api.js";
import { expect, test } from "../../support/test.js";

// The owner's schedule: one cell per person and day. Each test has its own
// owner, so the shifts can use the real names, and the "Service" position is
// the Service zone (every position is a zone, coloured by its stored colour).

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

/** A restaurant's week table (named after the restaurant). */
const table = (page: Page, restaurantName: string) =>
  page.getByRole("table", { name: restaurantName });

/** The Monday cell of `person` in `t`; its name ends in what the cell shows. */
const monday = (t: Locator, person: string) =>
  t.getByRole("button", { name: new RegExp(`^${person}, Monday \\d{2}\\.\\d{2}\\.: `) });

/** "+ Add employee" in the Service zone, then "Add <name>" in the side panel. */
async function addToService(page: Page, restaurantName: string, person: string) {
  await page
    .getByRole("button", { name: `Add employee to Service in ${restaurantName}` })
    .click();
  await page.getByRole("button", { name: `Add ${person}`, exact: true }).click();
}

test("SC1: a shift is set, changed and cleared, and every step survives a reload", async ({
  ownerPage: page,
  ownerApi,
}) => {
  await createShift(ownerApi, { name: "Früh", startTime: "11:00", endTime: "17:00" });
  await createShift(ownerApi, { name: "Spät", startTime: "17:00", endTime: "23:00" });
  const service = await createPosition(ownerApi, "Service");
  const restaurant = await createRestaurant(ownerApi);
  const contract = await createContract(ownerApi);
  const employee = await createEmployee(ownerApi, {
    restaurantId: restaurant.id,
    contractId: contract.id,
    positionIds: [service.id],
  });
  const person = fullName(employee);
  const week = thisWeekStart();

  await page.goto(`/dashboard/schedule?week=${week}`);
  const t = table(page, restaurant.name);
  const cell = monday(t, person);

  // 1. Onto the week through the add panel.
  await expect(cell).toHaveCount(0);
  await addToService(page, restaurant.name, person);
  await expect(cell).toHaveAccessibleName(/: no shift$/);

  // 2. Set a shift.
  await cell.click();
  // The restaurant has no opening hours, so the day also says "· Closed".
  await expect(page.getByText(/^Monday \d{2}\.\d{2}\. · Service( · Closed)?$/)).toBeVisible();
  await page.getByRole("radio", { name: /Früh/ }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Früh/ })).toBeHidden();
  await expect(cell).toHaveAccessibleName(/: Früh$/);

  // 3. Saved: the row and the shift come back after a reload.
  await page.reload();
  await expect(cell).toHaveAccessibleName(/: Früh$/);

  // 4. Change it: another shift, a later start and a note.
  await cell.click();
  await page.getByRole("radio", { name: /Spät/ }).check();
  await page.getByLabel("From").fill("18:00");
  await page.getByLabel("Note").fill("336");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(cell).toHaveAccessibleName(/: Spät ab 18:00 \| 336$/);
  await page.reload();
  await expect(cell).toHaveAccessibleName(/: Spät ab 18:00 \| 336$/);

  // 5. Clear it: the row stays for now (kept in memory only).
  await cell.click();
  await page.getByRole("button", { name: "Clear shift" }).click();
  await expect(cell).toHaveAccessibleName(/: no shift$/);

  // 6. Nothing saved that week, so after a reload they have no row.
  await page.reload();
  // Wait for the table, so "no row" isn't checked before it has loaded.
  await expect(
    page.getByRole("button", { name: `Add employee to Service in ${restaurant.name}` })
  ).toBeVisible();
  await expect(cell).toHaveCount(0);
  expect(await scheduleEntries(ownerApi, restaurant.id, week)).toEqual([]);
});

test("SC2: nobody gets two shifts on one day, even in two restaurants", async ({
  ownerPage: page,
  ownerApi,
}) => {
  const early = await createShift(ownerApi, { name: "Früh", startTime: "11:00", endTime: "17:00" });
  const service = await createPosition(ownerApi, "Service");
  const home = await createRestaurant(ownerApi);
  const other = await createRestaurant(ownerApi);
  const contract = await createContract(ownerApi);
  const employee = await createEmployee(ownerApi, {
    restaurantId: home.id,
    otherRestaurantIds: [other.id],
    contractId: contract.id,
    positionIds: [service.id],
  });
  const person = fullName(employee);
  const week = thisWeekStart();
  await createScheduleEntry(ownerApi, {
    employeeId: employee.id,
    restaurantId: home.id,
    shiftId: early.id,
    workDate: week,
  });

  await page.goto(`/dashboard/schedule?week=${week}`);
  const homeCell = monday(table(page, home.name), person);
  const otherCell = monday(table(page, other.name), person);
  await expect(homeCell).toHaveAccessibleName(/: Früh$/);
  await expect(otherCell).toHaveCount(0);

  // The same Monday in the other restaurant.
  await addToService(page, other.name, person);
  await otherCell.click();
  await page.getByRole("radio", { name: /Früh/ }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Couldn't save the shift");
  await expect(alert).toContainText(`This employee already works at ${home.name} on this day`);
  await page.keyboard.press("Escape");
  await expect(alert).toBeHidden();

  // Nothing was saved in the other restaurant.
  await page.reload();
  await expect(homeCell).toHaveAccessibleName(/: Früh$/);
  await expect(otherCell).toHaveCount(0);
  expect(await scheduleEntries(ownerApi, other.id, week)).toEqual([]);
  expect(await scheduleEntries(ownerApi, home.id, week)).toHaveLength(1);
});
