import { useEffect, useId, useState } from "react";
import {
  clearManualWeatherCoords,
  getManualWeatherCoords,
  setManualWeatherCoords,
} from "../../lib/weatherCoords";
import { IoLocationOutline } from "react-icons/io5";
import Container from "@/ui/settings/Container";
import SettingsHeader from "@/ui/settings/Header";
import Button from "@/ui/Button";

export function WeatherSection() {
  const uid = useId();
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const m = getManualWeatherCoords();
    if (m) {
      setLatInput(String(m.lat));
      setLonInput(String(m.lon));
    }
  }, []);

  const onSaveWeatherLocation = () => {
    setSaveError(null);
    const lat = Number(latInput.trim());
    const lon = Number(lonInput.trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setSaveError("Enter valid numbers for latitude and longitude.");
      return;
    }
    if (lat < -90 || lat > 90) {
      setSaveError("Latitude must be between -90 and 90.");
      return;
    }
    if (lon < -180 || lon > 180) {
      setSaveError("Longitude must be between -180 and 180.");
      return;
    }
    setManualWeatherCoords({ lat, lon });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const onUseDeviceLocation = () => {
    setSaveError(null);
    clearManualWeatherCoords();
    setLatInput("");
    setLonInput("");
  };

  const latId = `${uid}-lat`;
  const lonId = `${uid}-lon`;
  const weatherHintId = `${uid}-weather-hint`;

  return (
    <div className="space-y-5">
      <SettingsHeader>
        <div>
        <SettingsHeader.Title>
          Weather
        </SettingsHeader.Title>
        <SettingsHeader.Subtitle>
          Use a fixed location for consistent forecast data across sessions.
        </SettingsHeader.Subtitle>
        </div>
      </SettingsHeader>

      <Container>
        <Container.Header icon={<IoLocationOutline />} heading="Location" />
        <Container.Body className="space-y-4 px-4 py-4">
      <div
        id={weatherHintId}
        className="rounded-xl border border-accent bg-accent-soft p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200"
        role="note"
      >
        Leave these empty to use your device location (if permitted).
        Coordinates are useful when planning for a different city.
      </div>

      <fieldset
        className="flex flex-col gap-3 border-none p-0"
        aria-describedby={weatherHintId}
      >
        <legend className="sr-only">Location coordinates</legend>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={latId}
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Latitude
          </label>
          <input
            id={latId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            placeholder="e.g. 34.0549"
            aria-invalid={
              saveError?.toLowerCase().includes("latitude") || undefined
            }
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={lonId}
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Longitude
          </label>
          <input
            id={lonId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={lonInput}
            onChange={(e) => setLonInput(e.target.value)}
            placeholder="e.g. -118.2452"
            aria-invalid={
              saveError?.toLowerCase().includes("longitude") || undefined
            }
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow focus:ring-2 focus:ring-accent"
          />
        </div>
      </fieldset>

      <div aria-live="polite">
        {saveError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {saveError}
          </p>
        ) : null}
        {savedFlash ? (
          <p
            className="text-sm text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            Weather settings saved. Weather will refresh.
          </p>
        ) : null}
      </div>
        </Container.Body>

      <Container.Footer className="justify-start px-4">
        <Button
          type="button"
          onClick={onSaveWeatherLocation}
        >
          Save Coordinates
        </Button>
        <Button
          type="button"
          onClick={onUseDeviceLocation}
          styling="bordered"
        >
          Use device location
        </Button>
      </Container.Footer>
      </Container>
    </div>
  );
}
