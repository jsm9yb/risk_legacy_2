# Risk Legacy - Complete Technical Specification

**Scope**: Full 15-game campaign with all legacy mechanics + React/TypeScript UI
**Current Focus**: Single game flow (Setup → Reinforcement → Attack → Maneuver → Victory)

---

# PART 1: BACKEND ENGINE SPECIFICATION

---

## 1. Project Overview

A digital adaptation of the "Legacy" board game mechanic. This system manages a persistent, evolving game state where choices made in one session permanently alter the rules, map, and components of future sessions.

---

## 2. Core Architectural Pillars

- **Persistence Layer**: SQLite database storing game state and move history
- **State Machine**: Server-side game loop handling setup, turn phases, and async combat
- **Observer Pattern**: Event-listener system monitoring for unlock triggers (future campaign scope)
- **Strategy Pattern**: Modular faction ability system

---

## 3. Data Models & Persistence

### 3.1 The World Map (Graph)

The map is stored as a graph G = (V, E).

**Vertices (Territories)**: 42 territories across 6 continents

| Field | Type | Description |
|-------|------|-------------|
| id | int | Unique territory identifier (0-41) |
| name | string | Territory name |
| continentId | int | FK to continent |
| neighbors | int[] | Adjacent territory IDs |
| ownerId | int? | FK to Player or null |
| troopCount | int | Current armies (0+) |
| scarId | string? | "bunker" \| "ammo_shortage" \| null |
| cityTier | int | 0=none, 1=minor, 2=major, 3=capital |
| cityName | string? | Player-assigned name |
| fortified | bool | Has fortification sticker |
| fortifyDamage | int | Attack boxes marked (0-10) |

**Edges (Adjacency)**: Defined in static `territories.json`

**Continents**: 6 continents with troop bonuses

| Continent | Territories | Bonus |
|-----------|-------------|-------|
| Asia | 12 | 7 |
| Europe | 7 | 5 |
| North America | 9 | 5 |
| Africa | 6 | 3 |
| South America | 4 | 2 |
| Australia | 4 | 2 |

### 3.2 Factions & Starting Powers

Each faction has 2 starting power options. At campaign start, ONE is chosen and applied; the other is marked destroyed.

| Faction | Power Option A | Power Option B |
|---------|----------------|----------------|
| **Die Mechaniker** | *Fortify HQ*: Your starting HQ is always fortified when defending (no degradation applies) | *Supreme Firepower*: When attacking with 3 dice, if all show same number, defender loses 3 troops immediately |
| **Enclave of the Bear** | *Ferocity*: On first attack each turn, +1 to highest attack die | *Stubborn*: When defending, if you roll doubles, attacker loses 1 additional troop |
| **Imperial Balkania** | *Recruitment Offices*: +1 troop during recruitment for each territory with a city you control | *Established*: Start each game with 10 troops instead of 8 |
| **Khan Industries** | *Rapid Deployment*: May place reinforcements on any controlled territory (ignores connectivity) | *Overwhelming Numbers*: When attacking with 3 dice, roll 4 and discard lowest |
| **Saharan Republic** | *Desert Nomads*: During maneuver, troops may move through ONE enemy territory | *Scattered*: May execute maneuver during attack phase instead of end (once per turn) |

**Faction Data Model**:

| Field | Type | Description |
|-------|------|-------------|
| id | string | "mechaniker" \| "enclave" \| "balkania" \| "khan" \| "saharan" |
| name | string | Display name |
| activePower | string | Chosen power ID |
| destroyedPower | string | Destroyed power ID |
| unitModel | string | Asset reference for pieces |

### 3.3 Resource Cards

**Deck Composition**: 52 cards total
- 42 Territory cards (one per territory)
- 10 Coin cards (standalone resource)

**Territory Card Fields**:

| Field | Type | Description |
|-------|------|-------------|
| id | int | Card identifier |
| territoryId | int | Associated territory |
| coinValue | int | Resources (1-6, starts at 1) |

**Coin Card Fields**:

| Field | Type | Description |
|-------|------|-------------|
| id | int | Card identifier |
| coinValue | int | Always 1 |

**Drawing Rules**:
1. Eligible only if player conquered (attacked and won) at least 1 enemy territory this turn
2. Expanding into unoccupied territory does NOT grant a card
3. Maximum 1 card per turn
4. Must draw from face-up Territory cards matching controlled territories if available
5. Otherwise, draw from Coin card pile

### 3.4 Scars

Scars are permanent territory modifiers. One scar per territory maximum.

| Scar ID | Name | Effect | Unlock |
|---------|------|--------|--------|
| bunker | Bunker | +1 to defender's highest die | Starting |
| ammo_shortage | Ammo Shortage | -1 to defender's highest die | Starting |
| biohazard | Biohazard | Territory loses 1 troop at start of controlling player's turn | Packet unlock |
| mercenary | Mercenary | Attacker may recruit 1 troop here before attacking | Packet unlock |
| fortification | Fortification | +1 to BOTH defender dice; degrades after 10 attacks with 3 dice | Sticker sheet |

**Scar Placement**:
- At game start, available scars dealt evenly to players
- Players place scars on any unscarred territory before setup
- Scars persist across all campaign games

### 3.5 Cities

Cities increase territory value and population.

| City Type | Population | Placement |
|-----------|------------|-----------|
| Minor City | 1 | Loser reward (Write Phase) |
| Major City | 2 | Winner reward (Write Phase) |
| World Capital | 3 | Packet unlock (one per campaign) |

**City Rules**:
- Maximum ONE city per territory
- Cities can be named by the founding player
- Major Cities founded by a player count as legal starting territories for that player
- Population adds to reinforcement calculation

### 3.6 Campaign Model

| Field | Type | Description |
|-------|------|-------------|
| id | int | Auto-increment |
| name | string | Campaign name |
| createdBy | int | FK to User |
| gameCount | int | Games played (0-15) |
| currentGameId | int? | FK to active Game |
| worldPopulation | int | Total city population across map |
| victors | JSON | Array of { gameNumber, playerId, factionId } |
| namedContinents | JSON | { continentId: "Custom Name" } |
| planetName | string? | Named after 15th game by most-wins player |
| packetStates | JSON | { packetId: "sealed" \| "opened" } |
| destroyedCards | int[] | Card IDs permanently removed |
| destroyedPowers | JSON | { factionId: powerId[] } |
| stickerPlacements | JSON | All permanent sticker placements |
| createdAt | datetime | |
| updatedAt | datetime | |

