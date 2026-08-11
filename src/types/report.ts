// Types matching the AxiBridge WvW report.json structure.

import type { BoonTable } from "../lib/bridge-metrics/boonGeneration";
import type { CriticalEvent, IntelligenceFinding } from "../lib/intelligence/types";
import type { EngagementSegment } from "../lib/intelligence/engagementTypes";

export interface ReportGuild {
    id: string;
    name: string | null;
    tag: string | null;
}

export interface ReportMeta {
    id: string;
    title: string;
    commanders: string[];
    dateStart: string;
    dateEnd: string;
    dateLabel: string;
    generatedAt: string;
    appVersion: string;
    /** Present when the squad's dominant guild could be resolved for this report. */
  guild?: ReportGuild | null;
    /** Names of report sections dropped to keep the payload under size limits. */
  trimmedSections?: string[];
}

export interface LeaderboardEntry {
    rank: number;
    account: string;
    profession: string;
    professionList: string[];
    value: number;
    count: number;
}

export type Leaderboards = Record<string, LeaderboardEntry[]>;

export interface MaxStat {
    value: number;
    player: string;
    count: number;
    /** Total tracked time (ms) the leading player was active across the fights behind `value`, for computing a true per-second rate instead of a per-fight average. */
  totalMs?: number;
    profession: string;
    professionList: string[];
}

export interface MvpTopStat {
    name: string;
    ratio: number;
    val: string;
    rank: number;
}

export interface MvpCard {
    account: string;
    profession: string;
    professionList: string[];
    reason?: string;
    topStats?: MvpTopStat[];
    score?: number;
    name?: string;
    /** Character name shown on the card (mirrors upstream `entry.name` -> `player`). */
  player?: string;
    /** Profession hex color used for the card accent. */
  color?: string;
    characterNames?: Record<string, unknown> | string[];
    downContrib?: number;
    cleanses?: number;
    strips?: number;
    stab?: number;
    healing?: number;
    barrier?: number;
    cc?: number;
    interrupts?: number;
    logsJoined?: number;
    totalDist?: number;
    distCount?: number;
    stackedLogCount?: number;
    dodges?: number;
    downs?: number;
    deaths?: number;
    kills?: number;
    enemyDowns?: number;
    damageTaken?: number;
    breakbar?: number;
}

export interface OffenseTotals {
    damage: number;
    /** Raw all-inclusive damage (EI's "All" column) including siege/NPC/gate hits - only populated for reports built after the sitewide All/Players toggle was added. */
  damageAll?: number;
    directDmg: number;
    connectedDamageCount: number;
    connectedDirectDamageCount: number;
    criticalRate: number;
    criticalDmg: number;
    flankingRate: number;
    glanceRate: number;
    missed: number;
    evaded: number;
    blocked: number;
    interrupts: number;
    invulned: number;
    killed: number;
    downed: number;
    againstDownedDamage: number;
    appliedCrowdControl: number;
    appliedCrowdControlDuration: number;
    appliedCrowdControlDownContribution: number;
    appliedCrowdControlDurationDownContribution: number;
    downContribution: number;
    boonStrips: number;
    battleStandardHits: number;
}

export interface OffensePlayer {
    account: string;
    profession: string;
    professionList: string[];
    offenseTotals: OffenseTotals;
    offenseRateWeights: Record<string, number>;
    totalFightMs: number;
}

export interface DefenseTotals {
    damageTaken: number;
    minionDamageTaken: number;
    damageTakenCount: number;
    conditionDamageTaken: number;
    conditionDamageTakenCount: number;
    powerDamageTaken: number;
    powerDamageTakenCount: number;
    [k: string]: number;
}

export interface DefensePlayer {
    account: string;
    profession: string;
    professionList: string[];
    defenseTotals: DefenseTotals;
    totalFightMs: number;
    [k: string]: unknown;
}

export interface SupportTotals {
    condiCleanse: number;
    condiCleanseTime: number;
    condiCleanseSelf: number;
    condiCleanseTimeSelf: number;
    boonStripsTime: number;
    boonStripDownContribution: number;
    boonStripDownContributionTime: number;
    stunBreak: number;
    removedStunDuration: number;
    resurrects: number;
    resurrectTime: number;
    boonStrips: number;
}

export interface SupportPlayer {
    account: string;
    profession: string;
    professionList: string[];
    supportTotals: SupportTotals;
    activeMs: number;
    logsJoined: number;
}

