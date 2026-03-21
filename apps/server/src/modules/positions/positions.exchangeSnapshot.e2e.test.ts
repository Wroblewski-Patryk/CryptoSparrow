import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../index";
import { prisma } from "../../prisma/client";

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post("/auth/register").send({
    email,
    password: "test1234",
  });
  expect(res.status).toBe(201);
  return agent;
};

describe("Positions exchange snapshot API", () => {
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

  it("requires authentication", async () => {
    const res = await request(app).get("/dashboard/positions/exchange-snapshot");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Missing token");
  });

  it("returns 400 when user has no configured Binance key", async () => {
    const agent = await registerAndLogin("positions-no-key@example.com");
    const res = await agent.get("/dashboard/positions/exchange-snapshot");

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("No Binance API key configured.");
  });

  it("returns normalized exchange snapshot for authenticated user with key", async () => {
    const agent = await registerAndLogin("positions-key@example.com");
    const createRes = await agent.post("/dashboard/profile/apiKeys").send({
      label: "main",
      exchange: "BINANCE",
      apiKey: "EXCHANGEKEY12345",
      apiSecret: "EXCHANGESECRET12345",
    });
    expect(createRes.status).toBe(201);
    const keyId = createRes.body.id as string;

    const snapshotRes = await agent.get("/dashboard/positions/exchange-snapshot");
    expect(snapshotRes.status).toBe(200);
    expect(snapshotRes.body.source).toBe("BINANCE");
    expect(typeof snapshotRes.body.syncedAt).toBe("string");
    expect(Array.isArray(snapshotRes.body.positions)).toBe(true);
    expect(snapshotRes.body.positions[0]).toMatchObject({
      symbol: "BTC/USDT:USDT",
      side: "long",
      contracts: 0.01,
    });

    const dbKey = await prisma.apiKey.findUniqueOrThrow({
      where: { id: keyId },
    });
    expect(dbKey.lastUsed).not.toBeNull();
  });
});
