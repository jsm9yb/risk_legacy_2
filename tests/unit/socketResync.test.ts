import { describe, expect, it } from 'vitest';
import { shouldRequestSetupResync } from '@/hooks/useSocket';

describe('setup reject resync rules', () => {
  it('requests resync for setup-specific reason codes', () => {
    expect(shouldRequestSetupResync({
      success: false,
      newVersion: 10,
      reasonCode: 'SETUP_TURN_MISMATCH',
    })).toBe(true);

    expect(shouldRequestSetupResync({
      success: false,
      newVersion: 11,
      reasonCode: 'SETUP_PHASE_MISMATCH',
    })).toBe(true);
  });

  it('requests resync when reject context indicates setup drift', () => {
    expect(shouldRequestSetupResync({
      success: false,
      newVersion: 12,
      phase: 'SETUP',
      error: 'Not your turn',
    })).toBe(true);
  });

  it('does not request setup resync for unrelated rejects', () => {
    expect(shouldRequestSetupResync({
      success: false,
      newVersion: 13,
      reasonCode: 'TURN_MISMATCH',
      phase: 'RECRUIT',
      error: 'Not your turn',
    })).toBe(false);
  });
});