export interface HealingTotals {
    healing: number;
    squadHealing: number;
    groupHealing: number;
    selfHealing: number;
    offSquadHealing: number;
    barrier: number;
    squadBarrier: number;
    groupBarrier: number;
    selfBarrier: number;
    downedHealing: number;
    squadDownedHealing: number;
    groupDownedHealing: number;

  // --- Healing scaling classification (arcdps_healing_stats, via EI) ---
  // These three partition `healing`. Only meaningful when the source player was
  // running the heal addon (see HealingPlayer.healingCoverage).
  /** Healing that scales with the Healing Power stat - ordinary support healing. */
  healingPowerHealing: number;
    squadHealingPowerHealing: number;
    /**
     * Healing derived from damage dealt rather than the Healing Power stat: the
     * life-steal / life-siphon bucket (Signet of the Locust, vampiric effects).
     * Classification comes from the addon's own per-skill scaling table, so it does
     * not require Entropy to maintain a hard-coded skill list.
     */
  conversionHealing: number;
    squadConversionHealing: number;
    /** Healing that scales partially with Healing Power (e.g. Hungering Maelstrom). */
  hybridHealing: number;
    squadHybridHealing: number;
}

/**
 * How complete a player's healing figures are.
 *
 * The game only reports healing to the healing player's own client, so
 * arcdps_healing_stats can only record healing performed by someone running it.
 * A player without the addon still shows non-zero healing whenever they healed
 * an ally who *does* have it - that ally's client observed it. Such a figure is
 * a verified lower bound, never a total.
 *
 * - `full`    - player ran the addon; their outgoing healing is complete.
 * - `partial` - no addon; value is a floor. Render as "12,345+" and keep out of
 *               rankings, or rank with an explicit caveat.
 * - `none`    - no addon and nothing observed. This means UNKNOWN, not zero.
 */
export type HealingCoverage = 'full' | 'partial' | 'none';

export interface HealingPlayer {
    account: string;
    profession: string;
    professionList: string[];
    healingTotals: HealingTotals;
    activeMs: number;
    hasHealAddon: boolean;
    /**
     * Completeness of the figures above. Derived, never guessed - see HealingCoverage.
     * Optional because reports archived before this field existed will not carry it;
     * consumers should fall back to `hasHealAddon`.
     */
  healingCoverage?: HealingCoverage;
}

export interface GeneralPlayer {
    account: string;
    profession: string;
    professionList: string[];
    totalFightMs: number;
    squadActiveMs: number;
    totalDist: number;
    distCount: number;
    logsJoined: number;
    stackedLogCount: number;
}

export interface TeamBreakdown {
    teamId: string;
    count: number;
    color: string;
}

export interface FightRow {
    id: string;
    label: string;
    fullLabel: string;
    permalink?: string;
    timestamp: number;
    mapName: string;
    duration: string;
    isWin: boolean;
    squadCount: number;
    allyCount: number;
    enemyCount: number;
    teamBreakdown: TeamBreakdown[];
    alliesDown: number;
    alliesDead: number;
    alliesRevived: number;
    rallies: number;
    enemyDeaths: number;
    enemyDowns: number;
    totalOutgoingDamage: number;
    totalIncomingDamage: number;
    /** Outgoing healing performed by squad players during this fight. Present on reports built after v0.2.19. */
    totalOutgoingHealing?: number;
    /** Outgoing barrier generated by squad players during this fight. Present on reports built after v0.2.19. */
    totalOutgoingBarrier?: number;
    /** Healing + barrier - incoming damage for this fight. Positive means sustain outpaced pressure. */
    effectiveHealing?: number;
    totalOutgoingStrips: number;
    totalIncomingStrips: number;
    totalBoonsApplied: number;
    incomingBarrierAbsorbed: number;
    outgoingBarrierAbsorbed: number;
    squadClassCountsFight: Record<string, number>;
}

export interface TimelinePoint {
    timestamp: number;
    squadCount: number;
    friendlyCount: number;
    enemies: number;
    isWin: boolean;
    index: number;
    label: string;
}

export interface ClassSlice {
    name: string;
    value: number;
    color: string;
}

export interface TopSkill {
    name: string;
    /** Icon image URL from EI's skillMap, when available; falls back to a numeric badge in the UI when absent. */
  icon?: string;
    id: number;
    damage: number;
    hits: number;
    downContribution: number;
}

