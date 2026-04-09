import { SignalDirection } from '@prisma/client';
import { ActiveBotStrategy } from './runtimeSignalLoopDefaults';

export type StrategyVote = {
  strategyId: string;
  direction: SignalDirection;
  priority: number;
  weight: number;
};

type MergedStrategyDecision = {
  direction: SignalDirection | null;
  strategyId?: string;
  metadata: Record<string, unknown>;
};

export const mergeRuntimeStrategyVotes = (input: {
  strategies: ActiveBotStrategy[];
  votes: StrategyVote[];
  minDirectionalScore: number;
}): MergedStrategyDecision => {
  const { strategies, votes, minDirectionalScore } = input;
  if (votes.length === 0) {
    return {
      direction: null,
      metadata: {
        mergePolicy: 'weighted_exit_priority',
        reason: 'no_votes',
      },
    };
  }

  const exitVotes = votes
    .filter((vote) => vote.direction === 'EXIT')
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      return left.strategyId.localeCompare(right.strategyId);
    });

  if (exitVotes.length > 0) {
    const winner = exitVotes[0];
    return {
      direction: 'EXIT',
      strategyId: winner.strategyId,
      metadata: {
        mergePolicy: 'weighted_exit_priority',
        reason: 'exit_priority',
        votes: votes.map((vote) => ({
          strategyId: vote.strategyId,
          direction: vote.direction,
          priority: vote.priority,
          weight: vote.weight,
        })),
        winner: {
          strategyId: winner.strategyId,
          priority: winner.priority,
          weight: winner.weight,
        },
      },
    };
  }

  const longScore = votes
    .filter((vote) => vote.direction === 'LONG')
    .reduce((accumulator, vote) => accumulator + vote.weight, 0);
  const shortScore = votes
    .filter((vote) => vote.direction === 'SHORT')
    .reduce((accumulator, vote) => accumulator + vote.weight, 0);

  if (longScore === shortScore) {
    return {
      direction: null,
      metadata: {
        mergePolicy: 'weighted_exit_priority',
        reason: 'tie',
        scores: { longScore, shortScore, minDirectionalScore },
        votes: votes.map((vote) => ({
          strategyId: vote.strategyId,
          direction: vote.direction,
          priority: vote.priority,
          weight: vote.weight,
        })),
      },
    };
  }

  const winnerDirection: SignalDirection = longScore > shortScore ? 'LONG' : 'SHORT';
  const winnerScore = winnerDirection === 'LONG' ? longScore : shortScore;
  if (winnerScore < minDirectionalScore) {
    return {
      direction: null,
      metadata: {
        mergePolicy: 'weighted_exit_priority',
        reason: 'weak_consensus',
        scores: { longScore, shortScore, minDirectionalScore },
        votes: votes.map((vote) => ({
          strategyId: vote.strategyId,
          direction: vote.direction,
          priority: vote.priority,
          weight: vote.weight,
        })),
      },
    };
  }

  const winnerVotes = votes
    .filter((vote) => vote.direction === winnerDirection)
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      if (left.weight !== right.weight) return right.weight - left.weight;
      return left.strategyId.localeCompare(right.strategyId);
    });

  const winner = winnerVotes[0];
  return {
    direction: winnerDirection,
    strategyId: winner?.strategyId ?? strategies[0]?.strategyId,
    metadata: {
      mergePolicy: 'weighted_exit_priority',
      reason: 'weighted_winner',
      scores: { longScore, shortScore, minDirectionalScore },
      votes: votes.map((vote) => ({
        strategyId: vote.strategyId,
        direction: vote.direction,
        priority: vote.priority,
        weight: vote.weight,
      })),
      winner: winner
        ? {
            strategyId: winner.strategyId,
            direction: winner.direction,
            priority: winner.priority,
            weight: winner.weight,
          }
        : null,
    },
  };
};
