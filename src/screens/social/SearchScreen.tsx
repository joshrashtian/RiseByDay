import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IoSearchOutline } from "react-icons/io5";
import { AvatarProfilePhoto } from "@/components/base/avatar/avatar-profile-photo";
import { useAuthStore } from "@/stores/authStore";
import {
  searchProfiles,
  type ProfileSearchResult,
} from "@/lib/social/search";

const DEBOUNCE_MS = 250;

const toInitials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "DB";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: ProfileSearchResult[] }
  | { status: "error" };

export default function SearchScreen() {
  const authUser = useAuthStore((s) => s.user);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    const term = query.trim();
    if (!term || !authUser) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      searchProfiles(term, authUser.id)
        .then((results) => !cancelled && setState({ status: "done", results }))
        .catch(() => !cancelled && setState({ status: "error" }));
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, authUser]);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-3xl flex-col items-start px-3 pb-24 pt-20 sm:px-6 sm:pt-24 lg:px-8">
      <h1 className="w-full border-b border-line pb-3 text-left! font-display font-bold tracking-tight text-4xl text-ink sm:text-5xl">
        Search
      </h1>

      <label className="relative mt-6 block w-full">
        <span className="sr-only">Search people</span>
        <IoSearchOutline
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or @username"
          disabled={!authUser}
          className="w-full rounded-2xl border border-line bg-surface py-3 pl-12 pr-4 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
      </label>

      <section className="mt-4 w-full" aria-live="polite">
        {!authUser ? (
          <p className="text-sm text-muted">Sign in to find people.</p>
        ) : state.status === "loading" ? (
          <p className="text-sm text-muted">Searching…</p>
        ) : state.status === "error" ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Search failed. Try again.
          </p>
        ) : state.status === "done" && state.results.length === 0 ? (
          <p className="text-sm text-muted">No one matches “{query.trim()}”.</p>
        ) : state.status === "done" ? (
          <ul className="flex flex-col gap-2">
            {state.results.map((person) => (
              <li key={person.id}>
                <Link
                  to={`/social/profile/${person.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-line/80 bg-surface/70 p-3 transition-colors hover:bg-sunken"
                >
                  {/* The sm photo is 72px; scale it to a list-sized 48px. */}
                  <div className="size-12 shrink-0 [&>*]:origin-top-left [&>*]:scale-[0.667]">
                    <AvatarProfilePhoto
                      key={person.avatarUrl ?? "none"}
                      size="sm"
                      src={person.avatarUrl ?? undefined}
                      initials={toInitials(person.name)}
                      alt=""
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-eudoxus font-semibold text-ink">
                      {person.name}
                    </p>
                    {person.username && (
                      <p className="truncate font-mono text-sm text-muted">
                        @{person.username}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