export interface CommanderRow {
    key: string;
    account: string;
    characterNames: string[];
    profession: string;
    professionList: string[];
    fights: number;
    wins: number;
    losses: number;
    winRatePct: number;
    totalDurationMs: number;
    avgSquadSize: number;
    avgEnemySize: number;
    kills: number;
    downs: number;
    commanderDowns: number;
    commanderDeaths: number;
    alliesDown: number;
    alliesDead: number;
    kdr: number;
    damageTaken: number;
    damageTakenPerMinute: number;
    incomingBarrierAbsorbed: number;
    incomingBarrierAbsorbedPerMinute?: number;
}

export interface RoleFactor {
    metric: string;
    value: number;
    median: number;
    ratio: number;
    weight: number;
    contribution: number;
}

export interface RoleClassification {
    account: string;
    profession: string;
    professionList: string[];
    role: 'support' | 'damage';
    supportScore: number;
    confidenceScore: number;
    threshold: number;
    factors: RoleFactor[];
}

export interface BoonUptimeColumn {
    id: number;
    name: string;
    icon?: string;
    /**
     * True for intensity-stacking buffs (Might, Stability, and every
     * condition). Elite Insights overloads its per-buff `uptime` field: for
     * duration-stacking buffs it is a percentage of the phase (0-100), but
     * for intensity-stacking buffs it is the AVERAGE NUMBER OF STACKS held,
     * which is not a percentage at all and must not be rendered with a %
     * suffix. dps.report makes the same split in its buff tables.
     */
  stacking?: boolean;
}

export interface BoonUptimeRow {
    account: string;
    profession: string;
    professionList: string[];
    group: number;
    logsJoined: number;
    /** boon id -> average % uptime (0-100) across the fights this player joined. */
  uptimes: Record<number, number>;
}

export interface BoonUptimeData {
    columns: BoonUptimeColumn[];
    rows: BoonUptimeRow[];
}

// --- Damage Modifiers (Buffs > Damage Modifiers, like dps.report) ---

export interface DamageModifierColumn {
    id: number;
    name: string;
    icon?: string;
    /** EI's own description of the trait/sigil/rune/skill this modifier represents (DamageModDesc.Description). */
  description?: string;
    /** From EI's DamageModDesc.NonMultiplier: false (the common case) means the value is a real, already-realized
     * damage gain from this modifier. True means the value is total damage done while the effect was active
     * (not the gain itself - the multiplier isn't known from the log). */
  nonMultiplier: boolean;
    /** From EI's DamageModDesc.IsCounter: true means the value is damage done while some condition held,
     * used as an informational count rather than a damage gain. */
  isCounter: boolean;
    /** How many of the tracked players triggered this modifier at least once - a rough read on how many were
     * actually running the trait/sigil/rune behind it (raw combat logs don't include full gear/trait builds,
     * only what measurably fired, so a 0 here doesn't prove a player *isn't* running it - just that it never
     * triggered for them this session). */
  playersWithIt: number;
}

export interface DamageModifierRow {
    account: string;
    profession: string;
    professionList: string[];
    group: number;
    /** modifier id -> { damage gained (or damage-under-effect for non-multiplicative mods), hits under the effect } */
  values: Record<number, { damage: number; hits: number }>;
}

export interface DamageModifierData {
    columns: DamageModifierColumn[];
    rows: DamageModifierRow[];
}

// --- Rotations (per-fight skill cast timeline, like dps.report's Rotations tab) ---

export interface RotationCast {
    skillId: number;
    castTime: number;
    duration: number;
}

export interface RotationPlayer {
    account: string;
    profession: string;
    professionList: string[];
    casts: RotationCast[];
}

export interface RotationFight {
    fightId: string;
    fightName: string;
    durationMs: number;
    /**
     * Skill ids that actually dealt damage in this fight, from EI's per-player
     * totalDamageDist. Cast timelines record everything pressed (weapon swaps,
     * dodges, resurrects, pure heals), so consumers explaining a damage spike
     * intersect casts against this set. Optional: reports built before this
     * field existed simply have no filter available.
     */
  damagingSkillIds?: number[];
    players: RotationPlayer[];
}

export interface RotationsData {
    skillMeta: Record<number, { name: string; icon?: string }>;
    fights: RotationFight[];
}

// --- DPS Graph (per-fight cumulative damage over time, like dps.report's Graph tab) ---

export interface DpsGraphPlayerSeries {
    account: string;
    profession: string;
    points: number[];
}

