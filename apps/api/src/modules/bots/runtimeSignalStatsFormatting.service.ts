export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

export const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const humanizeMergeReason = (reason: string | null) => {
  if (reason === 'weighted_winner') return 'Weighted winner';
  if (reason === 'exit_priority') return 'Exit priority';
  if (reason === 'weak_consensus') return 'Weak consensus';
  if (reason === 'tie') return 'Tie';
  if (reason === 'no_votes') return 'No votes';
  return reason;
};
