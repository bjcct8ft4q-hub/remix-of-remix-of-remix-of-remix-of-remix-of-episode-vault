<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Determine seasonal themes with the shared calendar predicate, not persisted manual overrides, so annual transitions remain automatic.
- Use resumable browser uploads for video media and bounded requests for metadata saves, so progress and failures always resolve visibly.
- Keep shared navigation in Header with a dismissible dropdown and route-aware links, so the same navigation works across content and admin pages.
- Keep quick search in a focused dialog using the shared series query and catalog filtering, so the header and browse page use the same live catalog without exposing account data.
- Store subtitled videos in the existing required episode video path and dubbed videos in a nullable companion path, so existing episodes remain playable and dub stays optional.
- Upload episode versions sequentially with aggregate progress and track completed paths for safe cleanup, so a failed dub cannot create an incomplete episode.
- Compose the watch page from a series-details sidebar, player, episode selector and discussion/recommendation band, using signed media URLs and actual uploaded version availability.
