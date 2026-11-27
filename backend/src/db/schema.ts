import {
  bigint,
  pgEnum,
  boolean,
  pgTable,
  text,
  timestamp,
  check,
  index,
  uniqueIndex,
  smallint,
  time,
  primaryKey,
  foreignKey,
  unique,
  date,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const systemRole = pgEnum("system_role", ["owner", "employee"]);
export const employmentStatus = pgEnum("employment_status", ["active", "left"]);

// The schedule colours, stored on the record so they don't depend on names.
// A position's and a restaurant's hue, from a fixed swatch grid like Excel's
// (no black, white or grey: those mean "no shift" and "closed" in the plans).
// Each hue has an Early, a Late and a Full day shade in the frontend's tokens.
export const paletteColour = pgEnum("palette_colour", [
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
  "sky",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
]);
// A shift's shade of the position's hue: light, mid or dark in the plans.
export const shiftShade = pgEnum("shift_shade", ["early", "late", "full"]);

export const appUser = pgTable(
  "app_user",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    username: text("username").unique(),
    email: text("email").unique().notNull(),
    passwordHash: text("password_hash"),
    role: systemRole("role").notNull(),
    googleId: text("google_id").unique(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Owners always need a way to log in. An employee without a password is
    // on purpose: only employees on a contract that submits availability can
    // log in (see syncEmployeeLogins).
    check(
      "app_user_has_login_method",
      sql`${table.role} = 'employee' OR ${table.passwordHash} IS NOT NULL OR ${table.googleId} IS NOT NULL`
    ),
  ]
);

// Only the SHA-256 hash of a token is stored. The raw token lives in the
// cookie, so a leaked database can't be used to log in.
export const session = pgTable(
  "session",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const restaurant = pgTable(
  "restaurant",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    // The hue of the restaurant's column in the schedule.
    colour: paletteColour("colour").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // An owner can't have two restaurants with the same name. The index starts
  // with owner_id, so it also serves "all restaurants of this owner".
  (table) => [
    uniqueIndex("restaurant_owner_id_name_idx").on(table.ownerId, table.name),
    // One restaurant per colour, so the owner's columns can be told apart.
    uniqueIndex("restaurant_owner_id_colour_idx").on(
      table.ownerId,
      table.colour
    ),
    // Target of the composite foreign key in employee.
    unique("restaurant_id_owner_id_key").on(table.id, table.ownerId),
  ]
);

// One row per open day. A day without a row means the restaurant is closed.
// weekday follows ISO 8601: 1 = Monday ... 7 = Sunday.
// close_time earlier than open_time = closes after midnight.
// close_time equal to open_time = open 24 hours.
export const restaurantOpeningHours = pgTable(
  "restaurant_opening_hours",
  {
    restaurantId: bigint("restaurant_id", { mode: "number" })
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    openTime: time("open_time").notNull(),
    closeTime: time("close_time").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.restaurantId, table.weekday] }),
    check(
      "restaurant_opening_hours_weekday_range",
      sql`${table.weekday} BETWEEN 1 AND 7`
    ),
  ]
);

// Contract types are defined by the owner and shared by all their restaurants
// (e.g. "Vollzeit", "Minijob"). contract_pdf holds the storage key of an
// optional uploaded template, not the file itself.
export const contract = pgTable(
  "contract",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    contractName: text("contract_name").notNull(),
    maxWeeklyHours: numeric("max_weekly_hours", {
      precision: 4,
      scale: 1,
      mode: "number",
    }).notNull(),
    contractPdf: text("contract_pdf"),
    // People on this contract type submit their availability, and they are
    // the only employees who can log in to the employee app.
    submitsAvailability: boolean("submits_availability")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("contract_owner_id_idx").on(table.ownerId),
    // Target of the composite foreign key in employee.
    unique("contract_id_owner_id_key").on(table.id, table.ownerId),
    check(
      "contract_max_weekly_hours_range",
      sql`${table.maxWeeklyHours} > 0 AND ${table.maxWeeklyHours} <= 168`
    ),
  ]
);