export interface DpsGraphFight {
    fightId: string;
    fightName: string;
    durationMs: number;
    /** Cumulative squad damage, one point per second. */
  squad: number[];
    players: DpsGraphPlayerSeries[];
}

export interface DpsGraphData {
    fights: DpsGraphFight[];
}

// --- Fight Replay (per-fight 2D scrubbable positions, promoted to a first-
// class dashboard page instead of only being reachable from the upload
// queue before a report is combined) ---

// --- Squad synergy auditing (automated insight flags computed from data
// Entropy already has - boon uptime, role classification, K/D) ---

export interface SynergyInsight {
    id: string;
    severity: 'good' | 'info' | 'warn' | 'critical';
    title: string;
    detail: string;
}

export interface ReplayFightEntry {
    fightId: string;
    fightName: string;
    data: import('../lib/parseReplayData').ReplayData;
}

// --- Mechanics Timeline (per-fight boss/encounter mechanic markers, like
// dps.report's Mechanics tab) ---

export interface MechanicDef {
    name: string;
    fullName: string;
    description?: string;
    /** EI's raw severity bucket, "Sev0" (informational) through "Sev4" (most severe). */
  severity: string;
}

export interface MechanicEvent {
    /** Milliseconds into the fight. */
  time: number;
    /** Character/actor name straight from the log. */
  actor: string;
    /** Resolved squad player account, when the actor matched a tracked player by character name. */
  account?: string;
    /** From EI's species id being 0 - true when the actor that triggered this event was a player. */
  isPlayer: boolean;
}

export interface MechanicTimelineEntry {
    key: string;
    def: MechanicDef;
    events: MechanicEvent[];
}

export interface MechanicsFight {
    fightId: string;
    fightName: string;
    durationMs: number;
    mechanics: MechanicTimelineEntry[];
}

export interface MechanicsData {
    fights: MechanicsFight[];
}

// --- Top Healing Sources (outgoing healing by skill/trait, including
// buff-triggered conversion heals like Replenishing Despair or a direct
// skill cast like Life Siphon) ---

export interface DeathRecapHit {
    id: number;
    name: string;
    icon?: string;
    isIndirect: boolean;
    src: string;
    damage: number;
    time: number;
}

export interface DeathRecapEntry {
    account: string;
    profession: string;
    characterName: string;
    fightName: string;
    fightIndex: number;
    deathTimeMs: number;
    /** Damaging events between entering combat and going down (empty if the player died outright without ever being downed). */
  toDown: DeathRecapHit[];
    /** Damaging events between going down and the final death blow. */
  toKill: DeathRecapHit[];
}

export interface FightHighlight {
    /** Stable category key (e.g. "blowout", "toughest", "longest", "outnumbered", "flawless", "mvp-moment") - not a display label. */
  id: string;
    title: string;
    /** Pre-written one-liner with the real numbers already filled in - no further formatting needed by the view. */
  description: string;
    fightName: string;
    fightIndex: number;
    timestamp: number;
    /** Only set for player-attributed highlights like MVP Moment. */
  account?: string;
    profession?: string;
    value?: number;
}

export interface TopHealingSource {
    id: number;
    name: string;
    icon?: string;
    healing: number;
    hits: number;
    /** True when this source is a trait/buff-triggered conversion heal (EI's IndirectHealing) rather than a directly-cast skill. */
  isTrait: boolean;
}

