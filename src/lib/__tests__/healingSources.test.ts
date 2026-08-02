// Regression test for the Top Skills "healing" tab's cross-map name/icon
// lookup gap fixed in buildReportFromFights.ts (computeTopHealingSkills).
//
// Ground truth used here (verified against the live GW2 wiki, not assumed):
// - Replenishing Despair: Revenant Corruption trait, id 1741. Its triggered
//   "trait skill" effect - which siphons health from nearby enemies when the
//   revenant gains dark aura - has id 76497.
//   https://wiki.guildwars2.com/wiki/Replenishing_Despair
//   https://wiki.guildwars2.com/wiki/Replenishing_Despair_(trait_skill)
// - Life Siphon: Necromancer main-hand dagger skill, id 69302. A directly
//   cast, channeled-then-pulsing skill that deals damage and heals its
//   caster per pulse.
//   https://wiki.guildwars2.com/wiki/Life_Siphon
//
// The bug: computeTopHealingSkills used entry.indirectHealing to decide
// *which single map* (skillMap vs buffMap) to look an id's name/icon up in,
// with no fallback to the other map - unlike computeTopSkills, which merges
// both maps precisely because EI's attribution ids aren't reliably confined
// to the map you'd naively expect (see that function's own comment re:
// condition-damage ticks). Since "trait skills" like Replenishing Despair
// behave like triggered skills in the combat log despite indirectHealing
// possibly being reported as true (buff-attributed), the strict either/or
// lookup could resolve to a bare fallback label ("Trait 76497") with no
// icon even when the real name/icon existed in the *other* map. This test
// constructs both permutations (a "trait" entry whose metadata is only in
// skillMap, and a "skill" entry whose metadata is only in buffMap) to prove
// the merged lookup resolves correctly regardless of which map actually
// holds an id's metadata - without asserting anything about what real EI
// output looks like beyond the two verified IDs above.
import { describe, it, expect } from "vitest";
import { buildReportFromFights, type FightInput } from "../buildReportFromFights";
import type { RawFightLog, RawFightSummary } from "../../types/rawFight";

const REPLENISHING_DESPAIR_TRAIT_SKILL_ID = 76497;
const LIFE_SIPHON_SKILL_ID = 69302;

function makeFight(): FightInput {
  const raw = {
    fightName: "Test Fight",
    duration: "1:00",
    success: true,
    recordedBy: "Tester.1234",
    // Deliberately put Replenishing Despair's metadata only in skillMap
    // (simulating EI filing a "trait skill" there even though
    // indirectHealing=true would naively point at buffMap), and Life
    // Siphon's metadata only in buffMap (the opposite permutation) - this
    // is what actually forces the cross-map fallback path to run.
    skillMap: {
      [`s${REPLENISHING_DESPAIR_TRAIT_SKILL_ID}`]: { name: "Replenishing Despair", icon: "replenishing-despair.png" },
    },
    buffMap: {
      [`b${LIFE_SIPHON_SKILL_ID}`]: { name: "Life Siphon", icon: "life-siphon.png" },
    },
    players: [
      {
        name: "Test Revenant",
        account: "Tester.1234",
        profession: "Revenant",
        notInSquad: false,
        extHealingStats: {
          totalHealingDist: [
            [
              // indirectHealing: true because Replenishing Despair is a
              // triggered trait effect, not a hand-cast weapon skill -
              // this is what makes the old code look in buffMap only.
              { id: REPLENISHING_DESPAIR_TRAIT_SKILL_ID, totalHealing: 4530, hits: 5, indirectHealing: true },
              // indirectHealing: false because Life Siphon is a directly
              // cast skill - this is what made the old code look in
              // skillMap only, missing the buffMap-only metadata here.
              { id: LIFE_SIPHON_SKILL_ID, totalHealing: 8100, hits: 9, indirectHealing: false },
            ],
          ],
        },
      },
    ],
  };

  const summary: RawFightSummary = {
    fightName: "Test Fight",
    duration: "1:00",
    success: true,
    recordedBy: "Tester.1234",
    timeStart: null,
    squadSize: 1,
    totalPlayers: 1,
    commander: null,
  };

  return { summary, raw: raw as unknown as RawFightLog };
}

describe("computeTopHealingSkills cross-map lookup (Replenishing Despair / Life Siphon)", () => {
  const report = buildReportFromFights([makeFight()]);
  const sources = report.stats.topHealingSkills ?? [];

  it("resolves Replenishing Despair's name/icon even though indirectHealing pointed at buffMap and the metadata was only in skillMap", () => {
    const entry = sources.find((s) => s.id === REPLENISHING_DESPAIR_TRAIT_SKILL_ID);
    expect(entry).toBeTruthy();
    expect(entry?.name).toBe("Replenishing Despair");
    expect(entry?.icon).toBe("replenishing-despair.png");
    expect(entry?.healing).toBe(4530);
  });

  it("resolves Life Siphon's name/icon even though indirectHealing pointed at skillMap and the metadata was only in buffMap", () => {
    const entry = sources.find((s) => s.id === LIFE_SIPHON_SKILL_ID);
    expect(entry).toBeTruthy();
    expect(entry?.name).toBe("Life Siphon");
    expect(entry?.icon).toBe("life-siphon.png");
    expect(entry?.healing).toBe(8100);
  });
});