// One row per person who works for an owner. The restaurants they work in
// are in employee_restaurant; their positions (employee_position) apply in all
// of them.
export const employee = pgTable(
  "employee",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .unique()
      .references(() => appUser.id, { onDelete: "cascade" }),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    // Null only for someone who left and whose contract type was deleted
    // afterwards (see employee_active_has_contract).
    contractId: bigint("contract_id", { mode: "number" }),
    status: employmentStatus("status").notNull().default("active"),
    // Part of the employee's profile.
    dateOfBirth: date("date_of_birth").notNull(),
    hiredOn: date("hired_on"),
    leftOn: date("left_on"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Target of the composite foreign keys in employee_position,
    // employee_restaurant and availability.
    unique("employee_id_owner_id_key").on(table.id, table.ownerId),
    // No ON DELETE action: a contract type that is still in use can't be
    // deleted. Deliberately not RESTRICT, which would also block deleting the
    // owner (that cascade removes the employees in the same statement).
    // Former employees are taken off the contract by the delete endpoint.
    foreignKey({
      name: "employee_contract_fk",
      columns: [table.contractId, table.ownerId],
      foreignColumns: [contract.id, contract.ownerId],
    }),
    check(
      "employee_active_has_contract",
      sql`${table.status} = 'left' OR ${table.contractId} IS NOT NULL`
    ),
    index("employee_owner_id_idx").on(table.ownerId),
    index("employee_contract_id_idx").on(table.contractId),
  ]
);

// Positions are defined by the owner and shared by all their restaurants
// (e.g. "Küche", "Service").
export const position = pgTable(
  "position",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // The hue of the position's zone and cells in the schedule.
    colour: paletteColour("colour").notNull(),
  },
  (table) => [
    // An owner can't have two positions with the same name. The index starts
    // with owner_id, so it also serves "all positions of this owner".
    uniqueIndex("position_owner_id_name_idx").on(table.ownerId, table.name),
    // One position per colour: every position is a zone of its own in the
    // schedule, told apart by its colour.
    uniqueIndex("position_owner_id_colour_idx").on(
      table.ownerId,
      table.colour
    ),
    // Target of the composite foreign key in employee_position.
    unique("position_id_owner_id_key").on(table.id, table.ownerId),
  ]
);

// An employee can have several positions, and they apply in every restaurant
// the employee works in. owner_id is an integrity helper:
// both foreign keys include it, so an employee can only be given positions of
// the owner they work for.
export const employeePosition = pgTable(
  "employee_position",
  {
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    positionId: bigint("position_id", { mode: "number" }).notNull(),
    ownerId: bigint("owner_id", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.employeeId, table.positionId] }),
    foreignKey({
      name: "employee_position_employee_fk",
      columns: [table.employeeId, table.ownerId],
      foreignColumns: [employee.id, employee.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "employee_position_position_fk",
      columns: [table.positionId, table.ownerId],
      foreignColumns: [position.id, position.ownerId],
    }).onDelete("cascade"),
    index("employee_position_position_id_idx").on(table.positionId),
  ]
);

