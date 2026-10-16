# Deploying to Netlify

vial-web is a static site: `npm run build` writes it to `dist/`, and any static host
can serve it. Netlify is set up through `netlify.toml`, so nothing needs to be typed
into Netlify's settings by hand.

## First deploy

1. In Netlify, choose **Add new site → Import an existing project → GitHub** and pick
   `fjgarciahurtado/vial-web`.
2. Leave the build settings as Netlify fills them in from `netlify.toml`
   (build command `npm run build`, publish directory `dist`). No environment
   variables are needed.
3. Deploy. The site gets an `https://<name>.netlify.app` address; rename it under
   **Site configuration → Site details**, or add your own domain under
   **Domain management**.

WebHID only works on secure (HTTPS) pages, which Netlify provides automatically,
including on custom domains.

## What `netlify.toml` sets

| Setting | Why |
|---|---|
| Node 22 | Vite 8 needs Node 20.19+ or 22.12+. |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | The browser tests don't run on Netlify, so their browsers aren't downloaded. |
| Deploy previews | Every pull request gets its own preview site, so changes can be tried on a real keyboard before merging. |
| `/*` → `/index.html` | The app is one page; unknown paths load it instead of a 404. |
| `Permissions-Policy` | Allows WebHID for this site only, and turns off camera, microphone, location, WebUSB and Web Serial, which the app doesn't use. |
| `Content-Security-Policy` | Only files from this site may load; no inline scripts or styles, no framing by other sites. `'wasm-unsafe-eval'` lets the xz decoder, which is WebAssembly, unpack each keyboard's definition. |
| `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` | Standard hardening. |
| `Cache-Control` | Files in `/assets/` have a content hash in their name, so they are cached for a year; `index.html` is always revalidated so releases show up straight away. |

## Trying the built site locally

`npm run preview:netlify` builds the site and opens it at `http://localhost:4173`,
served with the same headers as on Netlify (security policy, caching, and the
fallback to `index.html`). Chrome treats `localhost` as secure, so WebHID works there:
plug in a keyboard and connect it to check a release without deploying it.

`vite.config.ts` reads the `[[headers]]` from `netlify.toml` for this, so the two
can't drift apart.

## Checking a policy change

`npm run test:csp` builds the site, serves it like `npm run preview:netlify`, and
replays the main flows (demo keyboard, key picker, lighting, macros), failing on any
security-policy violation. It also compiles a WebAssembly module,
because the demo keyboard skips the xz decoder that real keyboards need. Run it whenever the policy or the way the
app loads files changes.

## Deploying from Claude Code (optional)

The project's `.mcp.json` includes Netlify's MCP server. To let Claude Code manage
deploys, create a personal access token in Netlify (**User settings → Applications →
Personal access tokens**) and set it as the `NETLIFY_PERSONAL_ACCESS_TOKEN`
environment variable before starting Claude Code. The Netlify MCP server needs
Node 22 or newer. Connecting the repository in Netlify's UI, as above, doesn't need
any of this.
