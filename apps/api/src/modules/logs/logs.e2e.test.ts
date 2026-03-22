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

describe("Logs API contract", () => {
  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/dashboard/logs");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Missing token");
  });

  it("lists only owner logs and supports source/actor/severity filtering", async () => {
    const ownerAgent = await registerAndLogin("logs-owner@example.com");
    await registerAndLogin("logs-other@example.com");

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: "logs-owner@example.com" },
    });
    const other = await prisma.user.findUniqueOrThrow({
      where: { email: "logs-other@example.com" },
    });

    await prisma.log.createMany({
      data: [
        {
          userId: owner.id,
          source: "engine.pre-trade",
          action: "trade.precheck.allowed",
          level: "INFO",
          actor: "bot-runner",
          message: "Allowed",
          category: "TRADING_DECISION",
        },
        {
          userId: owner.id,
          source: "engine.pre-trade",
          action: "trade.precheck.blocked",
          level: "WARN",
          actor: "bot-runner",
          message: "Blocked",
          category: "TRADING_DECISION",
        },
        {
          userId: owner.id,
          source: "bots.service",
          action: "bot.live_consent.accepted",
          level: "INFO",
          actor: "dashboard-user",
          message: "Consent accepted",
          category: "RISK_CONSENT",
        },
        {
          userId: other.id,
          source: "engine.pre-trade",
          action: "trade.precheck.blocked",
          level: "ERROR",
          actor: "other-user",
          message: "Other tenant",
          category: "TRADING_DECISION",
        },
      ],
    });

    const allRes = await ownerAgent.get("/dashboard/logs");
    expect(allRes.status).toBe(200);
    expect(allRes.body).toHaveLength(3);

    const sourceRes = await ownerAgent.get("/dashboard/logs").query({ source: "bots.service" });
    expect(sourceRes.status).toBe(200);
    expect(sourceRes.body).toHaveLength(1);
    expect(sourceRes.body[0].source).toBe("bots.service");

    const actorRes = await ownerAgent.get("/dashboard/logs").query({ actor: "bot-runner" });
    expect(actorRes.status).toBe(200);
    expect(actorRes.body).toHaveLength(2);

    const severityRes = await ownerAgent.get("/dashboard/logs").query({ severity: "WARN" });
    expect(severityRes.status).toBe(200);
    expect(severityRes.body).toHaveLength(1);
    expect(severityRes.body[0].level).toBe("WARN");
  });
});
