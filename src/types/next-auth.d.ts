import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      /** Currently active workspace id selected by the user. */
      activeWorkspaceId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** User primary key, mirrored from `sub`. */
    id: string;
    activeWorkspaceId?: string | null;
  }
}