import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export function SortableHeader<T extends string>({
  align = "left",
  children,
  className = "",
  label,
  onSort,
  sortKey,
  state,
  title,
}: {
  align?: "left" | "center" | "right";
  children?: ReactNode;
  className?: string;
  label?: ReactNode;
  onSort: (key: T) => void;
  sortKey: T;
  state: { key: T; dir: SortDirection } | null;
  title?: string;
}) {
  const active = state?.key === sortKey;
  const ariaSort = active ? (state.dir === "asc" ? "ascending" : "descending") : "none";
  const sortLabel = !active ? "Sort" : state.dir === "desc" ? "Descending" : "Ascending";
  const alignmentClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const buttonAlignmentClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";

  return (
    <th scope="col" aria-sort={ariaSort} className={`theme-sortable-header p-2.5 ${alignmentClass} ${className}`} title={title}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`theme-sortable-header-button ${buttonAlignmentClass}`}
      >
        <span>{label ?? children}</span>
        <span className="theme-sortable-header-state">{sortLabel}</span>
      </button>
    </th>
  );
}
