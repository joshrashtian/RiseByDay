import { DateTime } from "luxon";
import {
  formatListeningDuration,
  summarizeDay,
  type ListeningSession,
} from "@/lib/integrations/spotify/history";
import { Tooltip, TooltipTrigger } from "../../base/tooltip/tooltip";
import { BsSpotify } from "react-icons/bs";

const MINUTES_PER_DAY = 24 * 60;
/** A single 3-minute track would otherwise be a sliver you can't hover. */
const MIN_BAR_MINUTES = 12;
const SPOTIFY_GREEN = "#1DB954";

/** Width the rail claims on the right edge of a day column. */
export const SPOTIFY_RAIL_WIDTH_PX = 10;

function minuteOfDay(dt: DateTime, day: DateTime): number {
  const minutes = dt.diff(day.startOf("day"), "minutes").minutes;
  return Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
}

function sessionTooltip(session: ListeningSession) {
  const summary = summarizeDay(session.plays);
  const shown = session.plays.slice(0, 5);
  const more = session.plays.length - shown.length;

  return {
    title: `${session.start.toFormat("h:mm a")} – ${session.end.toFormat("h:mm a")} · ${formatListeningDuration(summary.totalMs)}`,
    description: (
      <span className="flex flex-col gap-0.5">
        {shown.map((play) => (
          <span key={play.playedAt} className="block font-mono truncate">
            {play.title} — {play.artists}
          </span>
        ))}
        {more > 0 ? (
          <span className="block opacity-70">+{more} more</span>
        ) : null}
      </span>
    ),
  };
}

/**
 * Thin strip down the right edge of a day column marking when music was
 * playing, in the spirit of Amie's listening rail. Purely informational: it
 * sits above the slot grid but only the bars themselves take the pointer.
 */
export function SpotifySessionRail({
  day,
  sessions,
}: {
  day: DateTime;
  sessions: ListeningSession[];
}) {
  if (sessions.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-10"
      style={{ width: SPOTIFY_RAIL_WIDTH_PX }}
      aria-label="Spotify listening sessions"
    >
      {sessions.map((session) => {
        const start = minuteOfDay(session.start, day);
        const end = Math.max(
          minuteOfDay(session.end, day),
          Math.min(MINUTES_PER_DAY, start + MIN_BAR_MINUTES),
        );
        const tooltip = sessionTooltip(session);

        return (
          <Tooltip
            key={session.id}
            title={tooltip.title}
            description={tooltip.description}
            placement="left"
            delay={200}
            icon={<BsSpotify className="text-black" />}
          >
            <TooltipTrigger
              aria-label={`Listened ${tooltip.title}`}
              className="pointer-events-auto absolute cursor-default rounded-full opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100"
              style={{
                top: `${(start / MINUTES_PER_DAY) * 100}%`,
                height: `${((end - start) / MINUTES_PER_DAY) * 100}%`,
                left: 1.5,
                width: SPOTIFY_RAIL_WIDTH_PX - 3,
                backgroundColor: SPOTIFY_GREEN,
              }}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}
