import { useId, useRef, useState } from "react";
import {
  IoMusicalNoteOutline,
  IoTrashOutline,
  IoVolumeHighOutline,
  IoVolumeMuteOutline,
} from "react-icons/io5";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import {
  BUILTIN_TASK_CLICK_SOUNDS,
  NO_SOUND_ID,
  TASK_SOUND_EVENTS,
  builtinSoundId,
  createCustomSoundFromFile,
  customSoundId,
  getTaskClickSoundLabel,
  previewTaskClickSound,
} from "@/lib/taskClickSounds";
import { useSettingsStore } from "@/stores/settingsStore";
import Container from "@/ui/settings/Container";
import SettingsHeader from "@/ui/settings/Header";
import Button from "@/ui/Button";

export function AudioSection() {
  const uid = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPrefs = useSettingsStore((s) => s.audioPrefs);
  const customSounds = useSettingsStore((s) => s.customSounds);
  const setAudioPrefs = useSettingsStore((s) => s.setAudioPrefs);
  const addCustomSound = useSettingsStore((s) => s.addCustomSound);
  const removeCustomSound = useSettingsStore((s) => s.removeCustomSound);

  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const volumeId = `${uid}-volume`;
  const fileInputId = `${uid}-sound-file`;
  const soundsDisabled = !audioPrefs.soundEnabled;

  const onChooseSoundFile = () => {
    setImportError(null);
    setImportMessage(null);
    fileInputRef.current?.click();
  };

  const onSoundFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const sound = await createCustomSoundFromFile(file);
      addCustomSound(sound);
      setImportMessage(
        `Imported "${sound.name}" and selected it for completing tasks.`,
      );
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Could not import that file.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsHeader>
        <div>
        <SettingsHeader.Title>Audio</SettingsHeader.Title>
        <SettingsHeader.Subtitle>
          Sounds for completing, unchecking, and creating tasks.
        </SettingsHeader.Subtitle>
        </div>
      </SettingsHeader>

      <Container>
        <Container.Header
          icon={
            audioPrefs.soundEnabled ? (
              <IoVolumeHighOutline aria-hidden />
            ) : (
              <IoVolumeMuteOutline aria-hidden />
            )
          }
          heading="Task Sounds"
        />

        <Container.Body className="space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-sunken/80 px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Enable sound</p>
          <p className="mt-0.5 text-sm text-muted">
            Turn off to silence all task sounds.
          </p>
        </div>
        <Checkbox
          size="sm"
          isSelected={audioPrefs.soundEnabled}
          onChange={(enabled) =>
            setAudioPrefs((prev) => ({ ...prev, soundEnabled: enabled }))
          }
          aria-label="Enable task sounds"
        />
      </div>

          {TASK_SOUND_EVENTS.map(({ event, prefKey, label, description }) => {
            const selectId = `${uid}-sound-${event}`;
            const selected = audioPrefs[prefKey];
            return (
              <div key={event} className="flex flex-col gap-2">
                <div>
                  <label
                    htmlFor={selectId}
                    className="text-sm font-medium text-ink"
                  >
                    {label}
                  </label>
                  <p className="text-xs text-muted">{description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    id={selectId}
                    value={selected}
                    disabled={soundsDisabled}
                    onChange={(event) =>
                      setAudioPrefs((prev) => ({
                        ...prev,
                        [prefKey]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value={NO_SOUND_ID}>None</option>
                    <optgroup label="Built-in">
                      {BUILTIN_TASK_CLICK_SOUNDS.map((sound) => (
                        <option key={sound.id} value={builtinSoundId(sound.id)}>
                          {sound.label}
                        </option>
                      ))}
                    </optgroup>
                    {customSounds.length > 0 ? (
                      <optgroup label="Imported">
                        {customSounds.map((sound) => (
                          <option key={sound.id} value={customSoundId(sound.id)}>
                            {sound.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  <Button
                    type="button"
                    onClick={() => previewTaskClickSound(selected)}
                    disabled={soundsDisabled || selected === NO_SOUND_ID}
                    aria-label={`Preview ${getTaskClickSoundLabel(selected, customSounds)} for ${label.toLowerCase()}`}
                    styling="bordered"
                  >
                    Preview
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={volumeId}
                className="text-sm font-medium text-muted"
              >
                Volume
              </label>
              <span className="text-sm tabular-nums text-muted">
                {audioPrefs.volume}%
              </span>
            </div>
            <input
              id={volumeId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={audioPrefs.volume}
              disabled={soundsDisabled}
              onChange={(event) =>
                setAudioPrefs((prev) => ({
                  ...prev,
                  volume: Number(event.target.value),
                }))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sunken accent-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:accent-violet-400"
            />
          </div>
        </Container.Body>
      </Container>

      <Container>
        <Container.Header
          icon={<IoMusicalNoteOutline aria-hidden />}
          heading="Import your own"
        />

        <Container.Body className="space-y-4 px-4 py-4">
          <p className="text-sm text-muted">
            Upload a short audio clip from your device. Saved locally.
          </p>
          <div
            className="rounded-xl border border-accent bg-accent-soft p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200"
            role="note"
          >
            Supports `.mp3`, `.wav`, `.ogg`, `.m4a`, and `.aac` up to 512 KB.
          </div>

          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
            className="sr-only"
            onChange={onSoundFileSelected}
          />

          <Button
            type="button"
            onClick={onChooseSoundFile}
            disabled={isImporting}
          >
            {isImporting ? "Importing…" : "Choose audio file"}
          </Button>

          {customSounds.length > 0 ? (
            <ul className="space-y-2">
              {customSounds.map((sound) => {
                const id = customSoundId(sound.id);
                const usedFor = TASK_SOUND_EVENTS.filter(
                  ({ prefKey }) => audioPrefs[prefKey] === id,
                ).map(({ label }) => label);
                return (
                  <li
                    key={sound.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-sunken/80 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {sound.name}
                      </p>
                      <p className="text-xs text-muted">
                        {usedFor.length > 0
                          ? `Used for: ${usedFor.join(", ")}`
                          : "Imported sound"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => previewTaskClickSound(id)}
                        disabled={soundsDisabled}
                        styling="bordered" className="px-3 py-1.5 text-xs"
                      >
                        Preview
                      </Button>
                      <button
                        type="button"
                        onClick={() => removeCustomSound(sound.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-surface px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        <IoTrashOutline className="size-3.5" aria-hidden />
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No imported sounds yet.</p>
          )}

          <div aria-live="polite">
            {importError ? (
              <p
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {importError}
              </p>
            ) : null}
            {importMessage ? (
              <p
                className="text-sm text-emerald-600 dark:text-emerald-400"
                role="status"
              >
                {importMessage}
              </p>
            ) : null}
          </div>
        </Container.Body>
      </Container>
    </div>
  );
}
