/** A user as the API returns it (backend: publicUserColumns). */
export type User = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  role: "owner" | "employee";
  avatarUrl: string | null;
  createdAt: string;
};

export type LoginInput = {
  email: string;
  password: string;
};
