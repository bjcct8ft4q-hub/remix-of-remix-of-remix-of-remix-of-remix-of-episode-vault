# Streamly automatic importing

## Preserve the existing website
Keep Streamly’s design, logo, homepage, navigation, accounts, admin dashboard and resumable manual uploads. Add importing to the existing dashboard rather than redesigning it. Never replace manually supplied metadata or videos automatically.

## Stage 1 — Metadata and episode importing
- Add an Automatic Import section with Sync Now, source selection, imported anime/episode totals, playable/missing-video totals, last successful sync and visible errors.
- Connect public AniList GraphQL requests without an API key. Import English/Japanese titles, descriptions, posters, banners, genres, ratings, dates, studios, status and known episode counts.
- Start with a bounded selection of trending, popular, upcoming and newly released titles—not a wholesale AniList database copy. AniList prohibits mass collection; obtain written permission before enabling a broad persistent catalog importer.
- Use known episode numbers and available airing information. AniList does not promise complete episode titles or thumbnails: leave missing fields empty, do not fabricate them, and distinguish announced episodes from released ones.
- Create ordinary Streamly series pages. Mark metadata-only episodes as unavailable, with no invented video URL or endlessly loading player. The main Watch action should select a genuinely playable episode.
- Match imports by stable AniList identity and episode number, flag possible matches to existing manual series for review, and preserve episode IDs, comments and manual values. Editing imported content protects it from later automatic replacement.
- Include focused tests for duplicate prevention, manual-content preservation and real video availability.

## Stage 2 — Authorised video integration
Build a provider adapter only after actual rights/access and provider documentation are supplied. Associate verified anime/episode identities and actual sub/dub availability; never guess a playable URL. Keep manual files and permit administrators to add authorised URLs with explicit replacement confirmation.

### Available options and signup requirements
| Option | Playback support | What you need |
| --- | --- | --- |
| AniList metadata | No anime video streams | No public-query key. Review [terms](https://anilist.gitbook.io/anilist-apiv2-docs/docs/guide/terms-of-use); commercial services above $150/month require a commercial licence. Bulk collection needs clarification/permission regardless of revenue. |
| Official/licensed YouTube channels | Official embedded player, not extracted HLS in Streamly’s custom player | For automatic discovery, create a Google Cloud project, enable YouTube Data API v3 and provide an API key through secure settings. Provide channel IDs and evidence that the intended use is authorised. An individual public embed does not require a Data API key. Embedding/territorial restrictions remain in force. |
| Mux | Documented HLS, subtitles and alternate audio | Create a Mux account with Video access; provide API credentials securely, licensed source files/feed, language tracks and distribution rights. Hosting/streaming costs apply; Mux supplies no anime catalog rights. |
| Cloudflare Stream | Documented HLS/DASH, captions and alternate audio | Create a Cloudflare account with Stream enabled; supply account details/token securely, licensed source files/feed and rights. Hosting/streaming costs apply; no anime catalog rights are included. |
| Vimeo | Hosted player/API; direct playback capabilities depend on plan and access | Create a suitable Vimeo account/application; provide an access token securely and licensed content. Confirm direct HLS and requested audio support before choosing it. |
| Crunchyroll or HIDIVE/Sentai | Public self-service playback APIs/direct HLS access not verified | Request a distribution or authorised-player agreement. Supply company, business model, countries, audience, desired titles/languages, term and playback requirements. A viewer subscription is not permission to distribute episodes. Provide the signed rights scope and partner feed/API documentation before integration. |

For permitted direct HLS, extend the existing custom player with HLS.js, available quality levels, supplied subtitle tracks and actual audio tracks; preserve fullscreen and manual MP4 playback. Do not attempt HLS extraction from YouTube or partner services. Retain DRM, expiry, domain and territory restrictions required by the chosen provider.

Useful official references: [YouTube setup](https://developers.google.com/youtube/v3/getting-started), [Mux tracks](https://www.mux.com/docs/guides/add-alternate-audio-tracks-to-your-videos), [Cloudflare own player](https://developers.cloudflare.com/stream/viewing-videos/using-own-player/), [Crunchyroll partner portal](https://partner.crunchyroll.com/).

## Stage 3 — Automatic updates
- Add a once-daily synchronisation schedule, initially disabled, for the approved bounded selection; Sync Now remains available.
- Refresh existing imported entries and discover new episodes from documented sources. Add video-source checks only for configured authorised providers.
- Store short-lived API cache results, respect rate-limit/retry headers and prevent overlapping runs. Split work into bounded batches with resumable progress rather than one huge request.
- Show failed and partial runs separately from successful runs; persist actionable errors and accurate totals. Do not claim playable imports until the source is verified.
- If broad AniList collection is required, automatic catalog expansion remains disabled until permission is confirmed.

## Technical approach
- The copied Drizzle SQL files are already absent and the journal is empty; preserve that reset rather than recreating copied history. Do not reset the live application tables or data.
- Apply additive changes through the managed migration tool with grants and admin-scoped policies. Keep the existing required manual sub-video storage path; represent metadata-only availability with additive fields or related records, never a placeholder path. Inspect actual live constraints before choosing the precise representation.
- Keep import provenance, stable source IDs, protected/manual fields, run history and cached responses separate from public account data.
- Use authenticated server functions with verified administrator access for controls; use the generated schedule authentication for the scheduled callback. Never expose provider secrets to the browser.
- Reuse existing catalog queries and invalidate affected pages after sync. Verify a real administrator can sync and read results back through the dashboard and series page; report any access blocker rather than claiming an untested flow works.

## Information needed before video work
Provide the authorised provider you have access to, approved titles/channels, countries, sub/dub rights, availability dates, and its integration documentation. Add any private credentials only through secure settings—not chat. Confirm whether Streamly is commercial and whether AniList has approved the proposed collection scope.

Stage 1 can proceed with a conservative, bounded metadata integration; full-catalog collection and playable-provider discovery depend on confirmed permissions.