export interface ReportStats {
    total: number;
    wins: number;
    losses: number;
    avgSquadSize: number;
    avgEnemies: number;
    squadKDR: number;
    enemyKDR: number;
    totalSquadKills: number;
    totalSquadDeaths: number;
    totalEnemyKills: number;
    totalEnemyDeaths: number;
    totalSquadDowns: number;
    totalEnemyDowns: number;
    leaderboards: Leaderboards;
    maxDownContrib: MaxStat;
    maxBarrier: MaxStat;
    maxHealing: MaxStat;
    maxDodges: MaxStat;
    maxStrips: MaxStat;
    maxCleanses: MaxStat;
    maxCC: MaxStat;
    maxInterrupts: MaxStat;
    maxCCAndInterrupts: MaxStat;
    maxStab: MaxStat;
    closestToTag: MaxStat;
    topSkills: TopSkill[];
    topIncomingSkills: TopSkill[];
    topSkillsByDamage: TopSkill[];
    topSkillsByDownContribution: TopSkill[];
    mapData: ClassSlice[];
    timelineData: TimelinePoint[];
    offensePlayers: OffensePlayer[];
    defensePlayers: DefensePlayer[];
    supportPlayers: SupportPlayer[];
    healingPlayers: HealingPlayer[];
    /**
     * Per-player "who kept me alive?" attribution. Only populated for reports built
     * from raw logs that carry healing-extension data; absent otherwise. Each entry
     * carries its own coverage and attribution confidence — never render the
     * contributor split without checking them.
     */
  survivalSupport?: import('../lib/bridge-metrics/incomingHealing').IncomingHealingBreakdown[];
    generalPlayers: GeneralPlayer[];
    offensiveMvp: MvpCard;
    offensiveSilver: MvpCard;
    offensiveBronze: MvpCard;
    defensiveMvp: MvpCard;
    defensiveSilver: MvpCard;
    defensiveBronze: MvpCard;
    mvp: MvpCard;
    silver: MvpCard;
    bronze: MvpCard;
    squadClassData: ClassSlice[];
    enemyClassData: ClassSlice[];
    fightBreakdown: FightRow[];
    commanderStats: { rows: CommanderRow[] };
    roleClassifications: RoleClassification[];
    attendanceData: { account: string; characterNames: string[]; combatTimeMs: number; squadTimeMs: number; classTimes: { profession: string; timeMs: number }[] }[];
    /** Only populated for reports built from raw logs (RawLogImporter); absent on classic report.json files. */
  boonUptimes?: BoonUptimeData;
    /** Uptime tables for every EI buff classification (Boon, Condition, Offensive, Defensive, Support, Debuff, Gear, Enhancement, Nourishment, Other Consumable, Other), keyed by classification name. Raw-log reports only. */
  buffCategoryUptimes?: Record<string, BoonUptimeData>;
    /** Per-player damage modifier (trait/sigil/rune) contribution table. Raw-log reports only. */
  damageModifiers?: DamageModifierData;
    /** Per-fight skill cast timelines. Raw-log reports only. */
  rotations?: RotationsData;
    /** Per-fight cumulative damage-over-time series. Raw-log reports only. */
  dpsGraph?: DpsGraphData;
    /** Per-fight 2D scrubbable position replays (only for fights whose parse included combat replay data). Raw-log reports only. */
  replayFights?: ReplayFightEntry[];
    /** Automated squad-composition/performance insight flags. Raw-log reports only. */
  synergyInsights?: SynergyInsight[];
    /** Per-fight boss/encounter mechanic event markers. Raw-log reports only. */
  mechanics?: MechanicsData;
    /** Top outgoing healing sources by skill/trait, squad-wide. Only populated when the log was recorded with the healing addon active. Raw-log reports only. */
  topHealingSkills?: TopHealingSource[];
    /** Per-death damage breakdown (what actually killed each player, and what put them down first) for every squad death across all fights. Raw-log reports only. */
  deathRecaps?: DeathRecapEntry[];
    /** Self- vs. group- vs. squad-generation split for every boon, per player. Distinct from buffCategoryUptimes (which shows what a player *had*, not what they *generated*). Raw-log reports only. */
  buffGeneration?: BoonTable[];
    /** Auto-generated standout-moment cards (biggest blowout, toughest fight, longest engagement, etc.), one set per report. Raw-log reports only. */
  fightHighlights?: FightHighlight[];
    /** Persisted v2.5 intelligence events generated during raw-log report building. Old reports omit these fields. */
  criticalEvents?: CriticalEvent[];
    /** Persisted v2.5 engagement segments generated from timestamped combat events and critical events. Old reports omit this field. */
  engagementSegments?: EngagementSegment[];
    /** Persisted v2.5 evidence-backed findings. Old reports omit this field. */
  intelligenceFindings?: IntelligenceFinding[];
    offensiveAvgMvpScore: number;
    defensiveAvgMvpScore: number;
    avgMvpScore: number;
    colorPalette: string;
    [k: string]: unknown;
}

export interface WvWReport {
    meta: ReportMeta;
    stats: ReportStats;
}

export interface ReportIndexEntry {
    id: string;
    title: string;
    commanders: string[];
    dateStart: string;
    dateEnd: string;
    dateLabel: string;
    url: string;
    summary: {
      borderlandsPct: number;
      mapSlices: ClassSlice[];
      avgSquadSize: number;
      avgEnemySize: number;
    };
}

export interface ReportIndex {
    colorPalette: string;
    glassSurfaces: boolean;
    glassmorphic: boolean;
    entries: ReportIndexEntry[];
}
