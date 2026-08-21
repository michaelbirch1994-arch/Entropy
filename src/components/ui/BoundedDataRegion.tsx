import type { ReactNode } from "react";
import clsx from "clsx";

type BoundedDataRegionProps = {
  label: string;
  children: ReactNode;
  className?: string;
  maxHeightClass?: string;
  itemCount?: number;
  scrollAxes?: "y" | "both";
};

/**
 * Keeps long drill-down feeds usable without removing or paginating their data.
 * The region remains keyboard focusable and exposes an accessible label so the
 * nested scroll area is discoverable to keyboard and assistive-technology users.
 */
export default function BoundedDataRegion({
  label,
  children,
  className,
  maxHeightClass = "max-h-[38rem]",
  itemCount,
  scrollAxes = "y",
}: BoundedDataRegionProps) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      data-item-count={itemCount}
      className={clsx(
        "custom-scrollbar overscroll-contain rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05090d]",
        scrollAxes === "both" ? "overflow-auto" : "overflow-y-auto",
        maxHeightClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
