// Renders a profession/elite-spec icon as an inline SVG from locally vendored
// path data (src/data/professionIcons.ts) instead of hotlinking
// render.guildwars2.com PNGs. Uses currentColor so it automatically matches
// whatever text color class (e.g. profChip()) wraps it.
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

export default function ProfessionIcon({
  profession,
  className = "w-4 h-4",
}: {
  profession: string;
  className?: string;
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
    >
      <path d={data.path} />
    </svg>
  );
}
