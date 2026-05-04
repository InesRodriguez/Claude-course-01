import { vi, test, expect, beforeEach, describe } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-jwt-token"),
  })),
  jwtVerify: vi.fn(),
}));

import { createSession } from "@/lib/auth";

beforeEach(() => {
  mockCookieStore.set.mockReset();
});

describe("createSession", () => {
  test("signs a JWT and sets httpOnly cookie", async () => {
    await createSession("user-123", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "auth-token",
      "mock-jwt-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
  });

  test("sets cookie expiry ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-123", "user@example.com");
    const after = Date.now();

    const { expires } = mockCookieStore.set.mock.calls[0][2];
    const expiresMs = expires.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDays + 1000);
  });
});
