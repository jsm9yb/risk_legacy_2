import { z } from 'zod';
import type { GameAction } from './types';

const factionIdSchema = z.enum(['mechaniker', 'enclave', 'balkania', 'khan', 'saharan']);

const actionMetaSchema = z.object({
  clientVersion: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
});

const emptyPayloadSchema = z.object({}).strict();

export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('selectFaction'),
    payload: z.object({
      factionId: factionIdSchema,
      powerId: z.string().min(1),
      color: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('placeHQ'),
    payload: z.object({ territoryId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('addTroop'),
    payload: z.object({ territoryId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('removeTroop'),
    payload: z.object({ territoryId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('confirmDeployment'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('selectAttackSource'),
    payload: z.object({ territoryId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('selectAttackTarget'),
    payload: z.object({ territoryId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('selectAttackerDice'),
    payload: z.object({ diceCount: z.number().int().min(1).max(3) }),
  }),
  z.object({
    type: z.literal('selectDefenderDice'),
    payload: z.object({ diceCount: z.number().int().min(1).max(2) }),
  }),
  z.object({
    type: z.literal('useMissile'),
    payload: z.object({
      side: z.enum(['attacker', 'defender']),
      dieIndex: z.number().int().min(0),
    }),
  }),
  z.object({
    type: z.literal('resolveCombat'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('attackAgain'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('selectNewTarget'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('confirmConquest'),
    payload: z.object({ troops: z.number().int().min(1).optional() }),
  }),
  z.object({
    type: z.literal('endAttackPhase'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('selectManeuverSource'),
    payload: z.object({ territoryId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('selectManeuverTarget'),
    payload: z.object({ territoryId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('cancelManeuver'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('confirmManeuver'),
    payload: z.object({ troops: z.number().int().min(1).optional() }),
  }),
  z.object({
    type: z.literal('skipManeuver'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('returnToAttackPhase'),
    payload: emptyPayloadSchema,
  }),
  z.object({
    type: z.literal('endTurn'),
    payload: emptyPayloadSchema,
  }),
]).and(actionMetaSchema);

export type ParsedGameAction = z.infer<typeof gameActionSchema> & GameAction;
