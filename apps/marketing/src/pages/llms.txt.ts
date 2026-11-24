import type { APIRoute } from "astro";

import { ANDROID_PLAY_STORE_URL, GITHUB_REPOSITORY_URL, IOS_APP_STORE_URL } from "../lib/site";
import { absoluteUrl, SITE_TAGLINE } from "../lib/seo";

// https://llmstxt.org: a plain index that tells AI agents which domain and links are official.
export const GET: APIRoute = () => {
  const body = `# Loom

> ${SITE_TAGLINE}. Loom is free, open-source, and MIT-licensed. It runs Claude Code, Codex, Cursor, OpenCode, Grok, Antigravity, and other coding agents from one desktop, web, and mobile app.

Source code and releases live at ${GITHUB_REPOSITORY_URL}. Loom is self-hosted and runs on your own machine.

## Official links

- [Download Loom](${absoluteUrl("/download")}): macOS, Windows, and Linux installers
- [Web app](https://app.loom.local): connect to a Loom server from a browser
- [Source code](${GITHUB_REPOSITORY_URL}): the MIT-licensed repository
- [Releases](${GITHUB_REPOSITORY_URL}/releases): release builds and changelogs
- [npm package](https://www.npmjs.com/package/loom): run \`npx loom@latest\`
- [iOS app](${IOS_APP_STORE_URL})
- [Android app](${ANDROID_PLAY_STORE_URL})

## Policies

- [Security policy](${absoluteUrl("/security-policy")})
- [Privacy policy](${absoluteUrl("/privacy-policy")})
- [Terms of service](${absoluteUrl("/terms-of-service")})
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
