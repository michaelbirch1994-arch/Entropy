// Types matching the AxiBridge WvW report.json structure.

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
}

export interface HealingPlayer {
  account: string;
  profession: string;
  professionList: string[];
  healingTotals: HealingTotals;
  activeMs: number;
  hasHealAddon: boolean;
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
  icon: number;
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
  /** Only populated for reports built from raw logs (RawLogImporter); absent on classic AxiBridge report.json files. */
  boonUptimes?: BoonUptimeData;
  /** Uptime tables for every EI buff classification (Boon, Condition, Offensive, Defensive, Support, Debuff, Gear, Enhancement, Nourishment, Other Consumable, Other), keyed by classification name. Raw-log reports only. */
  buffCategoryUptimes?: Record<string, BoonUptimeData>;
  /** Per-player damage modifier (trait/sigil/rune) contribution table. Raw-log reports only. */
  damageModifiers?: DamageModifierData;
  /** Per-fight skill cast timelines. Raw-log reports only. */
  rotations?: RotationsData;
  /** Per-fight cumulative damage-over-time series. Raw-log reports only. */
  dpsGraph?: DpsGraphData;
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
