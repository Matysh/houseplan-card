# Default two-floor UI Lab scene

Owner-approved on 2026-11-24 in #1554. The source is the currently deployed
UI Lab session, not the original backup archive. Geometry, room labels,
appearance, furniture, openings and device positions are retained.

All registry/entity/device identities are demonstration IDs. Only presentation
metadata and fixed offline states are included; no live HA endpoint, credentials,
network identifiers, device URLs, documents or diagnostic registry dumps are
bundled. The PNG has its text/EXIF metadata removed, with unchanged pixels and a
new content hash. `theme.css` supplies the agreed amber palette for the scene.

`npm run ui-lab` loads this directory automatically. Explicit `--fixture`,
`--assets` and `--theme` inputs remain supported. An explicit fixture does not
inherit these assets or this theme unless requested. `../fixture.json` remains
the small synthetic contract fixture used by the existing browser smoke.

Do not regenerate from a live HA instance or an old ZIP during deployment.
Update this reference only from a newly approved local session, preserving
synthetic bindings and checking both floors.