// The restaurants an employee works in. Exactly one of them is their default
// restaurant: their availability is shown in its schedule. The database allows
// at most one default; the API makes sure there is always one.
// owner_id is an integrity helper: both foreign keys include it, so an
// employee can only work in restaurants of the owner they work for.
export const employeeRestaurant = pgTable(
  "employee_restaurant",
  {
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    restaurantId: bigint("restaurant_id", { mode: "number" }).notNull(),
    ownerId: bigint("owner_id", { mode: "number" }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (table) => [
    // Also the target of the composite foreign key in schedule_entry.
    primaryKey({ columns: [table.employeeId, table.restaurantId] }),
    foreignKey({
      name: "employee_restaurant_employee_fk",
      columns: [table.employeeId, table.ownerId],
      foreignColumns: [employee.id, employee.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "employee_restaurant_restaurant_fk",
      columns: [table.restaurantId, table.ownerId],
      foreignColumns: [restaurant.id, restaurant.ownerId],
    }).onDelete("cascade"),
    // At most one default restaurant per employee.
    uniqueIndex("employee_restaurant_one_default_idx")
      .on(table.employeeId)
      .where(sql`${table.isDefault}`),
    index("employee_restaurant_restaurant_id_idx").on(table.restaurantId),
  ]
);

// The owner's shifts (e.g. "Früh" 11:00–17:00), shared by all their
// restaurants. start_time / end_time are the defaults; a restaurant can
// override them in restaurant_shift.
// end_time earlier than start_time = ends after midnight (same rule as
// restaurant_opening_hours).
export const shift = pgTable(
  "shift",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    // How dark the shift's cells are in the position's hue.
    shade: shiftShade("shade").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // An owner can't have two shifts with the same name. The index starts
    // with owner_id, so it also serves "all shifts of this owner".
    uniqueIndex("shift_owner_id_name_idx").on(table.ownerId, table.name),
    // One shift per shade, so every shift's cells can be told apart. With
    // three shades an owner has at most three shifts.
    uniqueIndex("shift_owner_id_shade_idx").on(table.ownerId, table.shade),
    // Target of the composite foreign key in restaurant_shift.
    unique("shift_id_owner_id_key").on(table.id, table.ownerId),
    check(
      "shift_start_differs_from_end",
      sql`${table.startTime} <> ${table.endTime}`
    ),
  ]
);

// The times of one shift in one restaurant. Every restaurant has one row per
// shift of its owner (the API creates them when a shift or a restaurant is
// created). start_time / end_time override the shift's default times; both
// null = the default.
// owner_id is an integrity helper: both foreign keys include it, so a
// restaurant can only get shifts of its own owner.
export const restaurantShift = pgTable(
  "restaurant_shift",
  {
    restaurantId: bigint("restaurant_id", { mode: "number" }).notNull(),
    shiftId: bigint("shift_id", { mode: "number" }).notNull(),
    ownerId: bigint("owner_id", { mode: "number" }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Also the target of the composite foreign key in schedule_entry.
    primaryKey({ columns: [table.restaurantId, table.shiftId] }),
    foreignKey({
      name: "restaurant_shift_restaurant_fk",
      columns: [table.restaurantId, table.ownerId],
      foreignColumns: [restaurant.id, restaurant.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "restaurant_shift_shift_fk",
      columns: [table.shiftId, table.ownerId],
      foreignColumns: [shift.id, shift.ownerId],
    }).onDelete("cascade"),
    // Override both times or none.
    check(
      "restaurant_shift_both_times_or_none",
      sql`(${table.startTime} IS NULL) = (${table.endTime} IS NULL)`
    ),
    check(
      "restaurant_shift_start_differs_from_end",
      sql`${table.startTime} IS NULL OR ${table.startTime} <> ${table.endTime}`
    ),
    index("restaurant_shift_shift_id_idx").on(table.shiftId),
  ]
);

// One schedule per restaurant per week. week_start is always a Monday; the
// week runs to week_start + 6 (Sunday), so no end date is stored.
export const schedule = pgTable(
  "schedule",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    restaurantId: bigint("restaurant_id", { mode: "number" })
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // The index starts with restaurant_id, so it also serves "all schedules
    // of this restaurant".
    uniqueIndex("schedule_restaurant_id_week_start_idx").on(
      table.restaurantId,
      table.weekStart
    ),
    // Target of the composite foreign key in schedule_entry.
    unique("schedule_id_restaurant_id_week_start_key").on(
      table.id,
      table.restaurantId,
      table.weekStart
    ),
    check(
      "schedule_week_start_is_monday",
      sql`EXTRACT(ISODOW FROM ${table.weekStart}) = 1`
    ),
  ]
);

// One filled cell of a schedule: an employee works a shift on one day. A day
// without a row means the employee isn't working.
// start_time / end_time optionally change the shift's usual times
// ("Spät ab 18" = start_time 18:00); null means the shift's own time.
// shift_id is the owner's shift; the start and end shown in the cell are the
// restaurant's times for it (restaurant_shift), unless the cell changes them.
// restaurant_id and week_start are integrity helpers:
// - the foreign keys make the schedule, the employee's link to the restaurant
//   and the shift all belong to the same restaurant (the employee has to work
//   there and the restaurant has to have that shift);
// - work_date has to fall inside the schedule's week;
// - (employee_id, work_date) is unique, so a person can't be booked at two
//   restaurants on the same day.
export const scheduleEntry = pgTable(
  "schedule_entry",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    scheduleId: bigint("schedule_id", { mode: "number" }).notNull(),
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    shiftId: bigint("shift_id", { mode: "number" }).notNull(),
    workDate: date("work_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    note: text("note"),
    restaurantId: bigint("restaurant_id", { mode: "number" }).notNull(),
    weekStart: date("week_start").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "schedule_entry_schedule_fk",
      columns: [table.scheduleId, table.restaurantId, table.weekStart],
      foreignColumns: [schedule.id, schedule.restaurantId, schedule.weekStart],
    }).onDelete("cascade"),
    // The employee works in this restaurant. No ON DELETE action: a
    // restaurant can't be taken off someone who has shifts there (the API
    // answers 409). Deleting the restaurant still works: its cascade removes
    // the entries in the same statement.
    foreignKey({
      name: "schedule_entry_employee_restaurant_fk",
      columns: [table.employeeId, table.restaurantId],
      foreignColumns: [
        employeeRestaurant.employeeId,
        employeeRestaurant.restaurantId,
      ],
    }),
    // Deleting the employee deletes their shifts.
    foreignKey({
      name: "schedule_entry_employee_fk",
      columns: [table.employeeId],
      foreignColumns: [employee.id],
    }).onDelete("cascade"),
    // No ON DELETE action: a shift that is used in a schedule can't be
    // deleted (its cascade to restaurant_shift is blocked here). Deliberately
    // not RESTRICT, which would also block deleting the restaurant or the
    // owner (those cascades remove the entries in the same statement).
    foreignKey({
      name: "schedule_entry_restaurant_shift_fk",
      columns: [table.restaurantId, table.shiftId],
      foreignColumns: [restaurantShift.restaurantId, restaurantShift.shiftId],
    }),
    // One shift per person per day, across all restaurants. The index starts
    // with employee_id, so it also serves "all shifts of this employee".
    unique("schedule_entry_employee_id_work_date_key").on(
      table.employeeId,
      table.workDate
    ),
    check(
      "schedule_entry_work_date_in_week",
      sql`${table.workDate} BETWEEN ${table.weekStart} AND ${table.weekStart} + 6`
    ),
    check(
      "schedule_entry_start_differs_from_end",
      sql`${table.startTime} IS NULL OR ${table.endTime} IS NULL OR ${table.startTime} <> ${table.endTime}`
    ),
    index("schedule_entry_schedule_id_idx").on(table.scheduleId),
    index("schedule_entry_shift_id_idx").on(table.shiftId),
  ]
);

// The owner's availability settings. Employees submit their availability for
// next week while the window is open (weekday + time in Europe/Berlin, ISO
// weekdays 1 = Monday ... 7 = Sunday), and can save at most max_saves times.
// No row = the defaults: Friday 00:00 to Sunday 23:59, 3 saves. The row is
// created the first time the owner saves the settings.
export const availabilitySettings = pgTable(
  "availability_settings",
  {
    ownerId: bigint("owner_id", { mode: "number" })
      .primaryKey()
      .references(() => appUser.id, { onDelete: "cascade" }),
    opensWeekday: smallint("opens_weekday").notNull(),
    opensTime: time("opens_time").notNull(),
    closesWeekday: smallint("closes_weekday").notNull(),
    closesTime: time("closes_time").notNull(),
    maxSaves: smallint("max_saves").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "availability_settings_opens_weekday_range",
      sql`${table.opensWeekday} BETWEEN 1 AND 7`
    ),
    check(
      "availability_settings_closes_weekday_range",
      sql`${table.closesWeekday} BETWEEN 1 AND 7`
    ),
    check(
      "availability_settings_max_saves_range",
      sql`${table.maxSaves} BETWEEN 1 AND 5`
    ),
  ]
);

