import { useRef, useState } from "react";
import {
  IoAdd,
  IoCheckmarkCircle,
  IoColorPalette,
  IoFolderOpenOutline,
  IoRefresh,
  IoTrashOutline,
  IoWarningOutline,
} from "react-icons/io5";
import Container from "@/ui/settings/Container";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUserThemesStore } from "@/stores/userThemesStore";
import {
  BUILT_IN_COLOR_THEMES,
  resolveColorTheme,
  type ResolvedColorTheme,
} from "@/lib/colorThemes";
import { isTauri } from "@/lib/tauriEnv";
import type { ColorThemeFile } from "@/types";
import Button from "@/ui/Button";

/**
 * Every available color theme as a list, each with a light and a dark
 * miniature of the app painted from that theme's resolved palette. Custom
 * themes come from the user's themes folder (see userThemesStore).
 */
export function ColorThemePicker() {
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  const customColorThemes = useSettingsStore((s) => s.customColorThemes);
  const setColorTheme = useSettingsStore((s) => s.setColorTheme);
  const { dir, createTheme, entries, loading, error, reload, importFile, deleteTheme, openFolder } =
    useUserThemesStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const hasFolder = isTauri();

  const themes: { theme: ColorThemeFile; custom: boolean }[] = [
    ...BUILT_IN_COLOR_THEMES.map((theme) => ({ theme, custom: false })),
    ...customColorThemes.map((theme) => ({ theme, custom: true })),
  ];
  const brokenFiles = entries.filter((e) => e.errors?.length);

  return (
    <Container>
      <Container.Header icon={<IoColorPalette />} heading="Color theme" />
      <Container.Body className="space-y-4 px-4 py-4">
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {themes.map(({ theme, custom }) => {
            const selected = colorTheme === theme.id;
            const resolved = resolveColorTheme(theme.id, customColorThemes);
            return (
              <li
                key={theme.id}
                className={`flex items-center pr-2 transition-colors ${
                  selected ? "bg-accent-soft" : "bg-surface hover:bg-sunken"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setColorTheme(theme.id)}
                  aria-pressed={selected}
                  className="flex min-w-0 flex-1 items-center gap-4 p-3 text-left"
                >
                  <span className="flex shrink-0 gap-1.5">
                    <ThemePreview theme={resolved} mode="light" />
                    <ThemePreview theme={resolved} mode="dark" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {theme.name}
                      </span>
                      <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {custom ? "Custom" : "Built-in"}
                      </span>
                    </span>
                    {theme.description ? (
                      <span className="block text-[11px] leading-snug text-muted">
                        {theme.description}
                      </span>
                    ) : null}
                    {theme.author ? (
                      <span className="block text-[11px] text-faint">
                        by {theme.author}
                        {theme.version ? ` · v${theme.version}` : ""}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <IoCheckmarkCircle className="shrink-0 text-lg text-accent" aria-label="Active" />
                  ) : null}
                </button>
                {custom ? (
                  <button
                    type="button"
                    onClick={() => void deleteTheme(theme.id)}
                    aria-label={`Delete ${theme.name}`}
                    title={hasFolder ? "Delete theme file" : "Remove theme"}
                    className="shrink-0 rounded-md p-1.5 text-faint hover:bg-danger-soft hover:text-danger"
                  >
                    <IoTrashOutline />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {brokenFiles.length > 0 ? (
          <div className="space-y-2 rounded-lg bg-warn-soft px-3 py-2">
            {brokenFiles.map((file) => (
              <div key={file.fileName} className="text-[11px] text-warn">
                <div className="flex items-center gap-1.5 font-semibold">
                  <IoWarningOutline aria-hidden />
                  {file.fileName} was skipped
                </div>
                <ul className="ml-5 list-disc">
                  {file.errors!.slice(0, 4).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">

          {hasFolder ? (
            <>
              <Button
                type="button"
                onClick={() => void openFolder()}
              >
                <IoFolderOpenOutline aria-hidden />
                Show themes folder
              </Button>
              <Button onClick={() => void createTheme()}>
                <IoAdd /> Create New Template
              </Button>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={loading}
                aria-label="Rescan themes folder"
                title="Rescan themes folder"
                className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink"
              >
                <IoRefresh className={loading ? "animate-spin" : ""} />
              </button>
            </>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setImportErrors(await importFile(file));
            }}
          />
        </div>



        {importErrors.length > 0 || error ? (
          <ul className="space-y-0.5 rounded-lg bg-danger-soft px-3 py-2 text-[11px] text-danger">
            {error ? <li>{error}</li> : null}
            {importErrors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </Container.Body>
    </Container>
  );
}

/** A miniature app window: sidebar, a card with tasks, an accent button. */
function ThemePreview({
  theme,
  mode,
}: {
  theme: ResolvedColorTheme;
  mode: "light" | "dark";
}) {
  const c = theme.colors[mode];
  const sidebar = theme.components[mode]["sidebar-bg"] ?? c.sunken;
  return (
    <span
      className="flex h-[64px] w-[92px] overflow-hidden rounded-md"
      style={{ background: c.canvas, border: `1px solid ${c.line}` }}
      aria-hidden
    >
      <span
        className="flex w-[22px] flex-col gap-1 px-1 pt-2"
        style={{ background: sidebar, borderRight: `1px solid ${c.line}` }}
      >
        <span className="h-1 rounded-full" style={{ background: c.accent }} />
        <span className="h-1 rounded-full" style={{ background: c.faint }} />
        <span className="h-1 rounded-full" style={{ background: c.faint }} />
      </span>
      <span className="flex flex-1 flex-col gap-1 p-1.5">
        <span className="flex items-center justify-between">
          <span className="h-1.5 w-6 rounded-full" style={{ background: c.ink }} />
          <span className="h-2.5 w-4 rounded-sm" style={{ background: c.accent }} />
        </span>
        <span
          className="flex flex-1 flex-col justify-center gap-1 rounded px-1"
          style={{ background: c.surface, border: `1px solid ${c.line}` }}
        >
          {[c.accent, c["line-strong"], c["line-strong"]].map((dot, i) => (
            <span key={i} className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={i === 0 ? { background: dot } : { border: `1px solid ${dot}` }}
              />
              <span
                className="h-1 flex-1 rounded-full"
                style={{ background: i === 0 ? c.faint : c.muted }}
              />
            </span>
          ))}
        </span>
        <span
          className="h-1 w-8 rounded-full"
          style={{ background: c.secondary }}
        />
      </span>
    </span>
  );
}
