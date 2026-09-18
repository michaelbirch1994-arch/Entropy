export default function SelectionIndicator({ variant = "tab" }: {
  id: string;
  variant?: "tab" | "navigation";
}) {
  return <span
    aria-hidden="true"
    className={`entropy-selection-indicator is-${variant}`}
  />;
}
