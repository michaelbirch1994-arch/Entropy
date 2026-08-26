import clsx from "clsx";
import ProfessionIcon from "./ProfessionIcon";
import { profStyle } from "../../utils/format";

type ProfessionIdentitySize = "sm" | "md";

const ICON_SIZE: Record<ProfessionIdentitySize, string> = {
  sm: "h-[18px] w-[18px]",
  md: "h-5 w-5",
};

export default function ProfessionIdentity({
  profession,
  size = "md",
  showName = true,
  className,
}: {
  profession: string | undefined | null;
  size?: ProfessionIdentitySize;
  showName?: boolean;
  className?: string;
}) {
  const label = profession || "Unknown";
  const style = profStyle(label);

  return (
    <span
      className={clsx(
        "theme-profession-identity inline-flex items-center gap-1.5 rounded bg-transparent px-0 py-0 text-[10px] font-bold leading-none",
        style.text,
        className,
      )}
      title={label}
    >
      <ProfessionIcon profession={label} className={clsx("shrink-0", ICON_SIZE[size])} />
      {showName && <span className="whitespace-nowrap">{label}</span>}
    </span>
  );
}
