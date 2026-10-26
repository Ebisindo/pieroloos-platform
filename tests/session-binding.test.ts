import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getSessionBinding } from "@/lib/auth/session-binding";

describe("signed session binding", () => {
  beforeEach(() => { process.env.NEXTAUTH_SECRET = "test-session-secret"; });

  it("binds the same user and signed session cookie deterministically", () => {
    const request = new Request("https://app.example/api", {
      headers: { cookie: "__Secure-next-auth.session-token=abc123; theme=dark" },
    });
    const first = getSessionBinding(request, "user-1");
    const second = getSessionBinding(request, "user-1");
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it("changes with the cookie or local user", () => {
    const first = getSessionBinding(new Request("https://app.example", { headers: { cookie: "next-auth.session-token=token-a" } }), "user-1");
    const changedCookie = getSessionBinding(new Request("https://app.example", { headers: { cookie: "next-auth.session-token=token-b" } }), "user-1");
    const changedUser = getSessionBinding(new Request("https://app.example", { headers: { cookie: "next-auth.session-token=token-a" } }), "user-2");
    expect(first).not.toBe(changedCookie);
    expect(first).not.toBe(changedUser);
  });

  it("supports chunked NextAuth cookies and ignores unrelated cookies", () => {
    const request = new Request("https://app.example", {
      headers: { cookie: "a=b; next-auth.session-token.1=part2; next-auth.session-token.0=part1" },
    });
    expect(getSessionBinding(request, "user-1")).toBeTruthy();
  });

  it("fails closed without a signed session cookie or secret", () => {
    expect(getSessionBinding(new Request("https://app.example"), "user-1")).toBeNull();
    delete process.env.NEXTAUTH_SECRET;
    expect(getSessionBinding(new Request("https://app.example", { headers: { cookie: "next-auth.session-token=x" } }), "user-1")).toBeNull();
  });
});
