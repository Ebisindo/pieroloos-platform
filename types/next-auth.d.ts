import "next-auth";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** Non-secret, server-issued identifier carried by the signed JWT session. */
    stepUpSessionId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    stepUpSessionId?: string;
  }
}