// One employee's availability for one week: the week and the note. The days
// they can work are in availability_day. week_start is always a Monday.
// save_count counts every save, even an unchanged one; a week can only be
// submitted in one window, so it never needs resetting.
// Weeks that ended more than two weeks ago are deleted when someone saves.
// owner_id is an integrity helper for the foreign keys.
export const availability = pgTable(
  "availability",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    ownerId: bigint("owner_id", { mode: "number" }).notNull(),
    weekStart: date("week_start").notNull(),
    // Null = no note.
    note: text("note"),
    saveCount: smallint("save_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "availability_employee_fk",
      columns: [table.employeeId, table.ownerId],
      foreignColumns: [employee.id, employee.ownerId],
    }).onDelete("cascade"),
    // Once per employee per week. The index starts with employee_id, so it
    // also serves "all weeks of this employee".
    uniqueIndex("availability_employee_id_week_start_idx").on(
      table.employeeId,
      table.weekStart
    ),
    // Target of the composite foreign key in availability_day.
    unique("availability_id_owner_id_key").on(table.id, table.ownerId),
    // For deleting old weeks.
    index("availability_week_start_idx").on(table.weekStart),
    check(
      "availability_week_start_is_monday",
      sql`EXTRACT(ISODOW FROM ${table.weekStart}) = 1`
    ),
    check(
      "availability_note_length",
      sql`char_length(${table.note}) <= 100`
    ),
    check("availability_save_count_positive", sql`${table.saveCount} >= 1`),
  ]
);

