import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth/customer-auth";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi",
};

export default async function AccountOrdersPage() {
  await requireCustomer("/account/orders");
  // For Phase 1C, seamlessly route to the existing /orders page
  redirect("/orders");
}
