# Dashboard and navigation design

Requested 2026-10-06: all-role usability, desktop sidebar and mobile Dashboard /
Tasks / Inbox / More navigation. Image Gen desktop and mobile concepts were
produced and inspected before coding; illustrative values are not production data.
References: [desktop](dashboard-concept.png), [mobile](dashboard-mobile-concept.png).

White #ffffff, forest #173d2d, sage #eaf0e9, border #cad8cf and existing orange
accent. Existing dark theme tokens apply. Georgia wordmark and major headings;
Arial controls, sidebar, labels and body. Desktop header 90px, sidebar 260-300px,
main heading 72px, section headings 38px, body 20px, controls 16px. Main content
has 40px horizontal padding. Mobile heading 48px, sections 28px, 20px side padding,
fixed four-part bottom navigation with safe-area padding. Summary is an open strip,
wrapping into two columns; rows use hairline rules with no decorative cards/shadows.

Native components: shared AppLayout/sidebar, mobile dialog menus, breadcrumbs,
overview context, DashboardPage, reusable URL filters/pagination and HelpPage.
All text, controls and icons remain HTML/CSS/SVG. These images are references only.
Data-derived role sections and variable row counts are intentional. Forest links
retain existing app contrast instead of the mockup's orange links. Mobile keeps
existing How it works navigation reachable through More and public header. Help
uses the homepage's native FAQ disclosures. Dialogs inherit the same typography,
plain destination rows, explicit close button and focus management. Pending/error
screens add required guidance/retry; no fabricated zero metrics or permissions.

## Concept/render comparison

References and Chrome renders were inspected with `view_image` at desktop
1505x1045 and mobile 390x844. Full-page captures extend below the viewport.

| Comparison | Observed implementation |
| --- | --- |
| Palette and theme | Forest/sage on white retained; dark uses existing forest background, pale text and sage separators. Both inspected. |
| Header and type | Existing 90px desktop header and Georgia wordmark/headings retained. Desktop title 72px and mobile 48px preserve the concept hierarchy; existing mobile header stays two rows. |
| Desktop navigation | 270px sidebar, grouped vertical destinations and sage active marker. An inherited horizontal nav rule was found in visual QA and corrected. |
| Summary and density | Open metric strip with thin rules. Mobile wraps to two columns; only actual applicable role metrics appear, so a receiver has two cells rather than the concept's illustrative four. |
| Actions and upcoming rows | Native outlined shortcuts and deadline-ordered work with explicit open links. Single-role users have fewer shortcuts; actual food names, statuses and localized deadline dates replace concept examples. |
| Mobile navigation | Four fixed destinations, safe-area spacing, dark/light inheritance. Tasks/More are plain native dialogs with explicit close, focus wrapping and Escape/restoration. |
| Long content and help | Long food names and search copy wrap; native FAQ disclosures and working role links keep help consistent with the homepage. |

All text and controls are native HTML/CSS. Reference images are retained in this
folder and are not used as UI assets. Green links intentionally use the existing
contrast palette; variable counts/roles and empty/error/pending states are live
interfaces rather than illustration data. Browser plugin unavailable; installed
Chrome with Playwright is the documented fallback. Temporary renders remain outside
Git and are removed after inspection. Functional checks are recorded in STATUS.md.
