interface EntropyLogoProps {
  className?: string;
  size?: number;
}

/**
 * Custom Entropy mark: a stable core ring on the left breaking apart into
 * scattering fragments and orbiting particles toward the right — a visual
 * metaphor for entropy (order dissolving into disorder), rendered as a
 * scalable vector so it stays crisp at any badge size and can pick up glow
 * filters / currentColor theming from its container.
 */
export default function EntropyLogo({ className = "", size = 24 }: EntropyLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Entropy"
    >
      <defs>
        <linearGradient id="entropy-logo-grad" x1="4" y1="24" x2="44" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="65%" stopColor="currentColor" stopOpacity="0.85" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Intact core ring (order) */}
      <circle cx="15" cy="24" r="10.5" stroke="url(#entropy-logo-grad)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="15" cy="24" r="2.4" fill="currentColor" />

      {/* Ring fracturing into arcs as it moves outward (disorder) */}
      <path d="M27 15.5 A10.5 10.5 0 0 1 33.5 20.5" stroke="currentColor" strokeOpacity="0.75" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M31.5 29.5 A10.5 10.5 0 0 1 25 34.8" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />

      {/* Scattering fragments / particles trailing off to the right */}
      <circle cx="37" cy="14" r="1.7" fill="currentColor" fillOpacity="0.85" />
      <circle cx="41.5" cy="21" r="1.3" fill="currentColor" fillOpacity="0.65" />
      <circle cx="39" cy="30" r="1.5" fill="currentColor" fillOpacity="0.5" />
      <circle cx="33" cy="37" r="1.1" fill="currentColor" fillOpacity="0.4" />
      <circle cx="44" cy="26" r="0.9" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}
