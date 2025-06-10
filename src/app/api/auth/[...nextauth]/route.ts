// inspect-drive\src\app\api\auth\[...nextauth]\route.ts

import NextAuth from "next-auth";
import { authOptions } from "../authOptions"; // ใช้ Path ที่ถูกต้อง

export const GET = NextAuth(authOptions); // ใช้แบบปกติ ไม่ใช้ Destructuring
export const POST = NextAuth(authOptions);
