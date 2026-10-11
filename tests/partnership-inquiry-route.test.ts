import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, listMock, sessionMock, sendEmailMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  listMock: vi.fn(),
  sessionMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { partnershipInquiry: { create: createMock, findMany: listMock } },
}));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));
vi.mock("@/lib/auth/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/services/notification-email", () => ({ sendNotificationEmail: sendEmailMock }));

import { GET, POST } from "@/app/api/partnerships/inquiries/route";
import { InMemoryRateLimitStore, setRateLimitStore } from "@/lib/http/rate-limit";

const valid = {
  partnerType: "PROFESSIONAL_SERVICES",
  contactName: "Ada Obi",
  email: "Ada@Example.com",
  organisationName: "Obi & Co",
  websiteUrl: "https://example.com",
  country: "Nigeria",
  message: "We would like to discuss reviewing formation workflows.",
  consent: true,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(new Request("http://localhost/api/partnerships/inquiries", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PARTNERSHIP_INQUIRY_NOTIFY_EMAIL;
  setRateLimitStore(new InMemoryRateLimitStore());
  createMock.mockResolvedValue({ id: "inq-1", partnerType: "PROFESSIONAL_SERVICES", organisationName: "Obi & Co", createdAt: new Date() });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("partnership inquiry submission", () => {
  it("stores a valid inquiry, normalises the email and returns only the id", async () => {
    const response = await post(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: "inq-1" } });
    const data = createMock.mock.calls[0][0].data;
    expect(data.email).toBe("ada@example.com");
    expect(data).not.toHaveProperty("consent");
    expect(data.consentAcceptedAt).toBeInstanceOf(Date);
  });

  it("accepts blank optional fields", async () => {
    const response = await post({ ...valid, websiteUrl: "", country: "  " });
    expect(response.status).toBe(201);
    expect(createMock.mock.calls[0][0].data.websiteUrl).toBeUndefined();
    expect(createMock.mock.calls[0][0].data.country).toBeUndefined();
  });

  it("rejects missing required fields", async () => {
    const response = await post({ partnerType: "PROFESSIONAL_SERVICES" });
    expect(response.status).toBe(422);
    const { issues } = await response.json();
    expect(Object.keys(issues)).toEqual(expect.arrayContaining(["contactName", "email", "organisationName", "message", "consent"]));
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const response = await post({ ...valid, email: "not-an-email" });
    expect(response.status).toBe(422);
    expect((await response.json()).issues.email).toBeDefined();
  });

  it.each(["not a url", "javascript:alert(1)", "ftp://example.com", "https://user:pw@example.com"])(
    "rejects invalid website %s",
    async (websiteUrl) => {
      const response = await post({ ...valid, websiteUrl });
      expect(response.status).toBe(422);
      expect((await response.json()).issues.websiteUrl).toBeDefined();
    },
  );

  it("rejects an oversized message", async () => {
    const response = await post({ ...valid, message: "x".repeat(4001) });
    expect(response.status).toBe(422);
    expect((await response.json()).issues.message).toBeDefined();
  });

  it("rejects an unsupported partner type", async () => {
    const response = await post({ ...valid, partnerType: "GOVERNMENT_REGULATOR" });
    expect(response.status).toBe(422);
    expect((await response.json()).issues.partnerType).toBeDefined();
  });

  it("rejects a filled honeypot and unknown fields", async () => {
    expect((await post({ ...valid, hp: "bot" })).status).toBe(422);
    expect((await post({ ...valid, status: "CLOSED" })).status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and cross-origin requests", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post(valid, { origin: "https://evil.example" })).status).toBe(403);
  });

  it("rate limits repeated submissions from one client", async () => {
    for (let i = 0; i < 5; i += 1) expect((await post(valid, { "x-forwarded-for": "203.0.113.9" })).status).toBe(201);
    const limited = await post(valid, { "x-forwarded-for": "203.0.113.9" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect((await post(valid, { "x-forwarded-for": "203.0.113.10" })).status).toBe(201);
  });

  it("returns a generic error on database failure without leaking details or content", async () => {
    createMock.mockRejectedValue(new Error("connection refused at db.internal:5432"));
    const response = await post(valid);
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("db.internal");
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain(valid.message);
  });

  it("still succeeds when the notification email fails", async () => {
    process.env.PARTNERSHIP_INQUIRY_NOTIFY_EMAIL = "team@example.com";
    sendEmailMock.mockRejectedValue(new Error("smtp down"));
    const response = await post(valid);
    expect(response.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].body).not.toContain(valid.message);
  });

  it("does not attempt email when no recipient is configured", async () => {
    expect((await post(valid)).status).toBe(201);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("private inquiry access", () => {
  it("requires authentication", async () => {
    sessionMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("rejects authenticated users who are not platform administrators", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1", isSuperAdmin: false } });
    expect((await GET()).status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("lists inquiries for platform administrators", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1", isSuperAdmin: true } });
    listMock.mockResolvedValue([{ id: "inq-1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "inq-1" }] });
  });
});
