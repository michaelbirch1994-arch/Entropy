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
    <img
      src={src}
      alt={title ?? name}
      title={title ?? name}
      width={384}
      height={384}
      decoding="async"
      loading="lazy"
      draggable={false}
      className={clsx(
        "class-icon-native image-crisp inline-block shrink-0 object-contain align-middle",
        SIZE_CLASS[size],
        className,
      )}
    />
  );
}
