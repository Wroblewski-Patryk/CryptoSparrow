# Autonomous Agent Vision (North Star)

## Product Goal
CryptoSparrow is built to evolve into an autonomous trading-agent platform that can analyze, test, decide, execute, and improve over time, while remaining constrained by user-defined risk and autonomy boundaries.

The product goal is not "profit at any cost".  
The product goal is long-term improvement of risk-adjusted decision quality and execution consistency.

## One-Sentence Definition
CryptoSparrow is an AI trading SaaS where users configure risk profile and autonomy level, and the platform runs an agentic trading system that continuously learns from market data, its own outcomes, and aggregated platform-wide effectiveness patterns.

## Core Product Principles
- Safety before autonomy.
- Risk-adjusted performance over raw return claims.
- Explainability and auditability of decisions.
- Personalization per user profile.
- Shared intelligence from aggregated patterns, never raw copy of individual behavior.
- Ability to explicitly decide not to trade when edge is weak.

## Target Agent Capabilities
- 24/7 market observation and regime recognition.
- Strategy selection and parameter adaptation.
- Entry/exit/risk lifecycle execution.
- Position management (DCA, TP, SL, trailing) with strict guardrails.
- Continuous post-trade learning loop.
- User-specific behavior based on profile and permissions.

## Intelligence Model
CryptoSparrow should combine:

1. Global intelligence layer:
- aggregated cross-user performance patterns,
- regime-to-strategy effectiveness,
- reusable meta-knowledge about what worked, when, and why.

2. User-private execution layer:
- user risk profile and objectives,
- user-level constraints and permissions,
- user account history and personalized adaptation.

This model means "learn from aggregated outcomes", not "copy users".

## Multi-Layer System Model
- Data layer: market, funding, open interest, order-book depth, optional on-chain/news/sentiment.
- Analysis layer: indicators, feature extraction, regime detection, probability scoring.
- Strategy layer: reusable strategy families and templates.
- Decision layer: meta-agent selecting action under constraints.
- Risk layer: hard limits, exposure controls, drawdown and cooldown rules.
- Learning layer: outcome attribution, replay, evaluation, model/policy updates.

## Autonomy Ladder (Delivery Direction)
1. Analytics tool: build and validate strategies.
2. Intelligent assistant: AI recommends actions with rationale.
3. Semi-autonomous executor: user-approved execution and constrained automation.
4. Autonomous executor: agent executes within explicit mandate.
5. Network intelligence: aggregated learning improves baseline models globally.

## Non-Negotiable Runtime Rules
- No automatic flip on an occupied symbol (no `LONG -> SHORT` while position is open).
- Manual-managed external positions are ignored by bot entry rules unless explicitly switched to bot-managed.
- Backtest and paper must converge toward live-equivalent logic through a shared execution core.
- LIVE mode must represent real exchange side effects.

## Decision Quality Loop
Each decision should be traceable through:
- observed context,
- predicted edge,
- selected action,
- realized outcome,
- attribution and improvement notes.

This loop is required for both operator trust and future model improvement.

## Positioning Statement (External-Friendly)
CryptoSparrow is "AI Trader as a Service": an adaptive trading agent platform focused on disciplined execution, risk-first automation, and continuous improvement of decision quality.

