import { useId, useRef, useState } from "react";
import { Camera01 } from "@untitledui/icons";
import { twMerge } from "tailwind-merge";
import { AvatarProfilePhoto } from "@/components/base/avatar/avatar-profile-photo";
import { useProfile } from "@/providers/ProfileProvider";
import { useAuthStore } from "@/stores/authStore";
import { useSyncStatus } from "@/lib/tasksSync";
import { AVATAR_ACCEPT, uploadAvatar } from "@/lib/cloud/avatars";
import Container from "@/ui/settings/Container";
import SettingsHeader from "@/ui/settings/Header";
import { IoSync } from "react-icons/io5";
import Button from "@/ui/Button";

function AccountForm() {
  const uid = useId();
  const signUp = useAuthStore((s) => s.signUp);
  const signIn = useAuthStore((s) => s.signIn);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      const { error } =
        mode === "signUp"
          ? await signUp(email, password)
          : await signIn(email, password);
      if (error) {
        setError(error);
        return;
      }
      if (mode === "signUp") {
        setNotice("Account created. Check your email if confirmation is required.");
      }
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={emailId}
          className="text-sm font-medium text-muted"
        >
          Email
        </label>
        <input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={passwordId}
          className="text-sm font-medium text-muted"
        >
          Password
        </label>
        <input
          id={passwordId}
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Please wait…"
            : mode === "signUp"
              ? "Create account"
              : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signUp" ? "signIn" : "signUp");
            setError(null);
            setNotice(null);
          }}
          className="text-sm font-medium text-muted underline-offset-2 hover:underline"
        >
          {mode === "signUp"
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
      </div>
    </form>
  );
}

function SyncStatusLine() {
  const status = useSyncStatus();

  const label =
    status === "syncing"
      ? "Syncing…"
      : status === "offline"
        ? "Offline — changes will sync when you're back online"
        : status === "error"
          ? "Last sync failed — will retry automatically"
          : status === "synced"
            ? "Synced"
            : "Idle";

  const tone =
    status === "error"
      ? "text-red-600 dark:text-red-400"
      : status === "synced"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted";

  return (
    <p className={`text-sm ${tone}`} role="status">
      {label}
    </p>
  );
}

function initialsOf(name: string | null | undefined) {
  const initials = name
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "DB";
}

/** The avatar; when signed in, hovering it reveals an upload overlay. */
function ProfileAvatar() {
  const { profile, setProfile } = useProfile();
  const authUser = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = profile?.fullName || profile?.name;
  const photo = (
    <AvatarProfilePhoto
      // Remount on a new URL so a previous load failure doesn't stick.
      key={profile?.avatarUrl ?? "none"}
      size="sm"
      src={profile?.avatarUrl ?? undefined}
      initials={initialsOf(name)}
      alt={name || "Profile avatar"}
    />
  );

  if (!authUser) return photo;

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    event.target.value = "";
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      const { url, error } = await uploadAvatar(authUser.id, file);
      if (error) {
        setError(error);
        return;
      }
      if (profile) setProfile({ ...profile, avatarUrl: url });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        onChange={onChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        aria-label={profile?.avatarUrl ? "Change photo" : "Upload photo"}
        className="group relative self-start rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {photo}
        <span
          className={twMerge(
            "absolute inset-0.75 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
            isUploading && "opacity-100",
          )}
        >
          {isUploading ? (
            "Uploading…"
          ) : (
            <>
              <Camera01 className="size-5" aria-hidden="true" />
              {profile?.avatarUrl ? "Change" : "Upload"}
            </>
          )}
        </span>
      </button>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ProfileSection() {
  const { profile } = useProfile();
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="space-y-5">
      <SettingsHeader>
        <div>
          <SettingsHeader.Title>Profile</SettingsHeader.Title>
          <SettingsHeader.Subtitle>
            Your local RiseByDay profile.
          </SettingsHeader.Subtitle>
        </div>
      </SettingsHeader>

      <dl className="rounded-2xl border border-line/80 bg-surface/70 p-4">
        <div className="mb-4">
          <dt className="sr-only">Avatar</dt>
          <dd>
            <ProfileAvatar />
          </dd>
        </div>

        <div className="mt-4 grid gap-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
            Full name
          </dt>
          <dd className={profile?.fullName ? "text-base text-ink" : "text-base text-muted"}>
            {profile?.fullName || "Not set"}
          </dd>
        </div>
        <div className="mt-4 grid gap-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
            Email
          </dt>
          <dd className="text-base text-ink">
            {profile?.email ?? "you@example.com"}
          </dd>
        </div>
      </dl>

      <Container>
        <Container.Header heading="RiseSync" icon={<IoSync className={`${authStatus === "loading" && "animate-spin"} `} />} />

        <div className="space-y-4 px-4 py-4">
          {authStatus === "loading" ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : authStatus === "signedIn" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Signed in as{" "}
                <span className="font-medium">{authUser?.email}</span>
              </p>
              <SyncStatusLine />
              <Button
                type="button"
                onClick={() => signOut()}
                styling="bordered"
              >
                Sign out
              </Button>
            </div>
          ) : (
            <AccountForm />
          )}
        </div>
      </Container>
    </div>
  );
}
