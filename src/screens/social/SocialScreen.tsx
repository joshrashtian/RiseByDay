import { AvatarProfilePhoto } from "@/components/base/avatar/avatar-profile-photo";
import { useProfile } from "@/providers/ProfileProvider";
import { Link } from "react-router-dom";

type Friend = {
  id: string;
  name: string;
};

const sampleFriends: Friend[] = [{ id: "1", name: "Jerome Mall" }];

export default function SocialScreen() {
  const { profile } = useProfile();

  const profileInitials =
    profile?.name
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "DB";

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-6xl flex-col items-start px-3 pb-24 pt-20 sm:px-6 sm:pt-24 lg:px-8">
      <header className="flex w-full items-center gap-5 border-b border-line pb-5">
        <Link
          to="/social/profile"
          aria-label="View your profile"
          className="rounded-full transition-opacity hover:opacity-80"
        >
          <AvatarProfilePhoto
            key={profile?.avatarUrl ?? "none"}
            size="md"
            src={profile?.avatarUrl ?? undefined}
            initials={profileInitials}
            alt={profile?.name ?? "Profile avatar"}
          />
        </Link>
        <div className="min-w-0">
          <h1 className="text-left! font-display font-bold tracking-tight text-4xl text-ink sm:text-5xl">
            Your Circle
          </h1>
          <p className="mt-1 truncate font-mono text-sm text-muted">
            {profile?.fullName || profile?.name || "Not signed in"}
          </p>
        </div>
      </header>

      <section className="mt-6 w-full">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Friend Activity
        </h2>
        <div className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sampleFriends.map((friend) => (
            <div
              key={friend.id}
              className="flex h-48 flex-col items-center justify-center rounded-2xl border border-line/80 bg-surface/70 p-4"
            >
              <p className="font-eudoxus text-xl font-semibold text-ink">{friend.name}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
