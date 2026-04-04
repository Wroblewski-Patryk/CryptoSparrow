-- EXPH-02: extend Exchange enum with placeholder exchanges (fail-closed rollout)
ALTER TYPE "Exchange" ADD VALUE IF NOT EXISTS 'BYBIT';
ALTER TYPE "Exchange" ADD VALUE IF NOT EXISTS 'OKX';
ALTER TYPE "Exchange" ADD VALUE IF NOT EXISTS 'KRAKEN';
ALTER TYPE "Exchange" ADD VALUE IF NOT EXISTS 'COINBASE';
