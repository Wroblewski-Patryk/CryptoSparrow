# L10NQ-D Full Web i18n Coverage Audit (2026-04-18)

## Scope
- Scanned files (app/features/ui/context): 187
- Route pages: 37
- Route-reachable files: 228

## Headline Metrics
- Files with hardcoded UI string candidates: 35
- Files with local in-file copy dictionaries: 11
- Files with locale fallback to `pl` (contract drift): 7
- Route-reachable files with any i18n finding: 42
- Actionable module-level finding files (excluding shared foundation): 29
- Shared foundation finding files: 13

## Top Actionable Module Findings
- apps/web/src/features/reports/components/PerformanceReportsView.tsx | score=25 | hardcoded=25 | localCopy=0 | fallbackPl=0 (sample L72: title="Ladowanie reports performance")
- apps/web/src/features/auth/hooks/useLoginForm.ts | score=11 | hardcoded=0 | localCopy=1 | fallbackPl=1
- apps/web/src/features/auth/hooks/useRegisterForm.ts | score=11 | hardcoded=0 | localCopy=1 | fallbackPl=1
- apps/web/src/features/markets/components/MarketUniverseForm.tsx | score=11 | hardcoded=0 | localCopy=1 | fallbackPl=1
- apps/web/src/features/backtest/components/BacktestRunDetails.tsx | score=8 | hardcoded=3 | localCopy=0 | fallbackPl=1 (sample L713: title="Oddal (wiecej swiec)")
- apps/web/src/features/admin/subscriptions/pages/AdminSubscriptionsPage.tsx | score=7 | hardcoded=1 | localCopy=1 | fallbackPl=0 (sample L409: close)
- apps/web/src/features/backtest/components/BacktestCreateForm.tsx | score=7 | hardcoded=2 | localCopy=0 | fallbackPl=1 (sample L336: placeholder="1200")
- apps/web/src/app/dashboard/reports/page.tsx | score=6 | hardcoded=0 | localCopy=1 | fallbackPl=0
- apps/web/src/features/admin/users/pages/AdminUsersPage.tsx | score=6 | hardcoded=0 | localCopy=1 | fallbackPl=0
- apps/web/src/features/auth/components/LoginForm.tsx | score=6 | hardcoded=0 | localCopy=1 | fallbackPl=0
- apps/web/src/features/auth/components/RegisterForm.tsx | score=6 | hardcoded=0 | localCopy=1 | fallbackPl=0
- apps/web/src/features/auth/pages/LoginPage.tsx | score=6 | hardcoded=0 | localCopy=1 | fallbackPl=0
- apps/web/src/features/auth/pages/RegisterPage.tsx | score=6 | hardcoded=0 | localCopy=1 | fallbackPl=0
- apps/web/src/features/backtest/components/BacktestsListView.tsx | score=5 | hardcoded=0 | localCopy=0 | fallbackPl=1
- apps/web/src/features/backtest/components/BacktestsRunsTable.tsx | score=5 | hardcoded=0 | localCopy=0 | fallbackPl=1
- apps/web/src/app/admin/layout.tsx | score=4 | hardcoded=4 | localCopy=0 | fallbackPl=0 (sample L16: Subscriptions)
- apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx | score=4 | hardcoded=4 | localCopy=0 | fallbackPl=0 (sample L1202: placeholder="BTCUSDT")
- apps/web/src/features/bots/components/BotsManagement.tsx | score=3 | hardcoded=3 | localCopy=0 | fallbackPl=0 (sample L459: Wallet)
- apps/web/src/features/markets/components/SearchableMultiSelect.tsx | score=3 | hardcoded=3 | localCopy=0 | fallbackPl=0 (sample L72: placeholder="Szukaj...")
- apps/web/src/app/dashboard/bots/[id]/edit/page.tsx | score=2 | hardcoded=2 | localCopy=0 | fallbackPl=0 (sample L19: title="Bots")
- apps/web/src/app/dashboard/bots/create/page.tsx | score=2 | hardcoded=2 | localCopy=0 | fallbackPl=0 (sample L26: title="Bots")
- apps/web/src/app/offline/page.tsx | score=2 | hardcoded=2 | localCopy=0 | fallbackPl=0 (sample L5: Offline Mode)
- apps/web/src/features/profile/components/BasicForm.tsx | score=2 | hardcoded=2 | localCopy=0 | fallbackPl=0 (sample L156: placeholder="John Doe")
- apps/web/src/app/dashboard/bots/[id]/assistant/page.tsx | score=1 | hardcoded=1 | localCopy=0 | fallbackPl=0 (sample L17: title="Bots")
- apps/web/src/app/dashboard/bots/[id]/preview/page.tsx | score=1 | hardcoded=1 | localCopy=0 | fallbackPl=0 (sample L17: title="Bots")

