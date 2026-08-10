// Renders a profession/elite-spec icon as an inline SVG from locally vendored
// path data (src/data/professionIcons.ts) instead of hotlinking
// render.guildwars2.com PNGs. The silhouettes are local assets; the default
// color palette matches the flat square class icons used for Entropy's visual
// class language.
import { PROFESSION_ICON_DATA } from "../../data/professionIcons";
import { PROFESSION_FAMILY } from "../../utils/format";

// Elite-spec profession values map to a lowercase family key in
// PROFESSION_FAMILY (e.g. "Dragonhunter" -> "guardian"); this maps that
// family key back to the capitalized base-profession key used in
// PROFESSION_ICON_DATA, so unmapped/legacy profession strings still fall
// back to a recognizable base icon instead of rendering nothing.
const FAMILY_TO_BASE: Record<string, string> = {
  guardian: "Guardian",
  warrior: "Warrior",
  revenant: "Revenant",
  engineer: "Engineer",
  ranger: "Ranger",
  thief: "Thief",
  elementalist: "Elementalist",
  necro: "Necromancer",
  mesmer: "Mesmer",
};

// Sampled from the supplied 384px flat class/spec PNG set. Keeping this local
// avoids runtime image fetches and keeps every class icon visually consistent
// whether it renders inside a chip, table, card, or squad builder slot.
const FAMILY_ICON_COLOR: Record<string, string> = {
  guardian: "#2bbee3",
  warrior: "#f9be40",
  revenant: "#a1261d",
  engineer: "#c97230",
  ranger: "#88d828",
  thief: "#c8717c",
  elementalist: "#e94045",
  necro: "#00d87d",
  mesmer: "#b844e4",
};

export default function ProfessionIcon({
  profession,
  className = "w-4 h-4",
  monochrome = false,
}: {
  profession: string;
  className?: string;
  /** Use surrounding text color instead of Entropy's profession palette. */
  monochrome?: boolean;
}) {
  const family = PROFESSION_FAMILY[profession];
  const data = PROFESSION_ICON_DATA[profession] ?? PROFESSION_ICON_DATA[FAMILY_TO_BASE[family ?? ""] ?? ""];
  if (!data) return null;

  const [x, y, w, h] = data.viewBox;
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      className={className}
      fill="currentColor"
      aria-hidden="true"
      style={!monochrome && family ? { color: FAMILY_ICON_COLOR[family] } : undefined}
    >
      <path d={data.path} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}
