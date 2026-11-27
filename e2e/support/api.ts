import { randomBytes, randomUUID } from "node:crypto";
import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type PlaywrightWorkerArgs,
} from "@playwright/test";
import { API_URL } from "./env.js";
import type { OwnerCredentials } from "./owners.js";

// Setup helpers: tests create what they need through the API, as the owner,
// and drive only the flow under test through the browser.

/** A name no other test uses, e.g. "Restaurant 3f9a1c2e". */
export function unique(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

/**
 * A made-up client IP, e.g. "10.83.4.211". The backend trusts one proxy
 * (app.set("trust proxy", 1)), so with this in X-Forwarded-For each test has
 * its own login-limit counts, like separate real users.
 */
export function randomIp(): string {
  const [a, b, c] = randomBytes(3);
  return `10.${a}.${b}.${c}`;
}

export function ipHeaders(clientIp: string): Record<string, string> {
  return { "X-Forwarded-For": clientIp };
}

/** An API client signed in as `owner` (its cookie jar holds the session). */
export async function signedInApi(
  playwright: PlaywrightWorkerArgs["playwright"],
  owner: OwnerCredentials,
  clientIp = randomIp()
): Promise<APIRequestContext> {
  const api = await playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: ipHeaders(clientIp),
  });
  const res = await api.post("/api/auth/login", { data: owner });
  expect(res.status(), "owner login through the API").toBe(200);
  return api;
}

/**
 * Puts the API client's session cookie into a browser context. Cookies don't
 * care about ports, so the one cookie serves the API (3000) and the apps.
 */
export async function shareSession(api: APIRequestContext, context: BrowserContext) {
  const { cookies } = await api.storageState();
  await context.addCookies(cookies);
}

async function created<T>(res: Awaited<ReturnType<APIRequestContext["post"]>>, key: string) {
  expect(res.status(), `create ${key}: ${await res.text()}`).toBe(201);
  return (await res.json())[key] as T;
}

export type Restaurant = { id: number; name: string; colour: string };
export type Contract = { id: number; contractName: string };
export type Position = { id: number; name: string; colour: string };
export type Shift = { id: number; name: string; shade: string };

// The backend's palette (backend/src/lib/palette.ts), in the same order.
const PALETTE = [
  "red", "orange", "yellow", "lime", "green", "teal",
  "sky", "blue", "indigo", "purple", "pink", "brown",
];
const SHADES = ["early", "late", "full"];

/**
 * The first value in `order` none of the owner's rows uses yet, like the owner
 * app preselects it. A position, shift or restaurant needs one of its own.
 */
async function nextFree(
  api: APIRequestContext,
  path: string,
  key: string,
  field: string,
  order: string[]
) {
  const res = await api.get(path);
  expect(res.status(), `list ${key}: ${await res.text()}`).toBe(200);
  const taken = ((await res.json())[key] as Record<string, string>[]).map((row) => row[field]);
  const free = order.find((value) => !taken.includes(value));
  if (!free) throw new Error(`Every ${field} of ${path} is taken`);
  return free;
}

export type OpeningHours = { weekday: number; openTime: string; closeTime: string }[];

/** Without opening hours the restaurant is closed every day (cells still work). */
export async function createRestaurant(
  api: APIRequestContext,
  name = unique("Restaurant"),
  openingHours?: OpeningHours
) {
  const colour = await nextFree(api, "/api/restaurants", "restaurants", "colour", PALETTE);
  const res = await api.post("/api/restaurants", { data: { name, colour, openingHours } });
  return created<Restaurant>(res, "restaurant");
}

export async function createContract(
  api: APIRequestContext,
  { submitsAvailability = true, contractName = unique("Contract") } = {}
) {
  const res = await api.post("/api/contracts", {
    data: { contractName, maxWeeklyHours: 20, submitsAvailability },
  });
  return created<Contract>(res, "contract");
}

