/**
 * Order success page — payOS return URL.
 *
 * CRITICAL: This page does NOT mark the order as PAID.
 * The returnUrl is NOT payment authority. Only the webhook can set PAID status.
 *
 * This page:
 * 1. Reads orderCode from query params
 * 2. Displays order status from the database
 * 3. May show PENDING if webhook hasn't arrived yet
 */

import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ orderCode?: string }>;
}

export default async function OrderSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderCode = params.orderCode;

  if (!orderCode) {
    redirect("/order/lookup");
  }

  // Redirect to the order status page which shows real status
  redirect(`/order/${orderCode}`);
}