**Campaign Persistence**:
- All map modifications (scars, cities, named continents) persist
- Destroyed cards/powers are excluded from future games
- Faction power selections are permanent after first game

### 3.7 Player Model

| Field | Type | Description |
|-------|------|-------------|
| id | int | Auto-increment |
| gameId | int | FK to Game |
| userId | int | FK to User account |
| seatIndex | int | Turn order position (0-indexed) |
| factionId | string | Chosen faction |
| activePower | string | Chosen power ID |
| color | string | Player color |
| hqTerritory | int | Territory ID of HQ placement |
| redStars | int | Current star count (starts at 1 for own HQ) |
| missiles | int | Available missiles |
| cards | int[] | Resource card IDs in hand |
| isEliminated | bool | Has lost all territories |
| conqueredThisTurn | bool | Eligible for card draw |

### 3.8 Game Model

| Field | Type | Description |
|-------|------|-------------|
| id | int | Auto-increment |
| name | string? | Optional game name |
| status | string | "lobby" \| "setup" \| "active" \| "finished" |
| phase | string | Current phase (see State Machine) |
| subPhase | string? | Current sub-phase |
| currentTurn | int | Turn counter |
| activePlayerId | int? | FK to current player |
| mapState | JSON | Serialized territory states |
| deckState | JSON | Draw pile, discard pile, face-up cards |
| createdAt | datetime | |
| updatedAt | datetime | |

### 3.9 Move Log

| Field | Type | Description |
|-------|------|-------------|
| id | int | Auto-increment |
| gameId | int | FK to Game |
| playerId | int? | FK to Player (null for system events) |
| turnNumber | int | Turn when action occurred |
| phase | string | Phase when action occurred |
| moveType | string | Action type (see below) |
| payload | JSON | Action-specific data |
| createdAt | datetime | |

**Move Types**:
- `deploy`: { territoryId, count }
- `attack_declare`: { fromId, toId, attackerDice }
- `defend_declare`: { defenderDice }
- `missile_use`: { playerId, dieIndex, originalValue }
- `combat_resolve`: { attackerRolls, defenderRolls, attackerLoss, defenderLoss }
- `troop_move`: { fromId, toId, count }
- `maneuver`: { fromId, toId, count }
- `card_draw`: { cardId }
- `card_trade`: { cardIds[], forType: "troops" | "star", received }
- `victory`: { winnerId, condition }

---

## 4. Game Lifecycle & Logic

### 4.1 Setup Phase

Setup varies based on whether the Draft Packet has been opened.

#### 4.1.1 Pre-Draft Setup (Before Draft Packet Opened)

1. **ROLL_FOR_ORDER**: All players roll one die. Highest goes first. Ties re-roll among tied players.

2. **FACTION_SELECTION**: In turn order, each player:
   - Selects an available faction
   - Chooses one of two starting powers (other marked destroyed - first game only)

3. **HQ_PLACEMENT**: In turn order, each player:
   - Places HQ marker + 8 troops on a legal starting territory
   - **Legal territory**: Unmarked (no stickers) OR Major City founded by this player, AND NOT adjacent to another player's HQ

#### 4.1.2 Snake Draft Setup (After Draft Packet Opened)

Triggered by: 9th Minor City founded in campaign.

**Draft Cards**: 5 categories dealt face-up:
- Factions (available faction cards)
- Turn Order (1st through 5th)
- Placement Order (1st through 5th)
- Starting Troops (varies: 6, 8, 8, 10, 10)
- Starting Coins (0, 0, 1, 1, 2)

**Snake Draft Sequence** (for 5 players):
```
Round 1: Player A → B → C → D → E
Round 2: Player E → D → C → B → A
Round 3: Player A → B → C → D → E
...continues until each player has one card from each category
```

**Draft Order Determination**: All players roll; highest chooses first in snake.

**After Draft**:
1. In Placement Order, each player places HQ + troops (per Starting Troops card)
2. Players receive Coin cards (per Starting Coins card)
3. Turn 1 begins per Turn Order cards

### 4.2 Reinforcement Phase

**Troop Calculation**:
```
baseTroops = floor((controlledTerritories + totalCityPopulation) / 3)
continentBonus = sum of bonuses for fully-controlled continents
cardTradeTroops = optional, from resource trade
totalTroops = max(3, baseTroops) + continentBonus + cardTradeTroops
```

**Resource Card Trade for Troops**:

| Total Coins | Troops Received |
|-------------|-----------------|
| 2 | 1 |
| 3 | 2 |
| 4 | 3 |
| 5 | 4 |
| 6 | 5 |
| 7 | 6 |
| 8 | 7 |
| 9 | 8 |
| 10+ | 10 |

**Troop Placement**:
- May place on any controlled territory (unless faction power restricts/expands this)
- All reinforcements must be placed before proceeding

### 4.3 Attack Phase

**Attack Requirements**:
- Attacking territory must contain ≥2 troops
- Target must be adjacent to attacker
- Target must be enemy-controlled OR unoccupied

**Attack on Unoccupied Territory** (Expansion):
- Move ≥1 troop from adjacent controlled territory
- If target has a city: lose troops equal to city population, must retain control
- NO combat, NO card draw eligibility

**Attack on Enemy Territory** (Combat):

1. **Attacker Declaration**:
   - Select attacking territory (≥2 troops)
   - Select target territory (adjacent, enemy-controlled)
   - Select dice count: 1, 2, or 3 (max = min(troopCount - 1, 3))

2. **Defender Prompt**:
   - Server emits `prompt:defend` to defender
   - Defender selects 1 or 2 dice (max = min(troopCount, 2))
   - Timeout (10s): Auto-select maximum allowed dice

3. **Dice Roll**:
   - Server generates random values (1-6) for all dice

4. **Missile Interrupt Window** (5 seconds):
   - Any player with missiles > 0 may spend 1 missile
   - Effect: Change any rolled die to 6 (unmodifiable)
   - If missile used, window resets to 3 seconds for counter-missiles
   - Repeat until no missiles used in 3-second window

