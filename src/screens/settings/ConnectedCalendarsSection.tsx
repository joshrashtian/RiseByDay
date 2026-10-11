import { useEffect, useId, useRef, useState } from "react";
import {
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoLogoGoogle,
} from "react-icons/io5";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { GOOGLE_CALENDAR_ENABLED } from "@/lib/featureFlags";
import { parseIcsFile } from "@/lib/integrations/ics/parseIcsFile";
import {
  formatLastImport,
  useCalendarIntegrationsStore,
} from "@/stores/calendarIntegrationsStore";
import { useTasksStore } from "@/stores/tasksStore";
import Container from "@/ui/settings/Container";
import SettingsHeader from "@/ui/settings/Header";

function CalendarColorDot({ color }: { color?: string }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-line"
      style={{ backgroundColor: color ?? "#6366f1" }}
      aria-hidden="true"
    />
  );
}

export function ConnectedCalendarsSection() {
  const uid = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const google = useCalendarIntegrationsStore((s) => s.google);
  const googleStatus = useCalendarIntegrationsStore((s) => s.googleStatus);
  const googleError = useCalendarIntegrationsStore((s) => s.googleError);
  const isImportingGoogle = useCalendarIntegrationsStore(
    (s) => s.isImportingGoogle,
  );
  const importPastMonths = useCalendarIntegrationsStore((s) => s.importPastMonths);
  const importFutureMonths = useCalendarIntegrationsStore(
    (s) => s.importFutureMonths,
  );
  const lastIcsImportAt = useCalendarIntegrationsStore((s) => s.lastIcsImportAt);
  const lastIcsImportCount = useCalendarIntegrationsStore(
    (s) => s.lastIcsImportCount,
  );
  const connectGoogle = useCalendarIntegrationsStore((s) => s.connectGoogle);
  const disconnectGoogle = useCalendarIntegrationsStore((s) => s.disconnectGoogle);
  const refreshGoogleCalendars = useCalendarIntegrationsStore(
    (s) => s.refreshGoogleCalendars,
  );
  const importGoogleEvents = useCalendarIntegrationsStore(
    (s) => s.importGoogleEvents,
  );
  const setCalendarEnabled = useCalendarIntegrationsStore(
    (s) => s.setCalendarEnabled,
  );
  const setImportRange = useCalendarIntegrationsStore((s) => s.setImportRange);
  const markIcsImportComplete = useCalendarIntegrationsStore(
    (s) => s.markIcsImportComplete,
  );
  const importIcsTasks = useTasksStore((s) => s.importIcsTasks);
  const removeAllIcsTasks = useTasksStore((s) => s.removeAllIcsTasks);
  const icsTaskCount = useTasksStore(
    (s) => s.tasks.filter((task) => task.kind === "ics").length,
  );

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">(
    "info",
  );
  const [isImportingIcs, setIsImportingIcs] = useState(false);

  const enabledCount = google.calendars.filter((c) => c.enabled).length;
  const lastImportLabel = formatLastImport(google.lastImportAt);
  const isGoogleConnecting = googleStatus === "connecting";
  const lastIcsImportLabel = formatLastImport(lastIcsImportAt);

  const showStatus = (
    message: string,
    tone: "info" | "success" | "error" = "info",
  ) => {
    setStatusTone(tone);
    setStatusMessage(message);
  };

  // Pick up calendars added or renamed in Google since the last visit.
  useEffect(() => {
    if (GOOGLE_CALENDAR_ENABLED && google.connected) void refreshGoogleCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConnectGoogle = async () => {
    setStatusMessage(null);
    await connectGoogle();
    if (useCalendarIntegrationsStore.getState().googleStatus === "connected") {
      showStatus("Google Calendar connected and events imported.", "success");
    }
  };

  const onDisconnectGoogle = () => {
    disconnectGoogle();
    showStatus("Google Calendar disconnected.");
  };

  const onImport = async () => {
    if (!google.connected) {
      showStatus("Connect Google Calendar before importing.");
      return;
    }
    if (enabledCount === 0) {
      showStatus("Select at least one calendar to import.");
      return;
    }
    const result = await importGoogleEvents();
    if (!result) return;
    showStatus(
      `Imported ${result.imported} event${result.imported === 1 ? "" : "s"} from ${result.calendars} calendar${result.calendars === 1 ? "" : "s"}.${result.skipped > 0 ? ` Skipped ${result.skipped} already imported.` : ""}`,
      "success",
    );
  };

  const onChooseIcsFile = () => {
    fileInputRef.current?.click();
  };

  const onIcsFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImportingIcs(true);
    try {
      const text = await file.text();
      const { events, skipped: parseSkipped } = parseIcsFile(text);
      if (events.length === 0) {
        showStatus(
          parseSkipped > 0
            ? "No valid events found in that file."
            : "That file did not contain any calendar events.",
          "error",
        );
        return;
      }

      const { imported, skipped: dedupeSkipped } = importIcsTasks(
        events.map((item) => ({
          title: item.title,
          dueDate: item.dueDate,
          endDate: item.endDate,
          category: item.category,
          classLocation: item.location,
          icsUid: item.uid,
        })),
      );

      markIcsImportComplete(imported);
      const skippedTotal = parseSkipped + dedupeSkipped;
      showStatus(
        `Imported ${imported} ICS event${imported === 1 ? "" : "s"} as read-only calendar items.${skippedTotal > 0 ? ` Skipped ${skippedTotal} duplicate or invalid entries.` : ""}`,
        "success",
      );
    } catch {
      showStatus("Could not read that `.ics` file.", "error");
    } finally {
      setIsImportingIcs(false);
    }
  };

  const onClearIcsImports = () => {
    const removed = removeAllIcsTasks();
    showStatus(
      removed > 0
        ? `Removed ${removed} imported ICS event${removed === 1 ? "" : "s"}.`
        : "No imported ICS events to remove.",
      removed > 0 ? "success" : "info",
    );
  };

  const pastId = `${uid}-import-past`;
  const futureId = `${uid}-import-future`;
  const icsInputId = `${uid}-ics-file`;

  return (
    <div className="space-y-6">
      <SettingsHeader>
        <div>
          <SettingsHeader.Title>Connected Calendars</SettingsHeader.Title>
          <SettingsHeader.Subtitle>
            Bring events from other calendars into RiseByDay.
          </SettingsHeader.Subtitle>
        </div>
      </SettingsHeader>

      <Container>
        <Container.Header icon={<IoDocumentTextOutline />} heading="ICS File Import" />
        <Container.Body className="p-3">
            <div>

              <p className="mt-0.5 text-sm text-muted">
                {icsTaskCount > 0
                  ? `${icsTaskCount} read-only ICS event${icsTaskCount === 1 ? "" : "s"} in RiseByDay`
                  : "No ICS events imported yet"}
              </p>
              {lastIcsImportLabel ? (
                <p className="mt-1 text-xs text-faint">
                  Last import: {lastIcsImportLabel}
                  {lastIcsImportCount
                    ? ` · ${lastIcsImportCount} added`
                    : null}
                </p>
              ) : null}
            </div>



        <div className="space-y-4 px-4 py-4">
          <p className="text-sm text-muted">
            Upload a `.ics` export from your school portal, Google Calendar,
            Apple Calendar, or Outlook. Events import as the locked{" "}
            <span className="font-medium text-teal-700 dark:text-teal-300">
              ICS
            </span>{" "}
            type.
          </p>

          <input
            ref={fileInputRef}
            id={icsInputId}
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            onChange={onIcsFileSelected}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onChooseIcsFile}
              disabled={isImportingIcs}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
            >
              <IoDocumentTextOutline className="size-4" aria-hidden />
              {isImportingIcs ? "Importing…" : "Choose .ics file"}
            </button>
            {icsTaskCount > 0 ? (
              <button
                type="button"
                onClick={onClearIcsImports}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Remove all ICS imports
              </button>
            ) : null}
          </div>
          </div>
        </Container.Body>
    </Container>
{GOOGLE_CALENDAR_ENABLED ? (
        <Container
          aria-labelledby={`${uid}-google-heading`}
        >
          <Container.Body className="flex flex-col items-start justify-between gap-4 border-b border-line ">
           <Container.Header heading="Google Calendar" icon={<IoLogoGoogle />} />
            <div className="flex items-center gap-3">
              <div>
                <p className="mt-0.5 text-sm text-muted">
                  {google.connected
                    ? `Connected as ${google.accountEmail ?? "Google account"}`
                    : "Not connected"}
                </p>
                {lastImportLabel ? (
                  <p className="mt-1 text-xs text-faint">
                    Last import: {lastImportLabel}
                  </p>
                ) : null}
              </div>
            </div>

            {google.connected ? (
              <button
                type="button"
                onClick={onDisconnectGoogle}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnectGoogle}
                disabled={isGoogleConnecting}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              >
                {isGoogleConnecting ? "Waiting for Google…" : "Connect Google"}
              </button>
            )}
          </Container.Body>

          {google.connected ? (
            <div className="space-y-5 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Calendars to import
                </p>
                <ul className="mt-3 space-y-2">
                  {google.calendars.map((calendar) => (
                    <li
                      key={calendar.id}
                      className="flex items-center gap-3 rounded-xl border border-line bg-sunken/80 px-3 py-2.5"
                    >
                      <CalendarColorDot color={calendar.color} />
                      <Checkbox
                        size="sm"
                        isSelected={calendar.enabled}
                        onChange={(enabled) =>
                          setCalendarEnabled("google", calendar.id, enabled)
                        }
                        label={calendar.name}
                        className="min-w-0 flex-1"
                      />
                    </li>
                  ))}
                </ul>
              </div>

              <fieldset className="grid gap-4 border-none p-0 sm:grid-cols-2">
                <legend className="sr-only">Import date range</legend>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={pastId}
                    className="text-sm font-medium text-muted"
                  >
                    Past months
                  </label>
                  <input
                    id={pastId}
                    type="number"
                    min={0}
                    max={24}
                    value={importPastMonths}
                    onChange={(event) =>
                      setImportRange(
                        Number(event.target.value),
                        importFutureMonths,
                      )
                    }
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={futureId}
                    className="text-sm font-medium text-muted"
                  >
                    Future months
                  </label>
                  <input
                    id={futureId}
                    type="number"
                    min={1}
                    max={36}
                    value={importFutureMonths}
                    onChange={(event) =>
                      setImportRange(
                        importPastMonths,
                        Number(event.target.value),
                      )
                    }
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onImport}
                  disabled={isImportingGoogle}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
                >
                  <IoCalendarOutline className="size-4" aria-hidden />
                  {isImportingGoogle ? "Importing…" : "Import events"}
                </button>
              </div>
            </div>
          ) : null}

          {googleError ? (
            <p
              className="border-t border-line px-4 py-3 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {googleError}
            </p>
          ) : null}
        </Container>
      ) : null}

      <div aria-live="polite">
        {statusMessage ? (
          <p
            className={`text-sm ${
              statusTone === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : statusTone === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted"
            }`}
            role="status"
          >
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
