# AI Integration

## Current State
- AI support is currently partial and workflow-oriented (strategy assistance + planned runtime intelligence expansion).
- Core runtime architecture already includes foundations required by AI layers (signals, risk checks, execution orchestration, event/audit traces).
- Full autonomous-agent behavior is not complete yet and remains on phased delivery path.

## Principles
- Safety before autonomy.
- Explainable decisions with traceable rationale and context.
- User control over autonomy level (assistant -> semi-auto -> autonomous under mandate).
- Personalization by user profile, not one-size-fits-all behavior.
- Aggregated learning from platform patterns, without copying individual users.
- No guarantee claims; optimization target is risk-adjusted decision quality.

## Target Scope
- Strategy generation and optimization suggestions.
- Regime-aware strategy selection support.
- Multi-timeframe market summaries and signal confidence hints.
- Risk-aware sizing and lifecycle recommendations (entry/exit/SL/TP/DCA/trailing).
- Post-trade attribution and improvement guidance.
- Optional autonomous execution under explicit user mandate and hard guardrails.

## AI Runtime Model (Target)
1. Data and feature layer:
- candles, funding/open interest/order book, optional external context inputs.
2. Analysis layer:
- indicators, feature extraction, regime classification, confidence scoring.
3. Decision layer:
- strategy/policy selection under user risk profile and account constraints.
4. Execution layer:
- shared execution core used across backtest/paper/live adapters.
5. Learning layer:
- decision-outcome loop for continuous policy improvement.

## Assistant Topology (Planned)
- User `1 -> N` AI assistants.
- Assistants are user-isolated and do not share private context across users.
- Assistant scope can target selected bots, symbol groups, or BotStrategy bindings.
- Runtime orchestrator model target: `1` main assistant + up to `4` subagents per bot context.

## Learning and Privacy Contract
- System learns from aggregated effectiveness signals across users.
- Per-user private history remains isolated as user-specific context.
- No raw behavior cloning from one account to another.
- Any cross-user intelligence should be statistical/aggregated and audit-safe.

## Delivery Phases
1. AI assistant:
- suggest strategy parameters and explain why.
2. Semi-automation:
- constrained execution with user approvals or strict pre-authorized rules.
3. Autonomous mandate:
- full execution within explicit risk/autonomy contract.
4. Network intelligence:
- platform-wide aggregated learning improves global baseline models.