5. **Apply Modifiers**:
   - **Order**: Scars → Fortifications → Faction Powers
   - **Bounds**: Modified value cannot exceed 6 or drop below 1
   - **Restriction**: Only one die modified per source per combat
   - **Fortification**: +1 to BOTH defender dice (if territory fortified and not destroyed)
   - Fortification degrades: Mark 1 box if attacker used exactly 3 dice

6. **Resolve Combat**:
   - Sort attacker dice highest to lowest
   - Sort defender dice highest to lowest
   - Compare highest vs highest: Higher wins (ties → defender wins)
   - Compare second-highest vs second-highest (if both exist)
   - Loser of each comparison loses 1 troop

7. **Post-Combat**:
   - If defender has 0 troops: Attacker MUST move troops into territory
   - Movement minimum: Number of attack dice used
   - Movement maximum: All but 1 troop from attacking territory
   - Mark `conqueredThisTurn = true` on attacking player

8. **Elimination Check**:
   - If defender has 0 territories remaining: Eliminated
   - Attacker claims all defender's resource cards
   - Check victory condition

9. **Victory Check**:
   - If any player has ≥4 Red Stars: Immediate victory
   - If only 1 player remains: Victory

**Continuing Attacks**:
- Player may continue attacking until choosing to end phase
- Each attack is a complete cycle (1-9 above)

### 4.4 Maneuver Phase

**Rules**:
- One maneuver per turn (unless faction power modifies)
- Move troops from one controlled territory to another
- Path must be entirely through controlled territories
- Leave ≥1 troop in origin territory
- Cannot pass through enemy or unoccupied territories

### 4.5 End of Turn

1. **Card Draw**: If `conqueredThisTurn == true`, draw 1 resource card
2. **Reset Flags**: `conqueredThisTurn = false`
3. **Advance Turn**: Next player becomes active

### 4.6 Victory Conditions (Red Stars)

Victory requires 4 Red Stars. Sources:

| Source | Stars | Notes |
|--------|-------|-------|
| Own HQ controlled | 1 | Starting star; can be lost |
| Enemy HQ controlled | 1 each | Captured via combat |
| 4 Resource Cards traded | 1 | Cards discarded |
| Last player standing | Win | All others eliminated |

**Immediate Victory**: Game ends instantly when condition met, even mid-combat.

### 4.7 Join the War (Eliminated Player Respawn)

When a player is eliminated (loses all territories) but still has a legal starting territory:

1. At the START of their next scheduled turn
2. Place half of starting troops (rounded down) on a legal unoccupied territory with no marks
3. This territory becomes their new HQ (not the original one)
4. Resume normal turn phases

**Cannot Join War If**:
- No legal starting territory exists
- All unmarked territories are occupied

### 4.8 Event Deck (Unlocked by Packet)

Triggered when: First player wins their second game.

**Event Triggering**:
- When drawing a Resource Card, check the card's coin value
- If coin value ≥ Event Threshold (starts at 3), draw an Event Card

**Event Card Types**:

| Type | Duration | Example |
|------|----------|---------|
| Immediate | One-time effect | "Add 2 troops to all cities" |
| Ongoing | Lasts until condition | "No attacks may cross water" |
| Permanent | Campaign-wide | "This scar type now does X" |

### 4.9 Mission System (Unlocked by Packet)

Missions are global objectives any player can complete.

**Mission Card Model**:

| Field | Type | Description |
|-------|------|-------------|
| id | int | Card identifier |
| title | string | Mission name |
| predicate | string | Condition to check (e.g., "CITIES_OWNED >= 4") |
| reward | string | "RED_STAR" |

**Active Missions**:
- 3 Mission cards face-up at all times
- After each action, check if active player satisfies any mission
- On completion: Award 1 Red Star token, move Mission to graveyard
- Draw replacement Mission card

**Example Missions**:
- `Industrialist`: Control 4+ territories with cities
- `Continental`: Control all territories in any one continent
- `Warmonger`: Eliminate another player this turn

### 4.10 Write Phase (End of Game)

After a winner is declared, the Write Phase occurs before the next game.

**Winner Rewards** (choose 1-2 based on game number):

| Reward | Effect | Limit |
|--------|--------|-------|
| Name Continent | Assign custom name to unnamed continent | Once per continent |
| Found Major City | Place Major City sticker on controlled territory without city | Limited supply |
| Destroy Card | Remove one card from game permanently | Any non-coin card |
| Upgrade Card | Add +1 coin sticker to Territory card (max 6) | Any territory card |

**Loser Rewards** (all non-winners, choose 1):

| Reward | Effect |
|--------|--------|
| Found Minor City | Place Minor City on controlled territory without city |
| Upgrade Card | Add +1 coin to a Territory card you controlled |

**Signing the Board**:
- Winners sign the victor's section on the board
- After 15th game, player with most signatures names the planet

### 4.11 Packet Unlocking System

Packets are sealed content unlocked by campaign triggers.

**Packet Triggers**:

| Packet ID | Trigger Condition | Contents Summary |
|-----------|-------------------|------------------|
| SECOND_WIN | First player wins 2nd game | Event deck, Mission cards, Homelands |
| MINOR_CITIES_9 | 9th Minor City founded | Draft system, Biohazard scars |
| GREEN_SCAR_3 | 3rd green scar placed | Bonus resource cards |
| FACTION_ELIMINATED | Faction eliminated from campaign | Comeback Powers |
| MISSILES_3 | 3rd missile used in campaign | Advanced missile rules |
| WORLD_CAPITAL | World Capital founded | World Capital mechanics |
| DO_NOT_OPEN | (Undocumented trigger) | (Sealed content file) |

### 4.12 Comeback Powers (Eliminated Faction Reward)

When a faction is completely eliminated from a game:

1. That faction gains a unique Comeback Power
2. Power is permanently added to faction card
3. Applies in all future games of the campaign

---

## 5. Combat Resolution Detail

### 5.1 Die Modification Priority

1. Scars (territory-based)
2. Fortification (territory-based)
3. Faction powers (player-based)
4. Missiles (player action, applied last, makes die unmodifiable)

### 5.2 Modifier Application Rules

- If multiple dice show same value, only ONE is modified per source
- Die value bounds: [1, 6]
- A die marked as "unmodifiable" (via missile) cannot be changed by any subsequent modifier

### 5.3 Combat Examples

