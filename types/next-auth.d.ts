// inspect-drive\types\next-auth.d.ts

import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

// ขยาย (augment) โมดูล "next-auth" 
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

// ขยาย (augment) โมดูล "next-auth/jwt" (ถ้าต้องการใช้ JWT callbacks)
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}