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
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.log.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/dashboard/profile/apiKeys");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Missing token");
  });

  it("requires auth for api key connection test endpoint", async () => {
    const res = await request(app).post("/dashboard/profile/apiKeys/test").send({
      exchange: "BINANCE",
      apiKey: "PUBLICKEY12345",
      apiSecret: "SECRETKEY12345",
    });

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
    expect(dbRecord.apiKey).toContain("gcm");
    expect(dbRecord.apiSecret).toContain("gcm");

    const listRes = await agent.get("/dashboard/profile/apiKeys");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].apiSecret).toBeUndefined();
    expect(listRes.body[0].apiKey).toContain("********");
    expect(listRes.body[0].apiKey).not.toBe(payload.apiKey);
  });

  it("enforces ownership on update and delete", async () => {
    const owner = await registerAndLogin("apikey-owner@example.com");
    const other = await registerAndLogin("apikey-other@example.com");

    const createRes = await owner.post("/dashboard/profile/apiKeys").send({
      label: "owner-key",
      exchange: "BINANCE",
      apiKey: "OWNERAPIKEY1234",
      apiSecret: "OWNERSECRET1234",
    });
    expect(createRes.status).toBe(201);
    const keyId = createRes.body.id as string;

    const updateRes = await other.patch(`/dashboard/profile/apiKeys/${keyId}`).send({
      label: "hijacked",
    });
    expect(updateRes.status).toBe(404);
    expect(updateRes.body.error.message).toBe("Not found");

    const deleteRes = await other.delete(`/dashboard/profile/apiKeys/${keyId}`);
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error.message).toBe("Not found");
  });

  it("supports rotate and revoke lifecycle actions for owner", async () => {
    const agent = await registerAndLogin("apikey-rotate-owner@example.com");

    const createRes = await agent.post("/dashboard/profile/apiKeys").send({
      label: "rotate-key",
      exchange: "BINANCE",
      apiKey: "ROTATEKEY1111",
      apiSecret: "ROTATESECRET1111",
    });
    expect(createRes.status).toBe(201);
    const keyId = createRes.body.id as string;

    const rotateRes = await agent.post(`/dashboard/profile/apiKeys/${keyId}/rotate`).send({
      apiKey: "ROTATEKEY2222",
      apiSecret: "ROTATESECRET2222",
    });
    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.id).toBe(keyId);
    expect(rotateRes.body.apiSecret).toBeUndefined();
    expect(rotateRes.body.apiKey).toContain("********");

    const revokeRes = await agent.post(`/dashboard/profile/apiKeys/${keyId}/revoke`);
    expect(revokeRes.status).toBe(204);

    const listRes = await agent.get("/dashboard/profile/apiKeys");
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(0);
  });

  it("tests key connection without persisting secrets", async () => {
    const agent = await registerAndLogin("apikey-test-connection@example.com");
    const testPayload = {
      exchange: "BINANCE",
      apiKey: "TESTCONNECTIONKEY123",
      apiSecret: "TESTCONNECTIONSECRET123",
    };

    const testRes = await agent.post("/dashboard/profile/apiKeys/test").send(testPayload);

    expect(testRes.status).toBe(200);
    expect(testRes.body).toEqual({
      ok: true,
      message: "Connection test request accepted.",
    });

    const dbKeys = await prisma.apiKey.findMany();
    expect(dbKeys).toHaveLength(0);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "apikey-test-connection@example.com" },
    });
    const log = await prisma.log.findFirst({
      where: {
        userId: user.id,
        action: "profile.api_key.test_connection",
      },
      orderBy: { occurredAt: "desc" },
    });

    expect(log).toBeTruthy();
    expect(log?.message).toBe("API key connection test accepted.");
    expect(log?.metadata).toEqual({
      exchange: "BINANCE",
      ok: true,
    });
    expect(JSON.stringify(log?.metadata)).not.toContain(testPayload.apiKey);
    expect(JSON.stringify(log?.metadata)).not.toContain(testPayload.apiSecret);
  });

  it("enforces ownership on rotate and revoke actions", async () => {
    const owner = await registerAndLogin("apikey-rotate-owner-2@example.com");
    const other = await registerAndLogin("apikey-rotate-other@example.com");

    const createRes = await owner.post("/dashboard/profile/apiKeys").send({
      label: "owner-rotate-key",
      exchange: "BINANCE",
      apiKey: "OWNERROTATEKEY1",
      apiSecret: "OWNERROTATESECRET1",
    });
    expect(createRes.status).toBe(201);
    const keyId = createRes.body.id as string;

    const rotateRes = await other.post(`/dashboard/profile/apiKeys/${keyId}/rotate`).send({
      apiKey: "HIJACKROTATEKEY",
      apiSecret: "HIJACKROTATESECRET",
    });
    expect(rotateRes.status).toBe(404);
    expect(rotateRes.body.error.message).toBe("Not found");

    const revokeRes = await other.post(`/dashboard/profile/apiKeys/${keyId}/revoke`);
    expect(revokeRes.status).toBe(404);
    expect(revokeRes.body.error.message).toBe("Not found");
  });
});
