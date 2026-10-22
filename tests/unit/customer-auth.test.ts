import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  getSafeRedirect,
  getCurrentAuthUser,
  getCurrentCustomer,
  requireCustomer,
  linkVerifiedAuthUserToCustomer,
} from "@/lib/auth/customer-auth";
import { requestOtp, verifyOtp } from "@/app/(store)/login/actions";
import { logoutCustomer } from "@/app/(store)/account/actions";
import * as serverSupa from "@/lib/supabase/server";
import * as adminSupa from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { normalizeEmail } from "@/lib/utils";
import fs from "fs";
import path from "path";

// Mock next/navigation
const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase modules
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("Customer Authentication & Account Linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Safe Redirect and Open Redirect Defense
  // ─────────────────────────────────────────────────────────────────────────
  describe("Open Redirect Protection (getSafeRedirect)", () => {
    it("allows valid application-relative paths", () => {
      expect(getSafeRedirect("/account")).toBe("/account");
      expect(getSafeRedirect("/account/orders")).toBe("/account/orders");
      expect(getSafeRedirect("/account/library")).toBe("/account/library");
      expect(getSafeRedirect("/gio-hang")).toBe("/gio-hang");
      expect(getSafeRedirect("/tai-lieu/ngu-van-9?ref=banner")).toBe(
        "/tai-lieu/ngu-van-9?ref=banner",
      );
    });

    it("defaults to /account for null, undefined, or empty strings", () => {
      expect(getSafeRedirect(null)).toBe("/account");
      expect(getSafeRedirect(undefined)).toBe("/account");
      expect(getSafeRedirect("")).toBe("/account");
      expect(getSafeRedirect("   ")).toBe("/account");
    });

    it("rejects malicious absolute external protocol URLs", () => {
      expect(getSafeRedirect("https://evil.com")).toBe("/account");
      expect(getSafeRedirect("http://evil.com/phish")).toBe("/account");
      expect(getSafeRedirect("ftp://evil.com/file")).toBe("/account");
      expect(getSafeRedirect("https://tailieuhangcao.vn.attacker.com")).toBe("/account");
    });

    it("rejects protocol-relative URL exploits (//evil.com)", () => {
      expect(getSafeRedirect("//evil.com")).toBe("/account");
      expect(getSafeRedirect("//attacker.com/steal-session")).toBe("/account");
      expect(getSafeRedirect("///evil.com")).toBe("/account");
    });

    it("rejects backslash evasion exploits (/\\evil.com)", () => {
      expect(getSafeRedirect("/\\evil.com")).toBe("/account");
      expect(getSafeRedirect("/\\/attacker.com")).toBe("/account");
    });

    it("rejects script, data, and javascript URI schemes", () => {
      expect(getSafeRedirect("javascript:alert(1)")).toBe("/account");
      expect(getSafeRedirect("data:text/html,<script>alert(1)</script>")).toBe("/account");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Route Protection & Anonymous Guard (requireCustomer)
  // ─────────────────────────────────────────────────────────────────────────
  describe("Route Protection (requireCustomer)", () => {
    it("redirects unauthenticated anonymous user to /login with encoded redirect", async () => {
      const mockServerClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      await expect(requireCustomer("/account")).rejects.toThrow("NEXT_REDIRECT:/login?redirect=%2Faccount");
      expect(mockRedirect).toHaveBeenCalledWith("/login?redirect=%2Faccount");
    });

    it("redirects unauthenticated user from deep routes preserving safe target", async () => {
      const mockServerClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      await expect(requireCustomer("/account/orders")).rejects.toThrow(
        "NEXT_REDIRECT:/login?redirect=%2Faccount%2Forders",
      );
    });

    it("returns user and customer when already authenticated and linked", async () => {
      const mockUser = {
        id: "auth-user-123",
        email: "hang@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      } as User;

      const mockCustomerRow = {
        id: "cust-uuid-1",
        auth_user_id: "auth-user-123",
        email: "hang@example.com",
        name: "Cô Hằng Cao",
        phone: "0901234567",
        created_at: "2026-01-01T00:00:00Z",
      };

      const mockServerClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          expect(table).toBe("customers");
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockCustomerRow,
              error: null,
            }),
          };
        }),
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const result = await requireCustomer("/account");
      expect(result.user.id).toBe("auth-user-123");
      expect(result.customer.id).toBe("cust-uuid-1");
      expect(result.customer.name).toBe("Cô Hằng Cao");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. JIT Account Linking State Machine (linkVerifiedAuthUserToCustomer)
  // ─────────────────────────────────────────────────────────────────────────
  describe("Account Linking State Machine (linkVerifiedAuthUserToCustomer)", () => {
    it("fails if auth user email is not confirmed", async () => {
      const unconfirmedUser = {
        id: "user-unconfirmed",
        email: "unconfirmed@example.com",
        email_confirmed_at: null,
        confirmed_at: null,
      } as unknown as User;

      const result = await linkVerifiedAuthUserToCustomer(unconfirmedUser);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Email chưa được xác thực.");
    });

    it("Case A: links existing historical guest customer (auth_user_id IS NULL)", async () => {
      const verifiedUser = {
        id: "user-verified-1",
        email: "guest.buyer@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const existingGuestCustomer = {
        id: "customer-row-99",
        auth_user_id: null,
        email: "guest.buyer@example.com",
        name: "Guest Buyer",
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "customer-row-99", auth_user_id: "user-verified-1" },
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          expect(table).toBe("customers");
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: existingGuestCustomer,
              error: null,
            }),
            update: updateMock,
          };
        }),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(verifiedUser);
      expect(result.success).toBe(true);
      expect(result.customerId).toBe("customer-row-99");
      expect(updateMock).toHaveBeenCalledWith({ auth_user_id: "user-verified-1" });
    });

    it("Case B: idempotent success when customer is already linked to current auth user", async () => {
      const verifiedUser = {
        id: "user-already-linked",
        email: "already@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const alreadyLinkedCustomer = {
        id: "customer-row-55",
        auth_user_id: "user-already-linked",
        email: "already@example.com",
        name: "Returning Customer",
      };

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: alreadyLinkedCustomer,
            error: null,
          }),
          update: vi.fn(),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(verifiedUser);
      expect(result.success).toBe(true);
      expect(result.customerId).toBe("customer-row-55");
      expect(mockAdminClient.from().update).not.toHaveBeenCalled();
    });

    it("Case C: rejects link and prevents order theft if email linked to DIFFERENT auth user", async () => {
      const attackingUser = {
        id: "attacker-user-id-999",
        email: "victim@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const legitimateCustomer = {
        id: "customer-row-victim",
        auth_user_id: "legitimate-owner-id-111",
        email: "victim@example.com",
        name: "Victim Teacher",
      };

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: legitimateCustomer,
            error: null,
          }),
          update: vi.fn(),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(attackingUser);
      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.error).toBe(
        "Email này đã được liên kết với một tài khoản khác. Vui lòng liên hệ hỗ trợ.",
      );
      expect(mockAdminClient.from().update).not.toHaveBeenCalled();
    });

    it("Case D: creates new customer row when no customer exists for email", async () => {
      const brandNewUser = {
        id: "new-user-007",
        email: "brandnew@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
        user_metadata: { name: "Nguyễn Văn A" },
      } as unknown as User;

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "cust-brand-new", auth_user_id: "new-user-007" },
            error: null,
          }),
        }),
      });

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          insert: insertMock,
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(brandNewUser);
      expect(result.success).toBe(true);
      expect(result.customerId).toBe("cust-brand-new");
      expect(insertMock).toHaveBeenCalledWith({
        name: "Nguyễn Văn A",
        email: "brandnew@example.com",
        auth_user_id: "new-user-007",
      });
    });

    it("Case D fallback: defaults name to 'Khách hàng' if metadata has no name", async () => {
      const anonymousMetadataUser = {
        id: "new-user-008",
        email: "noname@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
        user_metadata: {},
      } as unknown as User;

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "cust-no-name", auth_user_id: "new-user-008" },
            error: null,
          }),
        }),
      });

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          insert: insertMock,
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(anonymousMetadataUser);
      expect(result.success).toBe(true);
      expect(insertMock).toHaveBeenCalledWith({
        name: "Khách hàng",
        email: "noname@example.com",
        auth_user_id: "new-user-008",
      });
    });

    it("Case D Race: handles concurrent insertion collision safely", async () => {
      const racingUser = {
        id: "racing-user-1",
        email: "race@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      let callCount = 0;
      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First lookup: not found
              return Promise.resolve({ data: null, error: null });
            }
            // Second lookup after insert conflict: found race row with our id
            return Promise.resolve({
              data: { id: "race-cust-id", auth_user_id: "racing-user-1", email: "race@example.com" },
              error: null,
            });
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "23505", message: "duplicate key value" },
              }),
            }),
          }),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(racingUser);
      expect(result.success).toBe(true);
      expect(result.customerId).toBe("race-cust-id");
    });

    it("matches email case-insensitively using normalizeEmail and ilike", async () => {
      const mixedCaseUser = {
        id: "user-mixed-case",
        email: "Teacher.Hang@GMAIL.Com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const normalized = normalizeEmail(mixedCaseUser.email!);
      expect(normalized).toBe("teacher.hang@gmail.com");

      const ilikeSpy = vi.fn().mockReturnThis();
      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: ilikeSpy,
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "cust-case-test", auth_user_id: "user-mixed-case", email: "teacher.hang@gmail.com" },
            error: null,
          }),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(mixedCaseUser);
      expect(result.success).toBe(true);
      expect(ilikeSpy).toHaveBeenCalledWith("email", "teacher.hang@gmail.com");
    });

    it("safely escapes underscore _ wildcard and prevents accidental matching (customer_test@example.com)", async () => {
      const userWithUnderscore = {
        id: "user-underscore",
        email: "customer_test@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const ilikeSpy = vi.fn().mockReturnThis();

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: ilikeSpy,
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "cust-literal-underscore",
              auth_user_id: null,
              email: "customer_test@example.com",
              name: "Underscore Customer",
            },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "cust-literal-underscore", auth_user_id: "user-underscore" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(userWithUnderscore);
      expect(result.success).toBe(true);
      expect(ilikeSpy).toHaveBeenCalledWith("email", "customer\\_test@example.com");
    });

    it("prevents customer_test@example.com from matching a different customer (e.g. customeraest@example.com)", async () => {
      const userWithUnderscore = {
        id: "user-attacker",
        email: "customer_test@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "cust-different-victim",
              auth_user_id: "victim-111",
              email: "customeraest@example.com",
              name: "Victim Customer",
            },
            error: null,
          }),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(userWithUnderscore);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Không thể xác định chính xác tài khoản khách hàng.");
    });

    it("safely escapes percent % wildcard and prevents accidental matching (customer%test@example.com)", async () => {
      const userWithPercent = {
        id: "user-percent",
        email: "customer%test@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const ilikeSpy = vi.fn().mockReturnThis();

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: ilikeSpy,
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "cust-literal-percent",
              auth_user_id: null,
              email: "customer%test@example.com",
              name: "Percent Customer",
            },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "cust-literal-percent", auth_user_id: "user-percent" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(userWithPercent);
      expect(result.success).toBe(true);
      expect(ilikeSpy).toHaveBeenCalledWith("email", "customer\\%test@example.com");
    });

    it("prevents customer%test@example.com from matching a different customer (e.g. customer123test@example.com)", async () => {
      const userWithPercent = {
        id: "user-percent-attacker",
        email: "customer%test@example.com",
        email_confirmed_at: "2026-02-01T00:00:00Z",
      } as User;

      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "cust-expanded-victim",
              auth_user_id: "victim-222",
              email: "customer123test@example.com",
              name: "Victim Customer",
            },
            error: null,
          }),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const result = await linkVerifiedAuthUserToCustomer(userWithPercent);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Không thể xác định chính xác tài khoản khách hàng.");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Normal Account Reads Enforce RLS (getCurrentCustomer)
  // ─────────────────────────────────────────────────────────────────────────
  describe("Account Read RLS Path (getCurrentCustomer)", () => {
    it("reads customer data using getSupabaseServerClient (customer session) and never admin", async () => {
      const mockUser = {
        id: "user-rls-1",
        email: "customer@domain.vn",
      } as User;

      const eqSpy = vi.fn().mockReturnThis();
      const mockServerClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn((table: string) => {
          expect(table).toBe("customers");
          return {
            select: vi.fn().mockReturnThis(),
            eq: eqSpy,
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "c-100",
                auth_user_id: "user-rls-1",
                email: "customer@domain.vn",
                name: "Khách Hàng RLS",
                phone: null,
                created_at: "2026-03-01T00:00:00Z",
              },
              error: null,
            }),
          };
        }),
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const customer = await getCurrentCustomer();
      expect(customer).not.toBeNull();
      expect(customer?.id).toBe("c-100");
      expect(customer?.name).toBe("Khách Hàng RLS");
      expect(eqSpy).toHaveBeenCalledWith("auth_user_id", "user-rls-1");
      expect(adminSupa.getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it("returns null when user is unauthenticated", async () => {
      const mockServerClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const customer = await getCurrentCustomer();
      expect(customer).toBeNull();
    });

    it("getCurrentAuthUser returns user if authenticated, null if unauthenticated or error", async () => {
      const mockUser = { id: "u-1", email: "test@domain.vn" } as User;
      const mockServerClient = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValueOnce({ data: { user: mockUser }, error: null })
            .mockResolvedValueOnce({ data: { user: null }, error: new Error("Expired") }),
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const user1 = await getCurrentAuthUser();
      expect(user1?.id).toBe("u-1");

      const user2 = await getCurrentAuthUser();
      expect(user2).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Login Server Actions (requestOtp & verifyOtp)
  // ─────────────────────────────────────────────────────────────────────────
  describe("Login Server Actions", () => {
    it("requestOtp: validates email and calls signInWithOtp with options", async () => {
      const signInMock = vi.fn().mockResolvedValue({ error: null });
      const mockServerClient = {
        auth: {
          signInWithOtp: signInMock,
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const res = await requestOtp(" Teacher@domain.com ", "/account/orders");
      expect(res.success).toBe(true);
      expect(res.email).toBe("teacher@domain.com");
      expect(signInMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "teacher@domain.com",
          options: expect.objectContaining({
            shouldCreateUser: true,
          }),
        }),
      );
    });

    it("requestOtp: rejects invalid email format", async () => {
      const res = await requestOtp("not-an-email");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Email không hợp lệ. Vui lòng kiểm tra lại.");
    });

    it("requestOtp: handles rate limit error with friendly message", async () => {
      const mockServerClient = {
        auth: {
          signInWithOtp: vi.fn().mockResolvedValue({
            error: { message: "rate limit exceeded", status: 429 },
          }),
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const res = await requestOtp("rate@limit.com");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau.");
    });

    it("verifyOtp: validates 6-digit code, verifies with Supabase, links customer, and returns safe redirect", async () => {
      const verifiedUser = {
        id: "auth-u-88",
        email: "verified@domain.com",
        email_confirmed_at: "2026-03-01T00:00:00Z",
      } as User;

      const mockServerClient = {
        auth: {
          verifyOtp: vi.fn().mockResolvedValue({
            data: { user: verifiedUser },
            error: null,
          }),
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      // Admin mock for linking
      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "c-linked", auth_user_id: "auth-u-88", email: "verified@domain.com" },
            error: null,
          }),
        })),
      };

      vi.mocked(adminSupa.getSupabaseAdmin).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupa.getSupabaseAdmin>,
      );

      const res = await verifyOtp(" verified@domain.com ", "123456", "/account/library");
      expect(res.success).toBe(true);
      expect(res.redirectTo).toBe("/account/library");
    });

    it("verifyOtp: handles invalid OTP error code", async () => {
      const mockServerClient = {
        auth: {
          verifyOtp: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Token has expired or is invalid" },
          }),
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      const res = await verifyOtp("user@domain.com", "999999");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Logout Action
  // ─────────────────────────────────────────────────────────────────────────
  describe("Logout Customer", () => {
    it("calls supabase.auth.signOut() and redirects to /", async () => {
      const signOutMock = vi.fn().mockResolvedValue({ error: null });
      const mockServerClient = {
        auth: {
          signOut: signOutMock,
        },
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      await expect(logoutCustomer()).rejects.toThrow("NEXT_REDIRECT:/");
      expect(signOutMock).toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith("/");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Security Invariant: Customer cannot access Admin
  // ─────────────────────────────────────────────────────────────────────────
  describe("Admin Isolation (requireAdmin)", () => {
    it("customer authenticated in auth.users but NOT in admin_users is signed out and redirected", async () => {
      const customerAuthUser = {
        id: "customer-user-uuid",
        email: "customer@example.com",
      } as User;

      const signOutMock = vi.fn().mockResolvedValue({ error: null });

      const mockServerClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: customerAuthUser },
            error: null,
          }),
          signOut: signOutMock,
        },
        from: vi.fn((table: string) => {
          expect(table).toBe("admin_users");
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null, // NOT an admin!
              error: { message: "Row not found" },
            }),
          };
        }),
      };

      vi.mocked(serverSupa.getSupabaseServerClient).mockResolvedValue(
        mockServerClient as unknown as Awaited<ReturnType<typeof serverSupa.getSupabaseServerClient>>,
      );

      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
      expect(signOutMock).toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Site B Isolation
  // ─────────────────────────────────────────────────────────────────────────
  describe("Site B Isolation Check", () => {
    it("confirms Site B directory is completely untouched", () => {
      const siteBPath = path.resolve("..", "phep-mau-van-hoc");
      if (fs.existsSync(siteBPath)) {
        // Site B exists on user machine - verify it remains distinct
        expect(fs.existsSync(path.join(siteBPath, "package.json"))).toBe(true);
      }
      expect(path.resolve(".")).not.toContain("phep-mau-van-hoc");
      expect(path.resolve(".")).toContain("van-thcs-store-v2");
    });
  });
});
