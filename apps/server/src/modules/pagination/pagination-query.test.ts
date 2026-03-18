import { describe, expect, it } from 'vitest';
import { ListOrdersQuerySchema } from '../orders/orders.types';
import { ListPositionsQuerySchema } from '../positions/positions.types';
import { LogsQuerySchema } from '../logs/logs.types';

describe('pagination query standards', () => {
  it('applies page=1 default across orders/positions/logs', () => {
    expect(ListOrdersQuerySchema.parse({}).page).toBe(1);
    expect(ListPositionsQuerySchema.parse({}).page).toBe(1);
    expect(LogsQuerySchema.parse({}).page).toBe(1);
  });

  it('rejects non-positive page values', () => {
    expect(() => ListOrdersQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => ListPositionsQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => LogsQuerySchema.parse({ page: 0 })).toThrow();
  });
});