**Example 1: Basic Combat**
- Attacker: 3 dice, rolls [5, 3, 2]
- Defender: 2 dice, rolls [4, 4]
- Compare: 5 vs 4 → Attacker wins, 3 vs 4 → Defender wins
- Result: Attacker loses 1, Defender loses 1

**Example 2: Bunker Scar**
- Territory has Bunker scar (+1 to defender's highest)
- Defender rolls [3, 2] → Modified to [4, 2]
- Compare with attacker normally

**Example 3: Missile Use**
- Attacker rolls [2, 2, 1]
- Attacker spends missile: First 2 becomes 6 (unmodifiable)
- Final attacker dice: [6, 2, 1]
- Bunker cannot modify defender's die to beat the 6

---

## 6. State Machine

### 6.1 Top-Level States

```
CAMPAIGN_LOBBY → GAME_LOBBY → SETUP → ACTIVE → FINISHED → WRITE_PHASE → (next game or CAMPAIGN_END)
```

**Campaign States**:
- `CAMPAIGN_LOBBY`: Create campaign, invite players, configure settings
- `GAME_LOBBY`: Between games, waiting for all players ready
- `CAMPAIGN_END`: After 15th game, final scoring and planet naming

### 6.2 SETUP Sub-States

```
SETUP
├── SCAR_PLACEMENT (if scars available)
│   └── Each player places one scar on unscarred territory
├── ROLL_FOR_ORDER (pre-draft) OR DRAFT_PHASE (post-draft)
│   └── Pre-draft: Roll for turn order
│   └── Post-draft: Snake draft for factions/order/troops/coins
├── FACTION_SELECTION (pre-draft only)
│   └── In order: pick faction, choose power
└── HQ_PLACEMENT
    └── In order: place HQ + troops on legal territory
```

### 6.3 ACTIVE Sub-States

```
ACTIVE
├── TURN_START
│   ├── BIOHAZARD_ATTRITION (lose 1 troop per biohazard territory)
│   ├── JOIN_WAR (if eliminated, can respawn)
│   └── BUY_STARS (optional, repeatable: 4 cards → 1 star)
├── RECRUIT
│   ├── CALCULATE (auto: compute reinforcements)
│   ├── CARD_TRADE (optional: coins → troops)
│   └── PLACE_TROOPS (required: distribute all troops)
├── ATTACK
│   ├── IDLE (can attack or end phase)
│   ├── SELECT_ATTACK (from → to)
│   ├── ATTACKER_DICE (choose 1-3)
│   ├── DEFENDER_DICE (prompt, timeout → max)
│   ├── MISSILE_WINDOW (5s, reset on use)
│   ├── RESOLVE (roll, modify, compare, casualties)
│   ├── TROOP_MOVE (if conquered, move troops in)
│   ├── CHECK_MISSION (if mission completed, award star)
│   └── CHECK_VICTORY (if 4 stars or elimination)
├── MANEUVER
│   └── SINGLE_MOVE (optional: from → through → to)
└── TURN_END
    ├── DRAW_CARD (if conquered enemy this turn)
    ├── CHECK_EVENT (if card coins ≥ threshold, draw event)
    ├── APPLY_ONGOING_EVENTS (process active event effects)
    ├── CHECK_PACKET_TRIGGERS (open packets if conditions met)
    └── ADVANCE_TURN (next player)
```

### 6.4 WRITE_PHASE Sub-States

```
WRITE_PHASE
├── WINNER_REWARDS
│   ├── SELECT_REWARD_1 (name continent, found major city, destroy card)
│   └── SELECT_REWARD_2 (optional, based on game number)
├── LOSER_REWARDS (each non-winner in turn order)
│   └── SELECT_REWARD (found minor city, upgrade card)
├── SIGN_BOARD
│   └── Winner signs victor section
├── CHECK_CAMPAIGN_END
│   └── If game 15: trigger CAMPAIGN_END
└── PREPARE_NEXT_GAME
    └── Reset game state, preserve campaign state
```

### 6.5 State Transition Validation

| Current State | Valid Actions |
|---------------|---------------|
| CAMPAIGN_LOBBY | create_campaign, join_campaign, configure_settings, start_campaign |
| GAME_LOBBY | ready_up, unready, start_game (when all ready) |
| SCAR_PLACEMENT | place_scar (active player) |
| ROLL_FOR_ORDER | roll_die (each player once) |
| DRAFT_ROUND | pick_draft_card (active player) |
| FACTION_SELECTION | select_faction (active player) |
| HQ_PLACEMENT | place_hq (active player) |
| JOIN_WAR | place_respawn (if eligible) |
| BUY_STARS | trade_cards_for_star, skip_buy |
| CARD_TRADE | trade_cards_for_troops, skip_trade |
| PLACE_TROOPS | deploy_troop (until all placed) |
| ATTACK.IDLE | declare_attack, end_attack_phase |
| ATTACK.SELECT | select_target |
| ATTACK.ATTACKER_DICE | choose_dice_count |
| ATTACK.DEFENDER_DICE | choose_dice_count (defender only) |
| MISSILE_WINDOW | use_missile (any player with missiles) |
| TROOP_MOVE | move_troops (attacker, after conquest) |
| MANEUVER | execute_maneuver, skip_maneuver |
| WINNER_REWARDS | select_reward |
| LOSER_REWARDS | select_reward (active loser) |
| NAME_PLANET | submit_planet_name (most-wins player) |

---

## 7. WebSocket Events

### 7.1 Client → Server

**Campaign Events**:

| Event | Payload | Phase(s) |
|-------|---------|----------|
| `create_campaign` | { name, settings } | CAMPAIGN_LOBBY |
| `join_campaign` | { campaignId, token } | CAMPAIGN_LOBBY |
| `start_campaign` | {} | CAMPAIGN_LOBBY (host) |
| `ready_up` | {} | GAME_LOBBY |
| `unready` | {} | GAME_LOBBY |
| `start_game` | {} | GAME_LOBBY (host) |

**Setup Events**:

| Event | Payload | Phase(s) |
|-------|---------|----------|
| `place_scar` | { territoryId, scarId } | SCAR_PLACEMENT |
| `roll_die` | {} | ROLL_FOR_ORDER, DRAFT_ROLL |
| `pick_draft_card` | { category, cardId } | DRAFT_ROUND |
| `select_faction` | { factionId, powerId } | FACTION_SELECTION |
| `place_hq` | { territoryId } | HQ_PLACEMENT |

**Turn Events**:

| Event | Payload | Phase(s) |
|-------|---------|----------|
| `place_respawn` | { territoryId } | JOIN_WAR |
| `trade_cards_star` | { cardIds[4] } | BUY_STARS |
| `trade_cards_troops` | { cardIds[] } | CARD_TRADE |
| `deploy_troop` | { territoryId, count } | PLACE_TROOPS |
| `declare_attack` | { fromId, toId } | ATTACK.IDLE |
| `choose_attack_dice` | { count: 1-3 } | ATTACKER_DICE |
| `choose_defend_dice` | { count: 1-2 } | DEFENDER_DICE |
| `use_missile` | { dieIndex } | MISSILE_WINDOW |
| `move_troops` | { count } | TROOP_MOVE |
| `end_attack_phase` | {} | ATTACK.IDLE |
| `execute_maneuver` | { fromId, toId, count } | MANEUVER |
| `skip_maneuver` | {} | MANEUVER |

**Write Phase Events**:

| Event | Payload | Phase(s) |
|-------|---------|----------|
| `select_winner_reward` | { rewardType, target? } | WINNER_REWARDS |
| `select_loser_reward` | { rewardType, target? } | LOSER_REWARDS |
| `name_continent` | { continentId, name } | WINNER_REWARDS |
| `found_city` | { territoryId, name, cityType } | WINNER/LOSER_REWARDS |
| `destroy_card` | { cardId } | WINNER_REWARDS |
| `upgrade_card` | { cardId } | WINNER/LOSER_REWARDS |
| `name_planet` | { name } | NAME_PLANET |

### 7.2 Server → Client

**State Events**:

| Event | Payload | Description |
|-------|---------|-------------|
| `campaign_state` | { fullCampaignState } | Campaign sync |
| `game_state` | { fullGameState } | Initial game sync or reconnect |
| `delta` | { patch } | Incremental state update |

**Prompt Events**:

| Event | Payload | Description |
|-------|---------|-------------|
| `prompt:defend` | { attackerId, fromId, toId, attackerDice } | Defender must choose dice |
| `prompt:missile` | { timeRemaining, eligiblePlayers } | Missile window open |
| `prompt:draft_pick` | { availableCards, category } | Player must pick draft card |
| `prompt:reward` | { rewardOptions, isWinner } | Select Write Phase reward |

**Game Events**:

| Event | Payload | Description |
|-------|---------|-------------|
| `event:roll_result` | { playerId, value } | Setup/draft phase roll |
| `event:draft_pick` | { playerId, category, cardId } | Draft card selected |
| `event:combat_rolls` | { attackerDice[], defenderDice[] } | Pre-modifier rolls |
| `event:combat_result` | { modifiedDice, casualties, newState } | Final combat outcome |
| `event:conquest` | { territoryId, newOwnerId } | Territory changed hands |
| `event:elimination` | { playerId, factionId } | Player eliminated |
| `event:mission_complete` | { playerId, missionId } | Mission accomplished |
| `event:event_card` | { eventCard, effect } | Event card triggered |
| `event:victory` | { winnerId, condition } | Game over |

**Campaign Events**:

| Event | Payload | Description |
|-------|---------|-------------|
| `event:packet_opened` | { packetId, contents } | Packet unlocked |
| `event:scar_placed` | { territoryId, scarId } | Permanent scar added |
| `event:city_founded` | { territoryId, cityType, name } | City placed |
| `event:card_destroyed` | { cardId } | Card removed from game |
| `event:continent_named` | { continentId, name } | Continent named |
| `event:comeback_power` | { factionId, powerId } | Faction gains comeback power |
| `event:planet_named` | { name, namedBy } | Planet named (game 15) |
| `event:campaign_complete` | { summary } | Campaign finished |

---

## 8. Error Handling

### 8.1 Invalid Action Responses

| Error Code | Condition | Response |
|------------|-----------|----------|
| `NOT_YOUR_TURN` | Player acted out of turn | Reject, no state change |
| `INVALID_PHASE` | Action not valid in current phase | Reject |
| `INVALID_TERRITORY` | Territory doesn't exist or wrong owner | Reject |
| `INSUFFICIENT_TROOPS` | Not enough troops for action | Reject |
| `NOT_ADJACENT` | Attack target not adjacent | Reject |
| `ILLEGAL_PLACEMENT` | HQ placement violates rules | Reject |
| `INSUFFICIENT_CARDS` | Not enough cards for trade | Reject |

### 8.2 Timeout Handling

| Situation | Timeout | Auto-Action |
|-----------|---------|-------------|
| Defender dice selection | 10s | Max allowed dice |
| Missile window | 5s (3s after use) | Proceed without missiles |
| Turn timeout (optional) | Configurable | Skip to next phase |

---

## 9. Static Data Files

### 9.1 territories.json
```json
[
  { "id": 0, "name": "Alaska", "continentId": 0, "neighbors": [1, 5, 31] },
  { "id": 1, "name": "Northwest Territory", "continentId": 0, "neighbors": [0, 2, 3, 5] },
  // ... 42 total territories
]
```

### 9.2 continents.json
```json
[
  { "id": 0, "name": "North America", "territoryIds": [0,1,2,3,4,5,6,7,8], "bonus": 5 },
  { "id": 1, "name": "South America", "territoryIds": [9,10,11,12], "bonus": 2 },
  { "id": 2, "name": "Europe", "territoryIds": [13,14,15,16,17,18,19], "bonus": 5 },
  { "id": 3, "name": "Africa", "territoryIds": [20,21,22,23,24,25], "bonus": 3 },
  { "id": 4, "name": "Asia", "territoryIds": [26,27,28,29,30,31,32,33,34,35,36,37], "bonus": 7 },
  { "id": 5, "name": "Australia", "territoryIds": [38,39,40,41], "bonus": 2 }
]
```

### 9.3 factions.json
```json
[
  {
    "id": "mechaniker",
    "name": "Die Mechaniker",
    "powers": [
      { "id": "fortify_hq", "name": "Fortify HQ", "type": "defense" },
      { "id": "supreme_firepower", "name": "Supreme Firepower", "type": "attack" }
    ]
  },
  // ... 5 factions
]
```

---

## 10. Critical Implementation Files

### Core Engine

| File Path | Purpose |
|-----------|---------|
| `/server/prisma/schema.prisma` | Database models (User, Campaign, Game, Player, MoveLog) |
| `/server/src/engine/stateMachine.ts` | Phase transitions, state validation |
| `/server/src/engine/combat.ts` | Dice rolling, modifiers, casualties |
| `/server/src/engine/reinforcement.ts` | Troop calculation, continent bonuses |
| `/server/src/engine/map.ts` | Territory connectivity, continent control |
| `/server/src/engine/cards.ts` | Resource deck, drawing rules, trading |
| `/server/src/engine/missions.ts` | Mission predicate evaluation |
| `/server/src/engine/events.ts` | Event card effects, ongoing event processing |

### Campaign Systems

| File Path | Purpose |
|-----------|---------|
| `/server/src/campaign/persistence.ts` | Cross-game state management |
| `/server/src/campaign/packets.ts` | Packet trigger detection, content injection |
| `/server/src/campaign/writePhase.ts` | Winner/loser rewards, city founding |
| `/server/src/campaign/draft.ts` | Snake draft logic |
| `/server/src/campaign/scars.ts` | Scar placement, biohazard processing |

### Socket.IO Layer

| File Path | Purpose |
|-----------|---------|
| `/server/src/index.ts` | Main server, socket initialization |
| `/server/src/events/campaign.ts` | Campaign lifecycle events |
| `/server/src/events/setup.ts` | Setup and draft events |
| `/server/src/events/turn.ts` | Turn action events |
| `/server/src/events/combat.ts` | Attack/defend/missile events |
| `/server/src/events/writePhase.ts` | Write phase reward events |

---

# PART 2: FRONTEND UI SPECIFICATION

---

## 11. UI Overview

**Tech Stack**: React + TypeScript + Tailwind CSS
**Style**: Faithful board game aesthetic
**Scope**: Single game flow (Setup → Reinforcement → Attack → Maneuver → Victory)

---

## 12. Screen Layout Wireframe

```
+------------------------------------------------------------------+
|  HEADER BAR                                                       |
|  [Logo] Risk Legacy    Game: "Friday Night Wars"    [Settings] [?]|
+------------------------------------------------------------------+
|                              |                                    |
|  PLAYER SIDEBAR              |  MAIN GAME AREA                    |
|  (Left, ~250px)              |  (Center, flexible)                |
|                              |                                    |
|  +------------------------+  |  +------------------------------+  |
|  | CURRENT PLAYER        |  |  |                              |  |
|  | [Avatar] Khan Ind.    |  |  |     WORLD MAP                |  |
|  | Power: Rapid Deploy   |  |  |     (SVG Interactive)        |  |
|  | Stars: ★★☆☆          |  |  |                              |  |
|  | Missiles: 2           |  |  |     42 territories           |  |
|  +------------------------+  |  |     6 continents             |  |
|                              |  |     Troop counts             |  |
|  +------------------------+  |  |     Owner colors             |  |
|  | ALL PLAYERS           |  |  |     Scars/Cities icons       |  |
|  | 1. You (Khan) ★★     |  |  |                              |  |
|  | 2. Alex (Bear) ★      |  |  |                              |  |
|  | 3. Sam (Mech) ★★★    |  |  |                              |  |
|  +------------------------+  |  +------------------------------+  |
|                              |                                    |
|  +------------------------+  |  +------------------------------+  |
|  | PHASE INDICATOR       |  |  | ACTION BAR                   |  |
|  | Turn 5 - ATTACK       |  |  | [End Attack Phase] [Undo]    |  |
|  | Your turn             |  |  +------------------------------+  |
|  +------------------------+  |                                    |
|                              +------------------------------------+
|  +------------------------+  |                                    |
|  | YOUR CARDS (4)        |  |  GAME LOG (collapsible)            |
|  | [Card][Card][Card]... |  |  - Turn 5: You attacked Alaska     |
|  | [Trade for Troops]    |  |  - Turn 5: Combat: 6,4 vs 5,3      |
|  +------------------------+  |  - Turn 4: Alex reinforced...      |
|                              |                                    |
+------------------------------------------------------------------+
```

---

## 13. Core UI Components

### 13.1 GameBoard (Map Component)
**File**: `src/components/game/GameBoard.tsx`

The central SVG-based interactive world map.

```
Territory Visual States:
┌─────────────────┐
│  ALASKA    [3]  │  <- Territory name + troop count
│  ═══════════    │  <- Faction color fill
│  🏰 ⚔️          │  <- Icons: city, scar
└─────────────────┘

Visual Elements:
- Territory polygons (SVG paths from map asset)
- Troop count badges
- Owner color fills (faction-specific)
- Scar indicators (bunker shield, ammo warning, biohazard)
- City markers (minor=house, major=tower, capital=crown)
- HQ marker (flag icon on home territory)
- Selection highlight (glow/border on hover/click)
- Connection lines (solid=land, dashed=sea)
```

**Interactions**:
- Hover: Show territory tooltip (name, owner, troops, modifiers)
- Click: Select territory (context-dependent on phase)
- During Attack: Click source → Click target → Confirm

### 13.2 PlayerSidebar
**File**: `src/components/game/PlayerSidebar.tsx`

```
┌──────────────────────────┐
│ YOUR STATUS              │
│ ┌──────────────────────┐ │
│ │ [Faction Emblem]     │ │
│ │ Khan Industries      │ │
│ │ "Rapid Deployment"   │ │
│ └──────────────────────┘ │
│                          │
│ Red Stars: ★★☆☆ (2/4)   │
│ Missiles:  🚀🚀 (2)      │
│ Territories: 12          │
│ Reinforcements: +5       │
│   (base 4 + Asia bonus)  │
├──────────────────────────┤
│ ALL PLAYERS              │
│ ┌────────────────────┐   │
│ │ 1. You (Khan) ★★  │←──│── Current turn indicator
│ │ 2. Alex (Bear) ★   │   │
│ │ 3. Sam (Mech) ★★★ │   │
│ │ 4. Jo (Saharan) ★  │   │
│ └────────────────────┘   │
└──────────────────────────┘
```

### 13.3 PhaseIndicator
**File**: `src/components/game/PhaseIndicator.tsx`

```
┌─────────────────────────────────────────┐
│  TURN 5 - YOUR TURN                     │
│  ○ Setup  ● Reinforce  ○ Attack  ○ Move │
│  └──────────────────────────────────────│
│  Phase: PLACE TROOPS (8 remaining)      │
└─────────────────────────────────────────┘
```

Visual phase progression bar showing: Setup → Reinforce → Attack → Maneuver

### 13.4 CardHand
**File**: `src/components/game/CardHand.tsx`

```
┌─────────────────────────────────────────┐
│ YOUR CARDS (4)                     [▲]  │
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │Alaska│ │Coin │ │Egypt│ │China│        │
│ │ 🪙2  │ │ 🪙1 │ │ 🪙1 │ │ 🪙3 │        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
│                          Total: 7 coins │
│ [Trade for 6 Troops] [Trade for ★]     │
└─────────────────────────────────────────┘
```

### 13.5 CombatModal
**File**: `src/components/game/CombatModal.tsx`

The combat resolution overlay - key UX moment.

```
┌─────────────────────────────────────────────────┐
│              ⚔️ COMBAT ⚔️                       │
│         Alaska → Northwest Territory            │
├─────────────────────────────────────────────────┤
│                                                 │
│   ATTACKER (You)        DEFENDER (Alex)         │
│   Khan Industries       Enclave of Bear         │
│                                                 │
│   ┌───┐ ┌───┐ ┌───┐     ┌───┐ ┌───┐            │
│   │ 6 │ │ 4 │ │ 2 │     │ 5 │ │ 3 │            │
│   └───┘ └───┘ └───┘     └───┘ └───┘            │
│      ↑                     ↑                    │
│   [+1 Power]            [+1 Bunker]             │
│                                                 │
│   Results: 6 vs 5 → WIN   4 vs 3 → WIN         │
│   Defender loses 2 troops!                      │
│                                                 │
│   🚀 Use Missile (2 left)     [5s]             │
│                                                 │
│              [Continue Attack]                  │
└─────────────────────────────────────────────────┘
```

**Combat Flow**:
1. Attacker selects dice count (1-3)
2. Defender prompted (or timeout → max dice)
3. Dice roll animation
4. Missile window (5 seconds, countdown visible)
5. Modifier application (scars, powers)
6. Result comparison with visual indicators
7. Casualty animation
8. If conquest: Troop movement slider

### 13.6 ActionBar
**File**: `src/components/game/ActionBar.tsx`

Context-sensitive action buttons based on current phase.

```
REINFORCEMENT PHASE:
┌─────────────────────────────────────────┐
│ Troops to place: 8                      │
│ Click territories to deploy             │
│ [+1] [-1] on selected territory         │
│                     [Done Placing]      │
└─────────────────────────────────────────┘

ATTACK PHASE:
┌─────────────────────────────────────────┐
│ Select territory to attack FROM         │
│ (or)                                    │
│ [End Attack Phase →]                    │
└─────────────────────────────────────────┘

MANEUVER PHASE:
┌─────────────────────────────────────────┐
│ Move troops between your territories    │
│ From: [Alaska ▼]  To: [Kamchatka ▼]    │
│ Troops: [====●====] 5                   │
│ [Execute Maneuver]  [Skip]              │
└─────────────────────────────────────────┘
```

### 13.7 GameLog
**File**: `src/components/game/GameLog.tsx`

```
┌─────────────────────────────────────────┐
│ GAME LOG                    [Filter ▼]  │
├─────────────────────────────────────────┤
│ Turn 5                                  │
│  • You deployed 3 troops to Alaska      │
│  • You attacked NW Territory from Alaska│
│  • Combat: [6,4,2] vs [5,3]            │
│  • Defender lost 2 troops               │
│  • You conquered NW Territory           │
│ Turn 4                                  │
│  • Alex reinforced Europe (+5)          │
│  ...                                    │
└─────────────────────────────────────────┘
```

---

## 14. Phase-Specific Screens

### 14.1 Faction Selection Screen
```
┌─────────────────────────────────────────────────────────────┐
│                    CHOOSE YOUR FACTION                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │   ⚙️    │  │   🐻    │  │   👑    │  │   🏭    │        │
│  │ Mech.   │  │  Bear   │  │ Balkan. │  │  Khan   │        │
│  │ [Taken] │  │ [Pick]  │  │ [Pick]  │  │ [Pick]  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  ENCLAVE OF THE BEAR                                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Choose ONE starting power (other is destroyed):    │     │
│  │                                                    │     │
│  │ ○ FEROCITY                                         │     │
│  │   On first attack each turn, +1 to highest die    │     │
│  │                                                    │     │
│  │ ● STUBBORN                                         │     │
│  │   When defending, doubles = attacker loses 1 extra │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│                              [Confirm Selection]             │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 HQ Placement Screen
```
┌─────────────────────────────────────────┐
│ PLACE YOUR HEADQUARTERS                 │
│ Click a valid territory (highlighted)   │
│ • Must be unmarked OR your Major City   │
│ • Cannot be adjacent to another HQ      │
│                                         │
│ [MAP with valid territories glowing]    │
│                                         │
│ Selected: Indonesia                     │
│ [Confirm HQ Placement]                  │
└─────────────────────────────────────────┘
```

### 14.3 Victory Screen
```
┌─────────────────────────────────────────────────────────────┐
│                      🏆 VICTORY! 🏆                          │
│                                                              │
│              KHAN INDUSTRIES WINS                            │
│                   (4 Red Stars)                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Final Stats:                                      │     │
│  │  • Territories controlled: 18                      │     │
│  │  • Enemy HQs captured: 2                           │     │
│  │  • Cards traded for stars: 1                       │     │
│  │  • Troops eliminated: 47                           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│              [Continue to Write Phase →]                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 15. Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── GameName
│   └── SettingsMenu
│
├── GameContainer
│   ├── PlayerSidebar
│   │   ├── CurrentPlayerStatus
│   │   ├── PlayerList
│   │   ├── PhaseIndicator
│   │   └── CardHand
│   │
│   ├── MainGameArea
│   │   ├── GameBoard (SVG Map)
│   │   │   ├── ContinentGroup (×6)
│   │   │   │   └── Territory (×42)
│   │   │   ├── ConnectionLines
│   │   │   └── MapOverlays (selection, highlights)
│   │   │
│   │   └── ActionBar
│   │       ├── ReinforcementControls
│   │       ├── AttackControls
│   │       └── ManeuverControls
│   │
│   └── GameLog (collapsible)
│
└── Modals (portal)
    ├── CombatModal
    ├── CardTradeModal
    ├── FactionSelectModal
    ├── HQPlacementModal
    └── VictoryModal
```

---

## 16. State Management (Zustand)

```typescript
// src/store/gameStore.ts
interface GameState {
  // Game metadata
  gameId: string;
  status: 'lobby' | 'setup' | 'active' | 'finished';

  // Turn state
  currentTurn: number;
  activePlayerId: string;
  phase: GamePhase;
  subPhase: SubPhase | null;

  // Map state
  territories: Record<TerritoryId, TerritoryState>;

  // Players
  players: Player[];
  currentPlayer: Player;

  // Cards
  deck: DeckState;

  // UI state
  selectedTerritory: TerritoryId | null;
  attackSource: TerritoryId | null;
  attackTarget: TerritoryId | null;

  // Actions
  deployTroop: (territoryId: TerritoryId, count: number) => void;
  declareAttack: (from: TerritoryId, to: TerritoryId) => void;
  selectDice: (count: number) => void;
  useMissile: (dieIndex: number) => void;
  executeManeuver: (from: TerritoryId, to: TerritoryId, count: number) => void;
  endPhase: () => void;
}

// src/store/uiStore.ts
interface UIState {
  activeModal: ModalType | null;
  hoveredTerritory: TerritoryId | null;
  showGameLog: boolean;
  combatState: CombatState | null;
}
```

---

## 17. Styling: Tailwind CSS

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      board: {
        wood: '#2C1810',
        parchment: '#F5E6D3',
        border: '#4A3728',
        sea: '#7BA3B8',
      },
      faction: {
        mechaniker: '#4A90A4',
        bear: '#8B4513',
        balkania: '#6B3FA0',
        khan: '#2F4F4F',
        saharan: '#DAA520',
      }
    },
    fontFamily: {
      display: ['Cinzel', 'serif'],
      body: ['Source Sans Pro', 'sans-serif'],
      numbers: ['Oswald', 'sans-serif'],
    }
  }
}
```

**Visual Style**:
- Background: Dark wood grain texture (#2C1810)
- Map: Aged parchment (#F5E6D3)
- Borders: Dark brown (#4A3728)
- Sea: Muted ocean blue (#7BA3B8)
- Buttons: Beveled edges, leather texture
- Cards: Worn paper effect, coffee-stained borders
- Modals: Scroll/parchment styling
- Dice: 3D rendered, colored pips

---

## 18. SVG Map Asset

**Existing Asset**: `/home/jordansmithkc/risk_legacy_2/risk_board.svg`

- Dimensions: 749.82 x 519.07
- Created in Inkscape
- Territory IDs match `territories.yaml` (e.g., `alaska`, `northwest_territory`, `greenland`, etc.)

### Integration
```typescript
// src/components/game/GameBoard.tsx
import { ReactComponent as RiskMap } from '@/assets/risk_board.svg';

// Or load dynamically for manipulation:
const mapSvg = await fetch('/assets/risk_board.svg').then(r => r.text());
```

### Required Modifications
1. Add `data-continent` attribute to each territory path
2. Calculate center points for troop badge placement
3. Add connection layer for highlighting valid moves

---

## 19. Frontend File Structure

```
src/
├── components/
│   ├── game/
│   │   ├── GameBoard.tsx
│   │   ├── Territory.tsx
│   │   ├── TerritoryTooltip.tsx
│   │   ├── PlayerSidebar.tsx
│   │   ├── PhaseIndicator.tsx
│   │   ├── CardHand.tsx
│   │   ├── ActionBar.tsx
│   │   ├── GameLog.tsx
│   │   └── CombatModal.tsx
│   │
│   ├── setup/
│   │   ├── FactionSelect.tsx
│   │   ├── PowerSelect.tsx
│   │   └── HQPlacement.tsx
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Card.tsx
│       └── Dice.tsx
│
├── store/
│   ├── gameStore.ts
│   └── uiStore.ts
│
├── hooks/
│   ├── useGameSocket.ts
│   ├── useTerritorySelection.ts
│   └── useCombat.ts
│
├── data/
│   ├── territories.ts
│   ├── continents.ts
│   └── factions.ts
│
├── assets/
│   ├── map/
│   │   └── risk_board.svg
│   ├── icons/
│   └── textures/
│
└── types/
    ├── game.ts
    ├── territory.ts
    └── player.ts
```

---

## 20. Implementation Order

### Phase 1: Static Map Display
1. Create base GameBoard component with SVG map
2. Render all 42 territories with placeholder data
3. Add continent color fills
4. Display troop counts
5. Implement hover tooltips

### Phase 2: Player UI
1. Build PlayerSidebar with mock player data
2. Create PhaseIndicator component
3. Build CardHand display
4. Add faction emblems and icons

### Phase 3: Reinforcement Phase
1. Implement territory selection
2. Build troop deployment controls
3. Add deployment validation
4. Wire up to game state

### Phase 4: Attack Phase
1. Build attack source/target selection
2. Create dice count selector
3. Build CombatModal with full flow
4. Add combat animations (dice roll, casualties)
5. Implement conquest troop movement

### Phase 5: Maneuver Phase
1. Build path validation display
2. Create maneuver controls
3. Implement troop movement slider

### Phase 6: Setup Phase
1. Create FactionSelect screen
2. Build PowerSelect interface
3. Implement HQ placement with validation

### Phase 7: Victory & Polish
1. Victory detection and modal
2. Game log implementation
3. Sound effects
4. Animations and transitions

---

## 21. Verification Plan

1. **Visual Review**: Load map, verify all 42 territories render correctly
2. **Interaction Test**: Click through all phases manually
3. **Combat Test**: Run multiple combats, verify dice, modifiers, casualties
4. **Edge Cases**:
   - Attack with 1 vs 3 dice
   - Conquest troop movement limits
   - Card trading thresholds
5. **Responsive**: Test on different screen sizes
