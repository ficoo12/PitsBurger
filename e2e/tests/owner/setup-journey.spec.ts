import { randomBytes } from "node:crypto";
import { unique } from "../../support/api.js";
import { expect, test } from "../../support/test.js";

// J1: an owner's first day, all through the UI: contract, position, shift,
// restaurant, and an employee on them.

/** Lowercase letters only, so the generated username stays first.last. */
function letters(count: number): string {
  return Array.from(randomBytes(count), (b) => String.fromCharCode(97 + (b % 26))).join("");
}

test("J1: an owner sets everything up", async ({ ownerPage: page }) => {
  const contractName = unique("Contract");
  const positionName = unique("Position");
  const shiftName = unique("Shift");
  const restaurantName = unique("Restaurant");
  const firstName = "Mia";
  const lastName = `Test${letters(6)}`;

  // 1. Contract that lets people submit availability.
  await page.goto("/dashboard/contracts");
  await page.getByRole("link", { name: "+ Add first contract" }).click();
  await page.getByLabel("Name").fill(contractName);
  await page.getByLabel("Max. hours per week").fill("20");
  await page.getByRole("checkbox", { name: "Submits availability" }).check();
  await page.getByRole("button", { name: "Create contract" }).click();
  await expect(page).toHaveURL(/\/dashboard\/contracts$/);
  const contractRow = page.getByRole("row").filter({ hasText: contractName });
  await expect(contractRow).toContainText("20 h");
  await expect(contractRow).toContainText("Yes");

  // 2. Position.
  await page.goto("/dashboard/positions");
  await page.getByRole("link", { name: "+ Add first position" }).click();
  await page.getByLabel("Name").fill(positionName);
  await page.getByRole("button", { name: "Create position" }).click();
  await expect(page).toHaveURL(/\/dashboard\/positions$/);
  await expect(page.getByRole("rowheader", { name: positionName })).toBeVisible();

  // 3. Shift with its default times.
  await page.goto("/dashboard/shifts");
  await page.getByRole("link", { name: "+ Add first shift" }).click();
  await page.getByLabel("Name").fill(shiftName);
  await page.getByLabel("Starts at").fill("11:00");
  await page.getByLabel("Ends at").fill("17:00");
  await page.getByRole("button", { name: "Create shift" }).click();
  await expect(page).toHaveURL(/\/dashboard\/shifts$/);
  await expect(page.getByRole("row").filter({ hasText: shiftName })).toContainText(
    "11:00 – 17:00"
  );

  // 4. Restaurant, open on Mondays.
  await page.goto("/dashboard/restaurants");
  await page.getByRole("link", { name: "+ Add first restaurant" }).click();
  await page.getByLabel("Name").fill(restaurantName);
  await page.getByRole("checkbox", { name: "Monday" }).check();
  await page.getByLabel("Monday opens at").fill("11:00");
  await page.getByLabel("Monday closes at").fill("23:00");
  await page.getByRole("button", { name: "Create restaurant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/restaurants$/);
  await expect(page.getByRole("rowheader", { name: restaurantName })).toBeVisible();

  // 5. The restaurant's own times for the shift, kept after a reload.
  await page.getByRole("link", { name: `Edit ${restaurantName}` }).click();
  await page.getByLabel(`${shiftName} starts at`).fill("12:00");
  await page.getByLabel(`${shiftName} ends at`).fill("18:00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/dashboard\/restaurants$/);

  await page.getByRole("link", { name: `Edit ${restaurantName}` }).click();
  await page.reload();
  await expect(page.getByLabel(`${shiftName} starts at`)).toHaveValue("12:00");
  await expect(page.getByLabel(`${shiftName} ends at`)).toHaveValue("18:00");
  await expect(page.getByText("Default 11:00–17:00")).toBeVisible();
  await expect(page.getByLabel("Monday opens at")).toHaveValue("11:00");

  // 6. Employee on that contract, in that restaurant, with that position.
  await page.goto("/dashboard/employees");
  await page.getByRole("link", { name: "+ New employee" }).click();
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Last name").fill(lastName);
  await page.getByLabel("Email").fill(`${lastName.toLowerCase()}@e2e.test`);
  await page.getByLabel("Date of birth").fill("1992-11-04");
  await page.getByLabel("Contract").selectOption({ label: contractName });
  await page.getByLabel("Default restaurant").selectOption({ label: restaurantName });
  await page.getByRole("checkbox", { name: positionName }).check();
  await page.getByRole("button", { name: "Create employee" }).click();

  await expect(page).toHaveURL(/\/dashboard\/employees/);
  const employeeRow = page.getByRole("row").filter({ hasText: `${firstName} ${lastName}` });
  await expect(employeeRow).toBeVisible();
  const username = (await employeeRow.getByRole("cell").first().textContent())?.trim() ?? "";
  expect(username).toBe(`${firstName}.${lastName}`.toLowerCase());
});