export async function createPosition(api: APIRequestContext, name = unique("Position")) {
  const colour = await nextFree(api, "/api/positions", "positions", "colour", PALETTE);
  return created<Position>(
    await api.post("/api/positions", { data: { name, colour } }),
    "position",
  );
}

export async function createShift(
  api: APIRequestContext,
  { name = unique("Shift"), startTime = "11:00", endTime = "17:00" } = {}
) {
  const shade = await nextFree(api, "/api/shifts", "shifts", "shade", SHADES);
  const res = await api.post("/api/shifts", { data: { name, startTime, endTime, shade } });
  return created<Shift>(res, "shift");
}

export type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  restaurantId: number;
  contractId: number;
  username: string;
};

export async function createEmployee(
  api: APIRequestContext,
  {
    restaurantId,
    contractId,
    dateOfBirth = "1995-03-07",
    firstName = "Ana",
    lastName = `Test${randomUUID().slice(0, 6)}`,
    positionIds = [],
    otherRestaurantIds = [],
  }: {
    restaurantId: number;
    contractId: number;
    dateOfBirth?: string;
    firstName?: string;
    lastName?: string;
    positionIds?: number[];
    otherRestaurantIds?: number[];
  }
): Promise<Employee> {
  const email = `employee-${randomUUID()}@e2e.test`;
  const res = await api.post("/api/employees", {
    data: {
      firstName,
      lastName,
      email,
      dateOfBirth,
      contractId,
      defaultRestaurantId: restaurantId,
      otherRestaurantIds,
      positionIds,
    },
  });
  const employee = await created<{ id: number; username: string }>(res, "employee");
  return {
    id: employee.id,
    firstName,
    lastName,
    email,
    dateOfBirth,
    restaurantId,
    contractId,
    username: employee.username,
  };
}

type EmployeeUpdate = {
  status: "active" | "left";
  contractId: number | null;
  leftOn: string | null;
};

/** PUT replaces the whole employee, so the rest is sent as it was created. */
export async function updateEmployee(
  api: APIRequestContext,
  employee: Employee,
  changes: Partial<EmployeeUpdate>
) {
  const res = await api.put(`/api/employees/${employee.id}`, {
    data: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      dateOfBirth: employee.dateOfBirth,
      contractId: employee.contractId,
      positionIds: [],
      defaultRestaurantId: employee.restaurantId,
      otherRestaurantIds: [],
      status: "active",
      hiredOn: null,
      leftOn: null,
      ...changes,
    },
  });
  expect(res.status(), `update employee: ${await res.text()}`).toBe(200);
}

/** PUT replaces the whole contract; only the availability tick changes here. */
export async function setSubmitsAvailability(
  api: APIRequestContext,
  contract: Contract,
  submitsAvailability: boolean
) {
  const res = await api.put(`/api/contracts/${contract.id}`, {
    data: { contractName: contract.contractName, maxWeeklyHours: 20, submitsAvailability },
  });
  expect(res.status(), `update contract: ${await res.text()}`).toBe(200);
}

/** One schedule cell: the employee works this shift on this day. */
export async function createScheduleEntry(
  api: APIRequestContext,
  {
    employeeId,
    restaurantId,
    shiftId,
    workDate = new Date().toISOString().slice(0, 10),
  }: { employeeId: number; restaurantId: number; shiftId: number; workDate?: string }
) {
  const res = await api.post("/api/schedules/entries", {
    data: { employeeId, restaurantId, shiftId, workDate },
  });
  expect(res.status(), `create schedule entry: ${await res.text()}`).toBe(201);
}

