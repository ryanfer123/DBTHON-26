# Longer homepage and dark-mode design

Requested 2026-10-05: the home page felt short/bland; expand it and add dark mode
and useful features. Coordinated Image Gen concepts were generated and inspected
before implementation: [opening](home-hero-concept.png),
[workflow/community](home-workflow-concept.png), [handover/FAQ](home-help-concept.png).

Direction: retain Second Table, Georgia/Arial and the forest/white/sage/orange palette.
Use an open two-column photographic hero, centered sage purpose band, horizontal
numbered workflow, centered role tabs, open handover guidance and native disclosures.
No invented counts, testimonials, certification, filler card grids or fake controls.
The handover photo is illustrative artwork; it is not evidence of a real pilot.

Typography: 90px hero, 58px major section headings, 30-34px row/step titles,
24-26px hero/body introduction, 18-20px guidance/FAQ, 16px controls. Shared 86%/1288px
container and existing header are retained for consistency across the web app.
Spacing: hero 60px top/bottom; broad sections 64-80px; sage bands 54px; open row gaps
24-32px. Photo ratio 4:3, radius 12px, no tint, fade or overlay. Orange CTA and number
markers follow the generated concepts; general workspace buttons remain forest.

Native components: existing PageShell/CommunityPanel/HowItWorks plus HomeGuidance,
ThemeToggle, role-aware entry links and ShareListing. All UI text remains HTML;
only the handover photograph is a raster asset. Moon/sun/disclosure icons use clean
currentColor SVGs. Additions required by behavior: dark toggle state/persistence,
receiver/volunteer descriptions from the actual public API, account-aware CTAs,
FAQ answers describing implemented policy, clipboard fallback and server-checked
share-link access. The first FAQ is open by default, like the concept.

Theme tokens: light white/forest/sage; dark forest-black background, soft white text,
muted sage labels, subdued green surfaces/borders and the same warm orange accent.
Dark mode changes all pages, forms, statuses and reports, not just the homepage.
Default follows the device; a chosen mode persists locally. Preference storage never
contains account/session data. Reduced motion disables section-scroll animation.

Responsive extension: hero and workflow stack, date controls occupy full-width rows,
role tabs stay keyboard accessible, long copy wraps, header theme control remains
reachable and no page-wide horizontal overflow is permitted.

## Final visual comparison

Inspected the retained section concepts and live Chrome captures together using
`view_image`, at native desktop 1505x1045 and mobile 390x844. Light and dark capture
checks found six homepage sections, no horizontal overflow and no page/console
errors or warnings. The Browser plugin and built-in IAB were unavailable; installed
Chrome through Playwright supplied the rendered evidence.

| Comparison | Observed implementation and intentional extensions |
| --- | --- |
| Hero and photograph | Two-column opening, exact two-line headline and 4:3 rounded handover image; mobile stacks the image below the real entry links |
| Palette and dark theme | White/forest/sage/orange retained; dark concept's forest background, light text and subdued green band applied throughout the app |
| Typography | Georgia major headings retained; step and guidance titles use the existing Arial interface font for consistency with workspace screens |
| Container and spacing | Shared 86%/1288px container and header retained; broad open sections match the concepts with no card grid |
| Workflow and community | Three horizontal steps stack on mobile; API-backed role tabs retain keyboard selection and actual account-aware destinations |
| Guidance and FAQs | Three numbered handover rows and four native disclosures match the reference; first answer opens initially and all answers describe implemented policies |
| Number labels and links | Forest labels on orange improve contrast; functional role links use shared forest styling rather than the concept's orange text |
| Responsive controls | Mobile header includes the theme toggle; long FAQ copy wraps, date controls stack and the workflow tests check overflow before form submission |
| Behavior | Theme follows the device until chosen, persists across refresh/navigation, and handles denied storage; sharing has a copy action and selectable fallback |

Hero and guidance copy match the selected concepts. Community descriptions come
from the existing public API; role-aware destinations, theme labels and FAQ answers
are necessary functional extensions. The generated photograph is illustrative,
with no claim of a real participant/pilot. Temporary QA captures remain outside Git
and are removed after inspection; concepts and this comparison are durable evidence.
