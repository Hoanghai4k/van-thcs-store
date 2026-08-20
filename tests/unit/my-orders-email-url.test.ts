import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendMyOrdersAccessEmail } from "@/features/emails/service";
import * as resendProvider from "@/features/emails/resend-provider";

vi.mock("@/features/emails/resend-provider", () => ({
  getEmailProvider: vi.fn(),
}));

describe("My Orders Magic Link URL Generation", () => {
  const mockSendEmail = vi.fn().mockResolvedValue({ success: true, messageId: "msg-123" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Mock the email provider to capture the HTML output
    vi.mocked(resendProvider.getEmailProvider).mockReturnValue({
      sendEmail: mockSendEmail,
    } as unknown as ReturnType<typeof resendProvider.getEmailProvider>);

    // Default environment state
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use SITE_URL when present (Production configuration)", async () => {
    process.env.SITE_URL = "https://www.tailieuhangcao.vn";
    
    await sendMyOrdersAccessEmail("user@example.com", "fake-token");
    
    const callArgs = mockSendEmail.mock.calls[0][0];
    expect(callArgs.html).toContain("https://www.tailieuhangcao.vn/orders/verify?token=fake-token");
    expect(callArgs.html).not.toContain("localhost");
  });

  it("should use VERCEL_URL as fallback when SITE_URL is absent (Preview environment)", async () => {
    process.env.VERCEL_URL = "van-thcs-store-preview.vercel.app";
    
    await sendMyOrdersAccessEmail("user@example.com", "fake-token");
    
    const callArgs = mockSendEmail.mock.calls[0][0];
    expect(callArgs.html).toContain("https://van-thcs-store-preview.vercel.app/orders/verify?token=fake-token");
    expect(callArgs.html).not.toContain("localhost");
  });

  it("should use NEXT_PUBLIC_SITE_URL as legacy fallback", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://legacy.domain.com";
    
    await sendMyOrdersAccessEmail("user@example.com", "fake-token");
    
    const callArgs = mockSendEmail.mock.calls[0][0];
    expect(callArgs.html).toContain("https://legacy.domain.com/orders/verify?token=fake-token");
  });

  it("should use localhost as last resort (Local development)", async () => {
    // No URL env vars set
    
    await sendMyOrdersAccessEmail("user@example.com", "fake-token");
    
    const callArgs = mockSendEmail.mock.calls[0][0];
    expect(callArgs.html).toContain("http://localhost:3000/orders/verify?token=fake-token");
  });

  it("should strip trailing slashes from configured URLs", async () => {
    process.env.SITE_URL = "https://www.tailieuhangcao.vn/"; // trailing slash
    
    await sendMyOrdersAccessEmail("user@example.com", "fake-token");
    
    const callArgs = mockSendEmail.mock.calls[0][0];
    // Should NOT have double slash: .vn//orders
    expect(callArgs.html).toContain("https://www.tailieuhangcao.vn/orders/verify?token=fake-token");
  });
});
