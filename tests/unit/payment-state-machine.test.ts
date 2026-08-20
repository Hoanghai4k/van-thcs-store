/**
 * Payment state machine tests.
 */

import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, isTerminalStatus } from "@/features/payments/state-machine";
import { ORDER_STATUS } from "@/lib/constants";

describe("canTransition", () => {
  // Valid transitions from PENDING
  it("allows PENDING → PAID", () => {
    expect(canTransition(ORDER_STATUS.PENDING, ORDER_STATUS.PAID)).toBe(true);
  });

  it("allows PENDING → FAILED", () => {
    expect(canTransition(ORDER_STATUS.PENDING, ORDER_STATUS.FAILED)).toBe(true);
  });

  it("allows PENDING → CANCELLED", () => {
    expect(canTransition(ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED)).toBe(true);
  });

  // Valid transition from PAID
  it("allows PAID → REFUNDED", () => {
    expect(canTransition(ORDER_STATUS.PAID, ORDER_STATUS.REFUNDED)).toBe(true);
  });

  // Same status (idempotent)
  it("allows same status (PENDING → PENDING)", () => {
    expect(canTransition(ORDER_STATUS.PENDING, ORDER_STATUS.PENDING)).toBe(true);
  });

  it("allows same status (PAID → PAID)", () => {
    expect(canTransition(ORDER_STATUS.PAID, ORDER_STATUS.PAID)).toBe(true);
  });

  // Invalid transitions
  it("rejects PAID → PENDING", () => {
    expect(canTransition(ORDER_STATUS.PAID, ORDER_STATUS.PENDING)).toBe(false);
  });

  it("rejects PAID → FAILED", () => {
    expect(canTransition(ORDER_STATUS.PAID, ORDER_STATUS.FAILED)).toBe(false);
  });

  it("rejects PAID → CANCELLED", () => {
    expect(canTransition(ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED)).toBe(false);
  });

  it("rejects FAILED → PAID", () => {
    expect(canTransition(ORDER_STATUS.FAILED, ORDER_STATUS.PAID)).toBe(false);
  });

  it("rejects CANCELLED → PAID", () => {
    expect(canTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.PAID)).toBe(false);
  });

  it("rejects CANCELLED → PENDING", () => {
    expect(canTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.PENDING)).toBe(false);
  });

  it("rejects REFUNDED → PENDING", () => {
    expect(canTransition(ORDER_STATUS.REFUNDED, ORDER_STATUS.PENDING)).toBe(false);
  });
});

describe("assertTransition", () => {
  it("does not throw for valid transitions", () => {
    expect(() => assertTransition(ORDER_STATUS.PENDING, ORDER_STATUS.PAID)).not.toThrow();
  });

  it("does not throw for same status (idempotent)", () => {
    expect(() => assertTransition(ORDER_STATUS.PAID, ORDER_STATUS.PAID)).not.toThrow();
  });

  it("throws for invalid transitions", () => {
    expect(() => assertTransition(ORDER_STATUS.PAID, ORDER_STATUS.PENDING)).toThrow(
      "Invalid order status transition: PAID → PENDING",
    );
  });

  it("throws for CANCELLED → PAID", () => {
    expect(() => assertTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.PAID)).toThrow();
  });
});

describe("isTerminalStatus", () => {
  it("PENDING is not terminal", () => {
    expect(isTerminalStatus(ORDER_STATUS.PENDING)).toBe(false);
  });

  it("PAID is not terminal (can be refunded)", () => {
    expect(isTerminalStatus(ORDER_STATUS.PAID)).toBe(false);
  });

  it("FAILED is terminal", () => {
    expect(isTerminalStatus(ORDER_STATUS.FAILED)).toBe(true);
  });

  it("CANCELLED is terminal", () => {
    expect(isTerminalStatus(ORDER_STATUS.CANCELLED)).toBe(true);
  });

  it("REFUNDED is terminal", () => {
    expect(isTerminalStatus(ORDER_STATUS.REFUNDED)).toBe(true);
  });
});
