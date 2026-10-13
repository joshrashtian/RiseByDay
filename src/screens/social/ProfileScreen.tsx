import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AvatarProfilePhoto } from "@/components/base/avatar/avatar-profile-photo";
import { useProfile } from "@/providers/ProfileProvider";
import { usePopup } from "@/providers/PopupProvider";
import { useAuthStore } from "@/stores/authStore";
import { EditProfilePopup } from "@/components/social/EditProfilePopup";
import { resolveAvatarUrl } from "@/lib/cloud/avatars";
import { followUser, getFollowStatus, unfollowUser } from "@/lib/social/follow";
import { supabase } from "@/utils/supabase";

type ViewedProfile = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

const toInitials = (name: string | undefined) =>
  name
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "DB";

export default function ProfileScreen() {
  const { userId } = useParams<{ userId?: string }>();
  const { profile, setProfile, stats } = useProfile();
  const authUser = useAuthStore((s) => s.user);
  const { open: openPopup, close: closePopup } = usePopup();

  // No id in the URL, or our own id, means this is the signed-in user's page.
  const isOwnProfile = !userId || userId === profile?.id;
  const otherProfile = useOtherProfile(isOwnProfile ? undefined : userId);

  const viewed: ViewedProfile | null = isOwnProfile
    ? profile && {
        id: profile.id,
        name: profile.fullName || profile.name,
        username: profile.username ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      }
    : otherProfile.profile;

  const displayName = isOwnProfile
    ? viewed?.name || "Not signed in"
    : otherProfile.loading
      ? "Loading…"
      : viewed?.name || "Profile not found";

  const statTiles = [
    { label: "Tasks", value: stats.totalTasks },
    { label: "Completed", value: stats.completedTasks },
    { label: "Completion", value: stats.completionRateLabel },
    { label: "Categories", value: stats.categoriesCount },
  ];

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-6xl flex-col items-start px-3 pb-24 pt-20 sm:px-6 sm:pt-24 lg:px-8">
      <header className="flex w-full items-center gap-6 border-b border-line pb-6">
        <AvatarProfilePhoto
          key={viewed?.avatarUrl ?? "none"}
          size="lg"
          src={viewed?.avatarUrl ?? undefined}
          initials={toInitials(viewed?.name)}
          alt={displayName}
        />
        <div className="min-w-0 flex-1 ">
          <h2 className="truncate text-left! font-display font-bold tracking-tight text-4xl text-ink sm:text-5xl">
            {displayName}
          </h2>
          <p className="mt-1 truncate font-mono text-sm text-muted">
            {viewed?.username
              ? `@${viewed.username}`
              : isOwnProfile
                ? "Local profile"
                : ""}
          </p>
        </div>
        {!isOwnProfile && viewed && profile?.id && (
          <FollowButton userId={viewed.id} />
        )}
        {isOwnProfile && authUser && profile && (
          <button
            type="button"
            onClick={() =>
              openPopup(
                <EditProfilePopup
                  profile={profile}
                  // Functional update: an avatar upload and a later Save both
                  // merge into the latest profile, not this render's copy.
                  onSaved={(changes) =>
                    setProfile((prev) => (prev ? { ...prev, ...changes } : prev))
                  }
                  onClose={closePopup}
                />,
              )
            }
            className="shrink-0 rounded-full border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
          >
            Edit profile
          </button>
        )}
      </header>

      {isOwnProfile && (
        <section className="mt-6 w-full">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Stats
          </h2>
          <div className="mt-3 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            {statTiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl  bg-surface/70 p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {tile.label}
                </p>
                <p className="mt-1 font-eudoxus text-2xl font-black text-ink">
                  {tile.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/** Loads another user's public profile row; idle when `userId` is undefined. */
function useOtherProfile(userId: string | undefined) {
  const [state, setState] = useState<{
    profile: ViewedProfile | null;
    loading: boolean;
  }>({ profile: null, loading: Boolean(userId) });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setState({ profile: null, loading: true });
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setState({
          loading: false,
          profile: data && {
            id: data.id,
            name: data.full_name || data.username || "",
            username: data.username,
            avatarUrl: resolveAvatarUrl(data.avatar_url),
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}

function FollowButton({ userId }: { userId: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFollowing(null);
    getFollowStatus(userId)
      .then((value) => !cancelled && setFollowing(value))
      // Status unknown (API down / not built yet): still offer "Follow".
      .catch(() => !cancelled && setFollowing(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = async () => {
    if (following === null || pending) return;
    const next = !following;
    setPending(true);
    setError(false);
    setFollowing(next); // optimistic
    try {
      await (next ? followUser(userId) : unfollowUser(userId));
    } catch {
      setFollowing(!next);
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={following === null || pending}
        aria-pressed={following ?? false}
        className={
          following
            ? "rounded-full border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sunken disabled:opacity-60"
            : "rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface transition-opacity hover:opacity-85 disabled:opacity-60"
        }
      >
        {following ? "Following" : "Follow"}
      </button>
      {error && (
        <p className="text-xs text-muted">Couldn't update. Try again.</p>
      )}
    </div>
  );
}