// One day the employee can work, with the shift they picked. A day without a
// row means they aren't available. weekday is ISO (1 = Monday ... 7 = Sunday);
// the date is the week's week_start + weekday - 1.
// dismissed_at: the owner removed this hint from the schedule. The employee's
// availability itself is never changed by the owner.
// owner_id is an integrity helper: both foreign keys include it, so an
// employee can only pick shifts of their own owner.
export const availabilityDay = pgTable(
  "availability_day",
  {
    availabilityId: bigint("availability_id", { mode: "number" }).notNull(),
    weekday: smallint("weekday").notNull(),
    shiftId: bigint("shift_id", { mode: "number" }).notNull(),
    // Also deleted straight with the owner: through the employee the cascade
    // would reach these rows only after Postgres has checked that the owner's
    // shifts (deleted too) are no longer picked here, and the delete would
    // fail.
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.availabilityId, table.weekday] }),
    foreignKey({
      name: "availability_day_availability_fk",
      columns: [table.availabilityId, table.ownerId],
      foreignColumns: [availability.id, availability.ownerId],
    }).onDelete("cascade"),
    // No ON DELETE action: a shift used in availability can't be deleted.
    // Deliberately not RESTRICT, which would also block deleting the owner
    // (that cascade removes the availability in the same statement).
    foreignKey({
      name: "availability_day_shift_fk",
      columns: [table.shiftId, table.ownerId],
      foreignColumns: [shift.id, shift.ownerId],
    }),
    check(
      "availability_day_weekday_range",
      sql`${table.weekday} BETWEEN 1 AND 7`
    ),
    index("availability_day_shift_id_idx").on(table.shiftId),
  ]
);
