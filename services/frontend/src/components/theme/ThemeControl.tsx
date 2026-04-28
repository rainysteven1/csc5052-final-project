import { useEffect, useRef, useState } from "react";
import { ChevronDown, Palette, Settings2 } from "lucide-react";

import { ThemeSettingsDrawer } from "@/components/theme/ThemeSettingsDrawer";
import { getThemePreset } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme-store";
import { Badge } from "@/components/ui/badge";

export function ThemeControl() {
  const presetId = useThemeStore((state) => state.presetId);
  const activePreset = getThemePreset(presetId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          className={cn(
            "flex h-[54px] min-w-[180px] items-center gap-3 rounded-[20px] glass-panel-strong px-4 py-2.5 text-left transition-all",
            menuOpen
              ? "border-primary ring-2 ring-primary/15"
              : "hover:bg-secondary/35",
          )}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className="rounded-full bg-primary/10 p-2 text-primary">
            <Settings2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="ui-label-xs block text-muted-foreground">
              Theme
            </span>
            <span className="block truncate text-sm font-medium text-foreground">
              {activePreset.label}
            </span>
          </span>
          <span className="shrink-0">
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                menuOpen && "rotate-180",
              )}
            />
          </span>
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-full z-[60] mt-3 w-[320px] rounded-[24px] border border-border/80 bg-card p-3 shadow-2xl">
            <div className="rounded-[20px] border border-border/60 bg-secondary/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-label-xs text-muted-foreground">
                    Current palette
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {activePreset.label}
                  </div>
                </div>
                <Badge variant="outline">Live</Badge>
              </div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                {activePreset.description}
              </div>
            </div>

            <button
              type="button"
              className="mt-3 flex w-full items-center justify-between rounded-[20px] border border-border/70 bg-card px-4 py-3 text-left transition-all hover:bg-secondary/28"
              onClick={() => {
                setMenuOpen(false);
                setDrawerOpen(true);
              }}
            >
              <div className="flex items-start gap-3">
                <span className="rounded-full bg-accent/12 p-2 text-accent">
                  <Palette className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-medium text-foreground">
                    Open theme panel
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    Change preset and panel contrast.
                  </span>
                </span>
              </div>
              <ChevronDown className="-rotate-90 h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : null}
      </div>

      <ThemeSettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
