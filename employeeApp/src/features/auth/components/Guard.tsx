import { Navigate, Outlet } from "react-router";
import { useCurrentUser } from "../api/useCurrentUser";
import { zoneHome, zoneOf, type Zone } from "../zones";

export function Guard({ zone }: { zone: Zone }) {
  const current = zoneOf(useCurrentUser());
  return current === zone ? (
    <Outlet />
  ) : (
    <Navigate to={zoneHome[current]} replace />
  );
}

export function RedirectHome() {
  return <Navigate to={zoneHome[zoneOf(useCurrentUser())]} replace />;
}
