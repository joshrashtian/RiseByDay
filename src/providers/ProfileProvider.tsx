import { useTasksStore } from "@/stores/tasksStore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/utils/supabase";
import { resolveAvatarUrl } from "@/lib/cloud/avatars";

export type Profile = {
  id: string;
  name: string;
  email: string;
  /** `profiles.full_name`; null when signed out or not set. */
  fullName?: string | null;
  /** `profiles.username`; the public handle, null until picked. */
  username?: string | null;
  avatarUrl?: string | null;
};

export type ProfileStats = {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  completionRateLabel: string;
  categoriesCount: number;
};

type ProfileContextType = {
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  stats: ProfileStats;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
};

export const ProfileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [profile, setProfile] = useState<Profile | null>({
    id: "Coming-Soon",
    name: "Coming Soon",
    email: "soon@coming.com",
    avatarUrl: null,
  });
  const allTasks = useTasksStore((s) => s.tasks);

  const stats = useMemo<ProfileStats>(() => {
    // Imported calendar events aren't the user's own work, so they don't count.
    const tasks = allTasks.filter((t) => t.kind !== "ics");
    const total = tasks.length;
    const completed = tasks.filter((t) => t.done).length;
    const open = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const categories = new Set(
      tasks
        .map((t) => t.category?.trim())
        .filter((c): c is string => Boolean(c)),
    ).size;
    return {
      totalTasks: total,
      completedTasks: completed,
      openTasks: open,
      completionRateLabel: `${rate}%`,
      categoriesCount: categories,
    };
  }, [allTasks]);

  const value = useMemo(
    () => ({ profile, setProfile, stats }),
    [profile, stats],
  );
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!authUser) return;
    setProfile((prev) => ({
      ...prev,
      id: authUser.id,
      email: authUser.email ?? prev?.email ?? "",
      name: authUser.user_metadata?.full_name ?? authUser.email ?? prev?.name ?? "",
      avatarUrl: resolveAvatarUrl(authUser.user_metadata?.avatar_url),
    }));

    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                fullName: data.full_name,
                username: data.username,
                // Keep the auth-metadata avatar when the row has none.
                avatarUrl: resolveAvatarUrl(data.avatar_url) ?? prev.avatarUrl,
              }
            : prev,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
