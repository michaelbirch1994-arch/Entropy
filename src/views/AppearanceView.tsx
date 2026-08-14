import { Check, Palette } from "lucide-react";
import Panel from "../components/ui/Panel";
import { themePresets, type ThemePreset } from "../theme/themePresets";
import { useTheme } from "../theme/ThemeProvider";

function ThemeSwatch({ theme }: { theme: ThemePreset }) {
  const c = theme.colors;
  const layout =
    theme.slug === "siege-ember" ? "grid-cols-[1.4fr_0.8fr]" :
    theme.slug === "void-signal" ? "grid-cols-4" :
    theme.slug === "steel-depth" ? "grid-cols-2" :
    theme.slug === "night-ops" ? "grid-cols-1" :
    "grid-cols-6";

  return (
    <div
      className="mt-4 overflow-hidden rounded-lg border p-3"
      style={{
        background: c.bg,
        borderColor: c.border,
        color: c.text,
        boxShadow: `0 0 26px -12px ${c.glow}`,
        fontFamily: theme.typography.body,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className="h-8 w-8 rounded-md border"
          style={{
            background: `linear-gradient(135deg, ${c.accent}, ${c.secondary})`,
            borderColor: c.accentDim,
            boxShadow: `0 0 18px -6px ${c.glow}`,
          }}
        />
        <div className="flex-1">
          <div
            className="text-[10px] font-black uppercase"
            style={{ color: c.text, fontFamily: theme.typography.display }}
          >
            Squad Readout
          </div>
          <div className="mt-1 h-1.5 rounded-full" style={{ background: c.grid }}>
            <div className="h-1.5 w-2/3 rounded-full" style={{ background: c.accent }} />
          </div>
        </div>
        <div className="text-right font-mono text-[11px] font-bold" style={{ color: c.accentStrong }}>
          84
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[c.accent, c.secondary, c.surfaceElevated].map((color) => (
          <div
            key={color}
            className="h-7 rounded-md border"
            style={{ background: color, borderColor: c.grid }}
          />
        ))}
      </div>
      <div className={`mt-3 grid ${layout} gap-1.5`}>
        {Array.from({ length: theme.slug === "night-ops" ? 3 : theme.slug === "void-signal" ? 8 : 6 }).map((_, index) => (
          <div
            key={index}
            className={
              theme.slug === "siege-ember" && index === 0 ? "h-8 rounded-sm border" :
              theme.slug === "war-room-gold" && index < 2 ? "col-span-3 h-8 rounded-sm border" :
              "h-5 rounded-sm border"
            }
            style={{
              background: index % 2 === 0 ? c.surfaceElevated : c.surface,
              borderColor: index === 0 ? c.accent : c.grid,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AppearanceView() {
  const { activeThemeSlug, setTheme } = useTheme();

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Appearance"
        subtitle="Choose the combat operations theme used across Entropy."
        icon={<Palette className="h-4 w-4" />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {themePresets.map((theme) => {
            const isActive = theme.slug === activeThemeSlug;
            return (
              <button
                key={theme.slug}
                type="button"
                onClick={() => setTheme(theme.slug)}
                aria-pressed={isActive}
                className={`theme-swatch-card group text-left ${isActive ? "is-active" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-sm font-black uppercase tracking-wider text-theme-text">
                      {theme.name}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-theme-muted">{theme.description}</p>
                  </div>
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border transition ${
                      isActive ? "border-theme-accent bg-theme-accent/15 text-theme-accent" : "border-theme-border text-theme-muted"
                    }`}
                  >
                    {isActive && <Check className="h-4 w-4" />}
                  </span>
                </div>
                <ThemeSwatch theme={theme} />
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
