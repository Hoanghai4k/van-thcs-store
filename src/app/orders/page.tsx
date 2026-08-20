import { Metadata } from "next";
import { getMyOrdersAccessCookie } from "@/lib/auth/my-orders-access";
import { getOrdersByEmail } from "@/features/orders/queries";
import { MyOrdersForm, MyOrdersList } from "./client-components";
import { OrderStatus } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi",
  description: "Quản lý và theo dõi các đơn hàng của bạn.",
};

export default async function MyOrdersPage() {
  // Check if user has an active My Orders session
  const session = await getMyOrdersAccessCookie();

  if (!session.valid) {
    return (
      <div className="container mx-auto px-4 py-16">
        <MyOrdersForm />
      </div>
    );
  }

  // Fetch orders for the verified email
  const rawOrders = await getOrdersByEmail(session.email);

  // Map to the shape expected by the client component to minimize payload size
  const orders = rawOrders.map((o) => ({
    id: o.id,
    orderCode: o.orderCode,
    totalAmount: o.totalAmount,
    status: o.status as OrderStatus,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ productName: i.productName })),
    latestPaymentAttemptStatus: o.latestPaymentAttempt?.status,
  }));

  return (
    <div className="container mx-auto px-4 py-10 md:py-16">
      <MyOrdersList email={session.email} orders={orders} />
    </div>
  );
}
