import { supabase } from "@/utils/supabase";
import { resolveAvatarUrl } from "@/lib/cloud/avatars";

export type ProfileSearchResult = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

const MAX_RESULTS = 20;

/** Escapes LIKE wildcards and PostgREST `or()` delimiters in user input. */
const escapeTerm = (term: string) =>
  term.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ");

/**
 * Finds other users by username or name (case-insensitive substring).
 * Never matches on email: profiles are readable by every signed-in user, so
 * searching it would let anyone confirm who has an account.
 */
export async function searchProfiles(
  query: string,
  excludeUserId?: string,
): Promise<ProfileSearchResult[]> {
  const term = escapeTerm(query.trim().replace(/^@/, "")).trim();
  if (!term) return [];

  const pattern = `%${term}%`;
  let request = supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .or(
      `username.ilike."${pattern}",full_name.ilike."${pattern}"`,
    )
    .limit(MAX_RESULTS);
  if (excludeUserId) request = request.neq("id", excludeUserId);

  const { data, error } = await request;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name || row.username || "Unnamed",
    username: row.username,
    avatarUrl: resolveAvatarUrl(row.avatar_url),
  }));
}
