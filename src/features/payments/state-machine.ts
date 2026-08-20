/**
 * Order status state machine.
 *
 * Defines allowed transitions between order statuses.
 * Enforced server-side to prevent invalid state changes.
 *
 * State diagram:
 *   PENDING → PAID
 *   PENDING → FAILED
 *   PENDING → CANCELLED
 *   PAID is terminal (no further transitions in this milestone)
 *   FAILED is terminal
 *   CANCELLED is terminal
 *   REFUNDED is terminal (future milestone)
 */

import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";

/** Map of allowed transitions: from → set of valid destinations */
const ALLOWED_TRANSITIONS: Record<OrderStatus, Set<OrderStatus>> = {
  [ORDER_STATUS.PENDING]: new Set([
    ORDER_STATUS.PAID,
    ORDER_STATUS.FAILED,
    ORDER_STATUS.CANCELLED,
  ]),
  [ORDER_STATUS.PAID]: new Set([
    ORDER_STATUS.REFUNDED,
  ]),
  [ORDER_STATUS.FAILED]: new Set(),
  [ORDER_STATUS.CANCELLED]: new Set(),
  [ORDER_STATUS.REFUNDED]: new Set(),
};

/**
 * Check if a status transition is allowed.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  // Same status is always "allowed" (idempotent, no-op)
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Assert that a status transition is valid.
 * Throws if the transition is not allowed.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return; // Idempotent
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid order status transition: ${from} → ${to}`,
    );
  }
}

/**
 * Check if a status is terminal (no further transitions possible,
 * except same-status idempotency).
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return (ALLOWED_TRANSITIONS[status]?.size ?? 0) === 0;
}
