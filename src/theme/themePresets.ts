export type ThemeSlug = "siege-ember" | "void-signal" | "steel-depth" | "night-ops" | "war-room-gold";

export interface ThemePreset {
  slug: ThemeSlug;
  name: string;
  description: string;
  motion: "steady" | "signal" | "ember";
  typography: {
    display: string;
    body: string;
    mono: string;
  };
  colors: {
    bg: string;
    surface: string;
    surfaceElevated: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentDim: string;
    accentStrong: string;
    secondary: string;
    danger: string;
    warning: string;
    success: string;
    info: string;
    grid: string;
    glow: string;
  };
}

export const themePresets: ThemePreset[] = [
  {
    slug: "siege-ember",
    name: "Siege Ember",
    description: "Molten, high-stakes, built for the moment of a push.",
    motion: "ember",
    typography: {
      display: "\"Fraunces\", \"Space Grotesk\", serif",
      body: "\"Inter\", system-ui, -apple-system, sans-serif",
      mono: "\"JetBrains Mono\", \"Fira Code\", ui-monospace, monospace",
    },
    colors: {
      bg: "#0A0705",
      surface: "#17100C",
      surfaceElevated: "#21150E",
      border: "#7A2E10",
      text: "#F2E9DD",
      textMuted: "#8C8178",
      accent: "#FF5A1F",
      accentDim: "#7A2E10",
      accentStrong: "#FF8A3D",
      secondary: "#B34B1D",
      danger: "#FF4A2F",
      warning: "#F0A93B",
      success: "#7DBB73",
      info: "#62B6D9",
      grid: "#2B1A12",
      glow: "rgba(255, 90, 31, 0.32)",
    },
  },
  {
    slug: "void-signal",
    name: "Void Signal",
    description: "Cold, precise, built for coordination data.",
    motion: "signal",
    typography: {
      display: "\"Space Grotesk\", \"Inter\", sans-serif",
      body: "\"Inter\", system-ui, -apple-system, sans-serif",
      mono: "\"JetBrains Mono\", \"Fira Code\", ui-monospace, monospace",
    },
    colors: {
      bg: "#06070D",
      surface: "#10121D",
      surfaceElevated: "#16192A",
      border: "#23263A",
      text: "#E4E6F5",
      textMuted: "#8F93AF",
      accent: "#7B5CFF",
      accentDim: "#3A3276",
      accentStrong: "#3DDCFF",
      secondary: "#3DDCFF",
      danger: "#FF5C8A",
      warning: "#F5BC4F",
      success: "#3DDC9C",
      info: "#3DDCFF",
      grid: "#23263A",
      glow: "rgba(123, 92, 255, 0.34)",
    },
  },
  {
    slug: "steel-depth",
    name: "Steel Depth",
    description: "Cold, industrial, built for mitigation and structural data.",
    motion: "steady",
    typography: {
      display: "\"IBM Plex Sans\", \"Inter\", sans-serif",
      body: "\"IBM Plex Sans\", \"Inter\", system-ui, sans-serif",
      mono: "\"JetBrains Mono\", \"Fira Code\", ui-monospace, monospace",
    },
    colors: {
      bg: "#0B1113",
      surface: "#131C1F",
      surfaceElevated: "#192528",
      border: "#4A5558",
      text: "#DCE8E9",
      textMuted: "#8FA0A3",
      accent: "#3FA9B0",
      accentDim: "#1D5559",
      accentStrong: "#7AD4D8",
      secondary: "#89A3A8",
      danger: "#D45C55",
      warning: "#C9A24A",
      success: "#74B87C",
      info: "#6AAFC4",
      grid: "#263235",
      glow: "rgba(63, 169, 176, 0.24)",
    },
  },
  {
    slug: "night-ops",
    name: "Night Ops",
    description: "Noir, quiet, built for scouting and small-group havoc data.",
    motion: "steady",
    typography: {
      display: "\"Playfair Display\", \"Fraunces\", serif",
      body: "\"Inter\", system-ui, -apple-system, sans-serif",
      mono: "\"JetBrains Mono\", \"Fira Code\", ui-monospace, monospace",
    },
    colors: {
      bg: "#08070A",
      surface: "#121013",
      surfaceElevated: "#1A171B",
      border: "#353039",
      text: "#D8D3D6",
      textMuted: "#6B6570",
      accent: "#C4402E",
      accentDim: "#5A211B",
      accentStrong: "#E8B34C",
      secondary: "#6B6570",
      danger: "#C4402E",
      warning: "#E8B34C",
      success: "#7C9A78",
      info: "#8C96A0",
      grid: "#242026",
      glow: "rgba(196, 64, 46, 0.18)",
    },
  },
  {
    slug: "war-room-gold",
    name: "War Room Gold",
    description: "Warm, authoritative, built for overview and roster command.",
    motion: "steady",
    typography: {
      display: "\"Fraunces\", \"Space Grotesk\", serif",
      body: "\"Inter\", system-ui, -apple-system, sans-serif",
      mono: "\"JetBrains Mono\", \"Fira Code\", ui-monospace, monospace",
    },
    colors: {
      bg: "#100D08",
      surface: "#1B160D",
      surfaceElevated: "#2A2114",
      border: "#6B5227",
      text: "#EDE3D0",
      textMuted: "#9C8D73",
      accent: "#C9974A",
      accentDim: "#6B5227",
      accentStrong: "#F0C36D",
      secondary: "#A77B3E",
      danger: "#C95C4A",
      warning: "#DDAA4B",
      success: "#8FAC6D",
      info: "#78A9B5",
      grid: "#322817",
      glow: "rgba(201, 151, 74, 0.28)",
    },
  },
];

export const DEFAULT_THEME: ThemeSlug = "siege-ember";

export function getThemePreset(slug: string | null | undefined): ThemePreset {
  return themePresets.find((theme) => theme.slug === slug) ?? themePresets[0];
}
