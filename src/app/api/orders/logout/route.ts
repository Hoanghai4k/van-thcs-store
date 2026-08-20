import { NextResponse } from "next/server";
import { clearMyOrdersAccessCookie } from "@/lib/auth/my-orders-access";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearMyOrdersAccessCookie(response);
  return response;
}
