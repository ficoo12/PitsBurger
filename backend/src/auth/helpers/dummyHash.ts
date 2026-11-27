import bcrypt from "bcrypt";
const BCRYPT_COST = 12;
export const DUMMY_HASH = bcrypt.hashSync(
  "dummy-password-for-timing",
  BCRYPT_COST
);
