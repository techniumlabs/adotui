/** Helpers for `adotui --update` (kept out of main.tsx, which runs on import). */

export const RELEASES_URL = "https://github.com/techniumlabs/adotui/releases";

/** The installer as it was at a release tag, not whatever is on main today. */
export const installScriptUrl = (tag: string): string =>
  `https://raw.githubusercontent.com/techniumlabs/adotui/${tag}/install.sh`;

/**
 * Downloads the installer as text. Done in-process rather than `curl | bash`:
 * a failed `curl -f` pipes nothing into bash, which exits 0, so a 404 would
 * be reported as a successful update.
 */
export const fetchInstallScript = async (tag: string): Promise<string> => {
  const res = await fetch(installScriptUrl(tag));
  if (!res.ok) {
    throw new Error(`Could not download the installer for ${tag} (HTTP ${res.status}).`);
  }
  const script = await res.text();
  // Guards against a 200 that is not a script (captive portal, HTML error page).
  if (!script.startsWith("#!")) {
    throw new Error(`The installer for ${tag} is not a shell script; refusing to run it.`);
  }
  return script;
};
