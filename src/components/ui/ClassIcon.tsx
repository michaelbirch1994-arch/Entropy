import clsx from "clsx";
import { classIconSrc } from "../../data/classIconAssets";

type ClassIconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<ClassIconSize, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export default function ClassIcon({
  name,
  size = "sm",
  className,
  title,
}: {
  name: string | undefined | null;
  size?: ClassIconSize;
  className?: string;
  title?: string;
}) {
  const src = classIconSrc(name);
  if (!src || !name) return null;

  return (
    <span
      role="img"
      aria-label={title ?? name}
      title={title ?? name}
      className={clsx(
        "class-icon-frame inline-flex shrink-0 items-center justify-center overflow-hidden align-middle",
        SIZE_CLASS[size],
        className,
      )}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={384}
        height={384}
        decoding="async"
        loading="lazy"
        draggable={false}
        className="class-icon-native h-full w-full"
      />
    </span>
  );
}
