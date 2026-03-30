# User Guide (V1)

This guide explains how to start safely with CryptoSparrow V1.

## 1. Onboarding
1. Create account and verify login.
2. Connect exchange API key in `Dashboard -> Exchanges`.
3. Build or import a strategy in `Dashboard -> Strategies`.
4. If possible, run a backtest before live activity.
5. New bots start in `PAPER` by default; optionally switch to `LIVE` after accepting risk consent.

## 2. Safety-First Rules
- Starting in `PAPER` first is strongly recommended before `LIVE`.
- Use small size and strict `maxOpenPositions` at first.
- Keep `liveOptIn` explicit and review consent text every update.
- Monitor logs and alerts before and during live sessions.
- Use emergency stop/kill switch immediately if behavior is unexpected.

## 3. Recommended First Session
1. Create one strategy for a single symbol/timeframe.
2. Run backtest and inspect report metrics.
3. Enable bot in `PAPER` mode only.
4. Observe at least one full market cycle.
5. Move to `LIVE` only after stable paper behavior.
- This is a starter flow; production setups can use multiple symbol groups and multiple BotStrategy bindings per bot.

## 3a. Backtest Report Reading (Run Header + Tabs)
- Run header shows:
  - run name and status,
  - market group + strategy context,
  - start/end calculation timestamps,
  - KPI strip (`Trades`, `Net PnL`, `Win rate`, `Max drawdown`),
  - compact stage timeline (created -> engine -> trades -> report -> finished).
- Progress bar is visible only for active runs (`0 < progress < 100`).
- Tabs:
  - `Summary`: daily PnL bars + portfolio balance trend from initial to end balance.
  - `Markets`: per-symbol timeline and pair stats.
  - `Trades`: chronological trade table with capital context.
  - `Raw`: debug payload preview.

## 3b. Markets Tab (Per-Symbol Timeline)
- Each symbol card contains:
  - price panel (candles, entries/exits, DCA markers, non-overlapping position ranges),
  - oscillator panel (for example RSI),
  - synchronized right Y-axis overlays and shared bottom X-axis.
- Pair stats card contains:
  - `Trades` in visible range / total,
  - `Win rate`, `PnL`, `Avg hold`,
  - execution stats (`avg entry`, `avg exit`, `DCA`, `closed on last candle`, `liquidations`),
  - data range (`trades range`, `candles range`, `chart min/max`),
  - strategy indicators used for this run.
- For large runs, timelines load progressively in chunks; failed parity symbols show an inline error state instead of forcing timeline fetch.

## 3c. Trades Tab
- Table is ordered by close time and includes:
  - side, open/close timestamps, duration, qty, DCA count,
  - entry/exit prices,
  - `Notional` and `Margin` for entry/exit,
  - move percent (side-aware), PnL percent (notional + margin), fee,
  - exit reason and cumulative PnL.
- Top metrics summarize:
  - net PnL,
  - gross profit / gross loss,
  - largest win / largest loss.

## 4. FAQ
### Why do I need Docker locally?
The default local stack uses Docker for Postgres and Redis required by backend services.

### Why is LIVE blocked?
Most common reasons:
- `liveOptIn` is not enabled,
- `consentTextVersion` is missing,
- global kill switch is active.

`PAPER` mode does not require live-risk consent.

### Why do I see delayed updates?
Check worker health/readiness and queue lag metrics. High lag can delay signal/order processing.

### Can I import strategies from another environment?
Yes. Use strategy import/export package format `strategy.v1`.

## 5. Troubleshooting
- App does not open:
  - verify client dev server is running (`pnpm --filter web dev`).
- API errors in dashboard:
  - verify backend (`pnpm --filter api dev`) and `NEXT_PUBLIC_API_BASE_URL`.
- `EADDRINUSE` on startup:
  - another process already uses the port; stop it or change port.
- Exchange order issues:
  - check API key status, rate limits, and `/alerts` output.
- Local test failures with DB errors:
  - ensure Docker Desktop is running and `docker compose up -d` is active.

## 6. What To Prepare Before LIVE
- Backtest evidence for current market regime.
- Paper-trade validation for operational behavior.
- Defined daily loss and stop conditions.
- Operator on-call and rollback plan available.

## 6a. Scan Cadence
- Market scan and position-management scan use separate cadence settings.
- Cadence is selected from predefined options list (no free numeric value input).
- Interval lists are intentionally limited to protect platform performance.
- Available cadence options depend on subscription plan (higher plans unlock faster intervals).
- Global V1 interval list shared across scans and indicator/timeframe selections: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `8h`, `12h`, `1d`, `1w`, `1M` (minimum `1m`).
- Default V1 cadence:
  - `free`: market `5m`, positions `5m`.
  - `simple`: market `1h`, positions `1h`.
  - `advanced`: market `1m`, positions `1m`.
- In `free`, allowed options are `5m` (default) and `15m`.
- Cadence dropdown uses one common interval list across plans; options outside current entitlement are shown as disabled.
- In `free`, only `5m` and `15m` are selectable per scan type.
- `simple` can choose: `1m`, `5m`, `15m`, `30m`, `1h`.
- `advanced` can choose: full global interval list.

