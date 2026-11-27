// Public API of the availability feature. Code outside features/availability imports only from here.
export { Availability } from "./components/Availability/Availability";
export { availabilityQuery, useAvailability } from "./api/useAvailability";
export type { AvailabilityWeek } from "./types";