/** The Monday of this week as "YYYY-MM-DD", by the local clock like the owner app. */
export function thisWeekStart(): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${monday.getFullYear()}-${month}-${day}`;
}

export type ScheduleEntry = { employeeId: number; workDate: string; shiftId: number };

/** The saved cells of one restaurant's week. */
export async function scheduleEntries(
  api: APIRequestContext,
  restaurantId: number,
  weekStart: string
): Promise<ScheduleEntry[]> {
  const res = await api.get(`/api/schedules?restaurantId=${restaurantId}&weekStart=${weekStart}`);
  expect(res.status(), `get schedule: ${await res.text()}`).toBe(200);
  return (await res.json()).schedule.entries;
}

// --- Availability ---

export type AvailabilityWindow = {
  opensWeekday: number;
  opensTime: string;
  closesWeekday: number;
  closesTime: string;
  maxSaves: number;
};

/** PUT /api/availability/settings: when employees can submit, and how often. */
export async function setAvailabilityWindow(api: APIRequestContext, window: AvailabilityWindow) {
  const res = await api.put("/api/availability/settings", { data: window });
  expect(res.status(), `availability settings: ${await res.text()}`).toBe(200);
}

/** Always open: Monday 00:00 → Sunday 23:59 (the closing minute counts). */
export function openWindow(api: APIRequestContext, maxSaves = 3) {
  return setAvailabilityWindow(api, {
    opensWeekday: 1,
    opensTime: "00:00",
    closesWeekday: 7,
    closesTime: "23:59",
    maxSaves,
  });
}

/** ISO weekday and "HH:MM" now, on the backend's clock (Europe/Berlin). */
function berlinNow(): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { weekday, time: `${get("hour")}:${get("minute")}` };
}

/** A one-minute window that doesn't include "now": Monday 00:00–00:01, or Sunday 23:58–23:59. */
export function closedWindow(api: APIRequestContext) {
  const now = berlinNow();
  const earlyMonday = now.weekday === 1 && now.time <= "00:02";
  return setAvailabilityWindow(
    api,
    earlyMonday
      ? { opensWeekday: 7, opensTime: "23:58", closesWeekday: 7, closesTime: "23:59", maxSaves: 3 }
      : { opensWeekday: 1, opensTime: "00:00", closesWeekday: 1, closesTime: "00:01", maxSaves: 3 }
  );
}

export type AvailabilityDay = { weekday: number; shiftId: number };

/** GET /api/availability as the employee: the week they can submit for. */
export async function getAvailability(api: APIRequestContext) {
  const res = await api.get("/api/availability");
  expect(res.status(), `get availability: ${await res.text()}`).toBe(200);
  return (await res.json()).availability as {
    weekStart: string;
    isOpen: boolean;
    savesLeft: number;
  };
}

/** POST /api/availability as the employee; returns the saved week. */
export async function submitAvailability(
  api: APIRequestContext,
  days: AvailabilityDay[],
  note?: string
) {
  const res = await api.post("/api/availability", { data: { days, note } });
  expect([200, 201], `submit availability: ${await res.text()}`).toContain(res.status());
  return (await res.json()).availability as { weekStart: string; savesLeft: number };
}

/** "2026-11-30" + 1 day → "2026-12-01" (dates only, no time zone). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-30" → "30.11.", as both apps show a day. */
export function dayMonth(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
}

/** Monday to Friday 10:00–23:00, closed at the weekend. */
export const WEEKDAYS_OPEN: OpeningHours = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  openTime: "10:00",
  closeTime: "23:00",
}));

/**
 * Everything availability needs: shifts Früh and Spät, a "Service" position
 * (the schedule's Service zone), a restaurant open Monday–Friday, a contract
 * that submits availability and a part-timer working there.
 */
export async function availabilitySetup(api: APIRequestContext) {
  const early = await createShift(api, { name: "Früh", startTime: "11:00", endTime: "17:00" });
  const late = await createShift(api, { name: "Spät", startTime: "17:00", endTime: "23:00" });
  const service = await createPosition(api, "Service");
  const restaurant = await createRestaurant(api, unique("Restaurant"), WEEKDAYS_OPEN);
  const contract = await createContract(api, { submitsAvailability: true });
  const employee = await createEmployee(api, {
    restaurantId: restaurant.id,
    contractId: contract.id,
    positionIds: [service.id],
  });
  return { early, late, restaurant, employee, person: `${employee.firstName} ${employee.lastName}` };
}
