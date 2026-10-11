/// <reference types="vite/client" />

declare module "*.riv" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_ENABLE_SPOTIFY?: string;
  readonly VITE_ENABLE_GOOGLE_CALENDAR?: string;
  readonly VITE_ENABLE_PROJECTS?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
}
