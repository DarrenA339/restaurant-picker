# Design references

One image per screen, exported from the design canvas at 2x. Numbers follow the flow; files that share a number belong to the same step. Files ending in `-desktop` are the 1280×800 layouts.

| File | Screen |
| --- | --- |
| 01-welcome.png, 01-welcome-desktop.png | Welcome |
| 02-create.png | Create a session (desktop: follow 03-join-desktop) |
| 03-join.png, 03-join-desktop.png | Join a session. The desktop version is the template for every flow screen without its own desktop image |
| 04-lobby-host.png, 04-lobby-desktop.png | Lobby, host view (guest view differs only in the bottom area; see source/04-lobby.dc.html) |
| 05-voting-method.png | Host's voting-method sheet (desktop: a 520px dialog in the style of 08-details-desktop) |
| 06-explore.png, 06-explore-desktop.png | Explore map and add spots (Filters sheet markup is in source/06-explore.dc.html; on desktop it opens as a 520px dialog) |
| 07-swipe.png, 07-swipe-desktop.png | Swipe screen |
| 08-details.png, 08-details-desktop.png | Restaurant details: bottom sheet on mobile, dialog on desktop |
| 09-done.png | Done and waiting (ranking-mode copy is in the source file; desktop: follow 03-join-desktop) |
| 10-final-borda.png, 10-final-plurality.png, 10-final-quadratic.png | Final round in each voting method (desktop: follow 03-join-desktop) |
| 11-winner.png | Dinner decided (desktop: follow 03-join-desktop) |
| components.png | Shared components and their states |
| states.png | Edge states |

Exact spacing, sizes, colors and copy live in `source/` (see its README). Placeholder photos and drawn maps are stand-ins for real Google Places photos and a live Google Map.
