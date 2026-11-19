export type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "user" | "admin";
  emailConfirmedAt: string | null;
  createdAt: string;
};
