"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem } from "@/types/common";

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "van-thcs-cart";
const CART_VERSION_KEY = "van-thcs-cart-v";
const CURRENT_CART_VERSION = 2;

// UUID v4 regex for validating product IDs
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// External cart store
// Uses useSyncExternalStore so React can subscribe to cart changes without
// calling setState inside an effect. getServerSnapshot returns [] to ensure
// server and client first-render always match (no hydration mismatch).
// ---------------------------------------------------------------------------

let cartItems: CartItem[] = [];
let listeners: Array<() => void> = [];
let initialized = false;

function initIfNeeded(): void {
  if (initialized) return;
  initialized = true;
  try {
    const storedVersion = localStorage.getItem(CART_VERSION_KEY);
    const version = storedVersion ? parseInt(storedVersion, 10) : 0;

    if (version < CURRENT_CART_VERSION) {
      // Clear legacy cart data (mock IDs like prod-1, cat-1, etc.)
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.setItem(CART_VERSION_KEY, String(CURRENT_CART_VERSION));
      return;
    }

    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CartItem[];
      // Filter out any items with non-UUID product IDs (legacy mock data)
      cartItems = parsed.filter((item) => UUID_RE.test(item.productId));
      // If any items were filtered, persist the cleaned cart
      if (cartItems.length !== parsed.length) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      }
    }
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.setItem(CART_VERSION_KEY, String(CURRENT_CART_VERSION));
  }
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function persistAndEmit(next: CartItem[]): void {
  cartItems = next;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable
  }
  emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): CartItem[] {
  initIfNeeded();
  return cartItems;
}

// Server snapshot is always empty — guarantees deterministic SSR output.
const SERVER_SNAPSHOT: CartItem[] = [];
function getServerSnapshot(): CartItem[] {
  return SERVER_SNAPSHOT;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addItem = useCallback((item: CartItem) => {
    // SECURITY GUARD: Never add FREE items to cart
    if (item.productType === "FREE") {
      console.warn("[Cart] Attempted to add a FREE item to cart. Blocked.");
      return;
    }
    
    // Don't add duplicates
    if (cartItems.some((i) => i.productId === item.productId)) {
      return;
    }
    persistAndEmit([...cartItems, item]);
  }, []);

  const removeItem = useCallback((productId: string) => {
    persistAndEmit(cartItems.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    persistAndEmit([]);
  }, []);

  const isInCart = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items],
  );

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearCart, isInCart, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}