## Top Route Impact (Module-Level)
- apps/web/src/app/dashboard/reports/page.tsx | moduleIssueFiles=2 | moduleScore=31 | top: apps/web/src/features/reports/components/PerformanceReportsView.tsx [25]; apps/web/src/app/dashboard/reports/page.tsx [6]
- apps/web/src/app/(public)/auth/login/page.tsx | moduleIssueFiles=3 | moduleScore=23 | top: apps/web/src/features/auth/hooks/useLoginForm.ts [11]; apps/web/src/features/auth/components/LoginForm.tsx [6]; apps/web/src/features/auth/pages/LoginPage.tsx [6]
- apps/web/src/app/(public)/auth/register/page.tsx | moduleIssueFiles=3 | moduleScore=23 | top: apps/web/src/features/auth/hooks/useRegisterForm.ts [11]; apps/web/src/features/auth/components/RegisterForm.tsx [6]; apps/web/src/features/auth/pages/RegisterPage.tsx [6]
- apps/web/src/app/dashboard/markets/[id]/edit/page.tsx | moduleIssueFiles=2 | moduleScore=14 | top: apps/web/src/features/markets/components/MarketUniverseForm.tsx [11]; apps/web/src/features/markets/components/SearchableMultiSelect.tsx [3]
- apps/web/src/app/dashboard/markets/create/page.tsx | moduleIssueFiles=2 | moduleScore=14 | top: apps/web/src/features/markets/components/MarketUniverseForm.tsx [11]; apps/web/src/features/markets/components/SearchableMultiSelect.tsx [3]
- apps/web/src/app/admin/subscriptions/page.tsx | moduleIssueFiles=2 | moduleScore=11 | top: apps/web/src/features/admin/subscriptions/pages/AdminSubscriptionsPage.tsx [7]; apps/web/src/app/admin/layout.tsx [4]
- apps/web/src/app/admin/users/page.tsx | moduleIssueFiles=2 | moduleScore=10 | top: apps/web/src/features/admin/users/pages/AdminUsersPage.tsx [6]; apps/web/src/app/admin/layout.tsx [4]
- apps/web/src/app/dashboard/backtests/list/page.tsx | moduleIssueFiles=2 | moduleScore=10 | top: apps/web/src/features/backtest/components/BacktestsListView.tsx [5]; apps/web/src/features/backtest/components/BacktestsRunsTable.tsx [5]
- apps/web/src/app/dashboard/backtests/[id]/page.tsx | moduleIssueFiles=1 | moduleScore=8 | top: apps/web/src/features/backtest/components/BacktestRunDetails.tsx [8]
- apps/web/src/app/dashboard/backtests/create/page.tsx | moduleIssueFiles=1 | moduleScore=7 | top: apps/web/src/features/backtest/components/BacktestCreateForm.tsx [7]
- apps/web/src/app/dashboard/bots/[id]/assistant/page.tsx | moduleIssueFiles=4 | moduleScore=6 | top: apps/web/src/features/bots/components/BotsManagement.tsx [3]; apps/web/src/app/dashboard/bots/[id]/assistant/page.tsx [1]; apps/web/src/features/bots/components/bots-management/BotsMonitoringTab.tsx [1]; apps/web/src/features/bots/hooks/useBotsListController.ts [1]
- apps/web/src/app/dashboard/bots/[id]/preview/page.tsx | moduleIssueFiles=4 | moduleScore=6 | top: apps/web/src/features/bots/components/BotsManagement.tsx [3]; apps/web/src/app/dashboard/bots/[id]/preview/page.tsx [1]; apps/web/src/features/bots/components/bots-management/BotsMonitoringTab.tsx [1]; apps/web/src/features/bots/hooks/useBotsListController.ts [1]
- apps/web/src/app/admin/page.tsx | moduleIssueFiles=1 | moduleScore=4 | top: apps/web/src/app/admin/layout.tsx [4]
- apps/web/src/app/dashboard/page.tsx | moduleIssueFiles=1 | moduleScore=4 | top: apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx [4]
- apps/web/src/app/dashboard/bots/[id]/edit/page.tsx | moduleIssueFiles=2 | moduleScore=3 | top: apps/web/src/app/dashboard/bots/[id]/edit/page.tsx [2]; apps/web/src/features/bots/components/BotCreateEditForm.tsx [1]
- apps/web/src/app/dashboard/bots/create/page.tsx | moduleIssueFiles=2 | moduleScore=3 | top: apps/web/src/app/dashboard/bots/create/page.tsx [2]; apps/web/src/features/bots/components/BotCreateEditForm.tsx [1]
- apps/web/src/app/dashboard/profile/page.tsx | moduleIssueFiles=1 | moduleScore=2 | top: apps/web/src/features/profile/components/BasicForm.tsx [2]
- apps/web/src/app/offline/page.tsx | moduleIssueFiles=1 | moduleScore=2 | top: apps/web/src/app/offline/page.tsx [2]
- apps/web/src/app/dashboard/wallets/[id]/edit/page.tsx | moduleIssueFiles=1 | moduleScore=1 | top: apps/web/src/features/wallets/components/WalletCreateEditForm.tsx [1]
- apps/web/src/app/dashboard/wallets/create/page.tsx | moduleIssueFiles=1 | moduleScore=1 | top: apps/web/src/features/wallets/components/WalletCreateEditForm.tsx [1]

## Notes
- Shared foundation findings (header/footer/aria/loading primitives) affect many routes via layout reuse and should be handled as one central batch.
- Module-level findings are priority for user-visible mixed-language and local-copy drift.
- Full raw audit data is available in the JSON artifact for deterministic tracking.