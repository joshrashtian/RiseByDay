import { useId, useRef, useState } from "react";
import { Camera01 } from "@untitledui/icons";
import { twMerge } from "tailwind-merge";
import { AvatarProfilePhoto } from "@/components/base/avatar/avatar-profile-photo";
import type { Profile } from "@/providers/ProfileProvider";
import { AVATAR_ACCEPT, uploadAvatar } from "@/lib/cloud/avatars";
import { normalizeUsername, updateProfile } from "@/lib/cloud/profile";

type EditProfilePopupProps = {
  profile: Profile;
  /** Merged into the profile context after each successful save/upload. */
  onSaved: (changes: Partial<Profile>) => void;
  onClose: () => void;
};

const inputClass =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Rendered inside PopupProvider, which sits above ProfileProvider, so this
 * takes the profile as props instead of calling useProfile().
 */
export function EditProfilePopup({
  profile,
  onSaved,
  onClose,
}: EditProfilePopupProps) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameId = `${uid}-name`;
  const usernameId = `${uid}-username`;
  const initials =
    (fullName || profile.name)
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "DB";

  // The avatar uploads immediately, like in Settings; Save covers the text.
  const onPickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const { url, error } = await uploadAvatar(profile.id, file);
      if (error) {
        setError(error);
        return;
      }
      setAvatarUrl(url);
      onSaved({ avatarUrl: url });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const edits = {
      fullName: fullName.trim() || null,
      username: normalizeUsername(username) || null,
    };
    setError(null);
    setIsSaving(true);
    try {
      const { error } = await updateProfile(profile.id, edits);
      if (error) {
        setError(error);
        return;
      }
      onSaved(edits);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 p-6">
      <h2 className="text-left! font-display text-2xl font-bold tracking-tight text-ink">Edit profile</h2>

      <div>
        <input
          ref={fileRef}
          type="file"
          accept={AVATAR_ACCEPT}
          onChange={onPickPhoto}
          className="hidden"
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileRef.current?.click()}
          aria-label={avatarUrl ? "Change photo" : "Upload photo"}
          className="group relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <AvatarProfilePhoto
            key={avatarUrl ?? "none"}
            size="md"
            src={avatarUrl ?? undefined}
            initials={initials}
            alt="Profile photo"
          />
          <span
            className={twMerge(
              "absolute inset-1 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
              isUploading && "opacity-100",
            )}
          >
            {isUploading ? (
              "Uploading…"
            ) : (
              <>
                <Camera01 className="size-5" aria-hidden="true" />
                {avatarUrl ? "Change" : "Upload"}
              </>
            )}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-sm font-medium text-muted">
          Name
        </label>
        <input
          id={nameId}
          value={fullName}
          maxLength={80}
          autoComplete="name"
          onChange={(event) => setFullName(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={usernameId} className="text-sm font-medium text-muted">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
            @
          </span>
          <input
            id={usernameId}
            value={username}
            maxLength={25}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setUsername(event.target.value)}
            className={twMerge(inputClass, "w-full pl-7")}
          />
        </div>
        <p className="text-xs text-muted">
          3–24 lowercase letters, numbers or underscores.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
