import { PreTradeAnalysisParsedInput, PreTradeBotLiveConfig } from './preTrade.types';

type EvaluatePreTradeRiskInput = {
  parsed: PreTradeAnalysisParsedInput;
  userOpenPositions: number;
  botOpenPositions: number | null;
  hasOpenPositionOnSymbol: boolean;
  botLiveConfig: PreTradeBotLiveConfig | null;
};

export const evaluatePreTradeRiskReasons = (input: EvaluatePreTradeRiskInput) => {
  const reasons: string[] = [];
  const { parsed, userOpenPositions, botOpenPositions, hasOpenPositionOnSymbol, botLiveConfig } = input;

  if (parsed.mode === 'LIVE') {
    if (parsed.globalKillSwitch) {
      reasons.push('global_kill_switch_enabled');
    }

    if (parsed.emergencyStop) {
      reasons.push('emergency_stop_enabled');
    }

    if (!parsed.botId) {
      reasons.push('live_bot_required');
    } else if (!botLiveConfig) {
      reasons.push('live_bot_not_found');
    } else {
      if (botLiveConfig.mode !== 'LIVE') {
        reasons.push('live_mode_bot_required');
      }
      if (!botLiveConfig.liveOptIn) {
        reasons.push('live_opt_in_required');
      }
      if (!botLiveConfig.consentTextVersion) {
        reasons.push('live_consent_version_required');
      }
    }
  }

  if (
    typeof parsed.maxOpenPositionsPerUser === 'number' &&
    userOpenPositions >= parsed.maxOpenPositionsPerUser
  ) {
    reasons.push('user_open_positions_limit_reached');
  }

  if (
    parsed.botId &&
    typeof parsed.maxOpenPositionsPerBot === 'number' &&
    typeof botOpenPositions === 'number' &&
    botOpenPositions >= parsed.maxOpenPositionsPerBot
  ) {
    reasons.push('bot_open_positions_limit_reached');
  }

  if (hasOpenPositionOnSymbol) {
    reasons.push('open_position_on_symbol_exists');
  }

  return reasons;
};

