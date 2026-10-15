import { openUrl } from "@tauri-apps/plugin-opener";

/** Public documentation site (src-docs/documentation, deployed on Vercel). */
export const DOCS_URL = "https://docs.risebyday.com";

/** Open the docs in the user's default browser. */
export function openDocs(): void {
  void openUrl(DOCS_URL);
}
