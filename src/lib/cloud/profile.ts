import { supabase } from "@/utils/supabase";

const UNIQUE_VIOLATION = "23505";

/** Lowercase letters, numbers and underscores; 3–24 characters. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export type ProfileEdits = {
  fullName: string | null;
  username: string | null;
};

/** Normalizes a typed handle: trims, drops a leading "@", lowercases. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Writes the editable profile fields. The "profiles: update own" RLS policy
 * limits this to the signed-in user's row; the lower(username) unique index
 * turns a taken handle into a 23505.
 */
export async function updateProfile(
  userId: string,
  edits: ProfileEdits,
): Promise<{ error: string | null }> {
  if (edits.username && !USERNAME_PATTERN.test(edits.username)) {
    return {
      error: "Usernames are 3–24 lowercase letters, numbers or underscores.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: edits.fullName, username: edits.username })
    .eq("id", userId);

  if (error) {
    return {
      error:
        error.code === UNIQUE_VIOLATION
          ? "That username is taken."
          : error.message,
    };
  }
  return { error: null };
}
