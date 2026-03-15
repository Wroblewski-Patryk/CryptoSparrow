import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../index";
import { prisma } from "../../../prisma/client";

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post("/auth/register").send({
    email,
    password: "test1234",
  });
  expect(res.status).toBe(201);
  return agent;
};

describe("API Keys security contract", () => {
  beforeEach(async () => {
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/dashboard/profile/apiKeys");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Missing token");
  });

  it("stores encrypted-only values and returns masked apiKey", async () => {
    const agent = await registerAndLogin("apikey-security@example.com");
    const payload = {
      label: "main",
      exchange: "BINANCE",
      apiKey: "ABCD1234EFGH5678",
      apiSecret: "SECRET1234VALUE5678",
    };

    const createRes = await agent.post("/dashboard/profile/apiKeys").send(payload);
    expect(createRes.status).toBe(201);
    expect(createRes.body.apiSecret).toBeUndefined();
    expect(createRes.body.apiKey).toContain("********");
    expect(createRes.body.apiKey).not.toBe(payload.apiKey);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "apikey-security@example.com" },
    });
    const dbRecord = await prisma.apiKey.findFirstOrThrow({
      where: { userId: user.id, label: "main" },
    });

    expect(dbRecord.apiKey).not.toBe(payload.apiKey);
    expect(dbRecord.apiSecret).not.toBe(payload.apiSecret);
    expect(dbRecord.apiKey).toContain(":");
    expect(dbRecord.apiSecret).toContain(":");

    const listRes = await agent.get("/dashboard/profile/apiKeys");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].apiSecret).toBeUndefined();
    expect(listRes.body[0].apiKey).toContain("********");
    expect(listRes.body[0].apiKey).not.toBe(payload.apiKey);
  });
});