## 7. Subscription and Renewal Safety (Post-MVP / V1.1 Planned)
- Scope note: this section describes planned admin/billing behavior and is not enabled in the current V1 runtime release.
- Monthly subscription auto-renews by default (you can disable auto-renew in account settings).
- Subscription checkout is available only for logged-in users in their own account (no guest checkout in V1).
- One account can hold one active subscription at a time.
- Bot limits are evaluated separately for `PAPER` and `LIVE` mode pools.
- When mode pool limit is reached, creating new bots (including drafts) is blocked; existing inactive bots remain editable/deletable.
- `Create bot` button stays visible as disabled and shows tooltip with upgrade hint.
- In `free`, seed bot limits are `LIVE=0` and `PAPER=1`, and both are adjustable by admin.
- In `simple`, seed bot limits are `LIVE=1` and `PAPER=1`, and both are adjustable by admin.
- In `advanced`, seed bot limits are `LIVE=3` and `PAPER=3`, and both are adjustable by admin.
- Admin may manually assign plan tier and duration window for selected accounts (for example internal/promotional access outside normal checkout).
- Admin manual grant can start immediately or be scheduled to start at a future date/time.
- At scheduled grant start time, grant plan becomes active and temporarily overrides current plan until grant expiry.
- Admin manual grants are non-renewing by default (`auto-renew OFF`).
- After manual grant expires, account returns to the plan state from before the grant period.
- If previous plan was paid, the original renewal date remains unchanged after grant expiry.
- In account panel, you always see one primary active plan; when grant is active, it appears as extra informational note.
- Grant info is always shown in subscription panel; some dashboard views may also show compact grant badge when there is enough space.
- Active admin grant cannot be cancelled early by user in V1; it expires only at configured end date/time.
- Admin/support may terminate active grant earlier in justified cases (for example abuse or policy violation).
- When admin terminates grant early, reason is mandatory and saved in audit history.
- Reason description must be 10-500 characters.
- Reason category and reason description in admin action flow are English-only in V1.
- If admin terminates grant early, user receives email notification with reason category, reason description, and end time.
- Reason category is selected from predefined list in admin panel.
- Category list is stable by default; admin can add new categories when necessary.
- Newly added categories are active immediately and can be used right away.
- Category removal is soft-delete: category disappears from new selections, but existing audit entries keep historical category data.
- Soft-deleted category can be restored by admin from category management.
- Restored category is visible and usable immediately in all admin forms.
- Plan upgrade effects are applied immediately after successful payment; you do not need to log out and log in again.
- If plan-upgrade payment fails, your current plan and limits stay exactly as before.
- For abuse protection, after 3 failed payment attempts in a row, next checkout attempt is delayed by a temporary cooldown (about 15 minutes).
- Abuse-protection limits are evaluated using account + IP context in V1 where available.
- Similar temporary lock/cooldown protection also applies to repeated failed logins and repeated unauthorized/forbidden high-risk requests.
- Failed-login lockout escalates on both account and IP:
  - 3 failed attempts: 5-minute lock.
  - 5 failed attempts: 15-minute lock.
  - 10 failed attempts: 4-hour lock.
- At first lock event, user receives security email with current lock info and warning about stronger lock durations for repeated failures.
- Locked users may use recovery form with control questions generated from account data; successful verification unlocks access automatically.
- In exceptional cases, support/admin can manually remove lock and restore account access.
- After each successful payment, invoice/receipt document is generated automatically, available to download from your account panel, and a confirmation email is sent.
- In V1, payment documents are issued in English.
- If you update billing profile data, changes affect only future payment documents; already issued documents are not modified.
- Billing profile is not required during account registration.
- Billing profile is required when you start first payment; you can also fill it earlier in account settings.
- If billing profile is missing, app asks for it in payment flow only (no recurring reminders outside checkout context).
- If payment flow is interrupted because billing profile is incomplete, after saving profile data app returns you to the same checkout context.
- Billing profile forms in V1 validate only general required fields and format rules before saving (for example email format, country, postal-code shape, field lengths).
- Country-specific tax-ID/VAT validation is not enforced in V1.
- Billing identity data is entered on user declaration; app validates completeness/format, not factual identity truth.
- Renewal reminders are sent before billing date; additional reminders are sent when payment fails.
- If plan expires unpaid, paid runtime features are not served (no automated bot decisions and no app-managed LIVE open/close actions).
- If plan expires unpaid, bot runtime switch is set to `OFF`.
- After payment return, turn bots back `ON` manually (no automatic resume).
- After successful payment return, you receive one reminder notification to re-enable bots manually (if any remained `OFF` after expiry).
- `PAST_DUE` account can still access history and settings pages.
- Information about lost subscription is shown in one central notification flow; UI avoids repeating the same warning in many places.
- Expiry notice is sent once at about 1 minute after subscription expiry.
- Disabled LIVE controls may show a short helper note with resume hint.
- Historical data remains available for user records and local tax/accounting workflows (for example PIT preparation or private spreadsheets).
- CSV export max range depends on plan:
  - `free`: up to last 3 months.
  - `simple`: up to last 6 months.
  - `advanced`: up to last 12 months.
- CSV export in both active and `PAST_DUE` states follows the same rate limit: max 1 export per 10 minutes per user.

