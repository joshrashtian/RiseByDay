import { useSettings } from "@/providers/SettingsProvider";
import { NON_HOME_SECTIONS } from "./sections";
import SettingsHeader from "@/ui/settings/Header";

export default function HomeSection() {
  const { navigate } = useSettings();

  return (
    <div className="space-y-5">
      <SettingsHeader>
        <SettingsHeader.Title className="text-4xl">Config</SettingsHeader.Title>

      </SettingsHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NON_HOME_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => navigate(section.id)}
            className="group flex items-start gap-3 rounded-2xl border border-line/80 bg-surface/70 p-4 text-left transition-all hover:border-accent hover:bg-surface hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:hover:border-accent"
          >
            <span className="mt-0.5 text-2xl text-accent transition-colors group-hover:text-accent dark:text-blue-400">
              {section.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-ink">
                {section.label}
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                {section.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
