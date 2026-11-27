/**
 * The employees feature caches every restaurant's employee list under this
 * key, and each employee comes with the names of their positions. Renaming or
 * deleting a position makes those lists stale.
 *
 * Written out here instead of imported from features/employees: that feature
 * already imports this one, and the import would go in a circle.
 */
export const employeesKey = ["employees"] as const;
