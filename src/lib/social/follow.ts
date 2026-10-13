import { api } from "@/api";

/**
 * Follow calls go through the RiseByDay API (FastAPI). The caller is
 * identified by the Supabase bearer token the `api` interceptor attaches, so
 * only the target user's id is sent.
 *
 *   GET    /friendsapi/friends/{user_id}  → { following: boolean }
 *   POST   /friendsapi/friends/{user_id}  → follow
 *   DELETE /friendsapi/friends/{user_id}  → unfollow
 */
const followPath = (userId: string) =>
  `/friendsapi/friends/${encodeURIComponent(userId)}`;

export async function getFollowStatus(userId: string): Promise<boolean> {
  const res = await api.get<{ following: boolean }>(followPath(userId));
  return res.data.following;
}

export async function followUser(userId: string): Promise<void> {
  await api.post(followPath(userId));
}

export async function unfollowUser(userId: string): Promise<void> {
  await api.delete(followPath(userId));
}
