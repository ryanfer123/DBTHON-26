# Public welcome-screen design

This page records historical P01/account design decisions. The current photographic
homepage, dark mode and six-section layout are documented in
[HOME_REFRESH.md](HOME_REFRESH.md), with retained opening/workflow/help/dark concepts.
The connected role workspace uses [workspace-concept.png](workspace-concept.png):
forest headings, sage context, open list rows, shared navigation and responsive forms.
Final concept/render comparison inspected the latest desktop feed/report and mobile
delivery captures: matching palette/fonts/container and open row layout; narrower
filters use content width, timestamps expose actual server fields, and links use the
shared outline/text treatments. Navigation includes only approved roles rather than
all concept roles; real synthetic content determines row count and wrap. These are
functional extensions. The 16-test browser pass checks real actions and overflow;
temporary captures are removed after the comparison.

[welcome-concept.png](welcome-concept.png) was generated with the built-in Image
Gen tool on 2026-10-05 and selected as the working P01 design. Native size:
1505 x 1045. It is a full public welcome screen, not a simulated donor dashboard.
Working product name: Second Table; academic repository/project identity is unchanged.
Current user-facing site name, selected 2026-10-07: NomNom. “Second Table” above
records the earlier concept and its historical comparison evidence.

## Design system and implementation inventory

- True white background, deep forest text/accent `#173d2d`, light sage band
  `#eaf0e9`, warm orange numbered step markers, pale gray-green borders.
- Georgia serif wordmark/headings; Arial/Helvetica interface/body text. Desktop:
  36px wordmark, 90px hero, 35px timeline title, 48px community title, 24-26px body.
  Sizes were tuned against the generated reference using actual Georgia metrics.
- 86% width, maximum 1288px container; 90px header; open two-column hero; vertical
  timeline; full-width sage community band; simple footer. No card grid or imagery.
- Rounded 10px green CTA, circular numbered markers, underline-selected tabs.
- Allowed copy: all welcome, navigation, timeline, donor description and footer
  strings in the concept. Receiver/volunteer descriptions extend the same requested
  role-selection flow and are provided by the public API.
- Components: PageShell, WelcomePage, HowItWorks, CommunityPanel; tokens/styles shared.
- Actions: anchor navigation, accessible role tabs with keyboard controls, route-backed
  selection, loading/error/retry for API content, and direct-link refresh.
- Below 800px columns stack; at 480px header wraps deliberately and tabs remain
  horizontal. Reduced-motion preference disables smooth scrolling.
- No raster artwork is consumed by the app: the image is a design reference, and all
  visible interface text/controls are native HTML/CSS. No overlays/gradients added.

## Prompt summary

Generate a complete readable 1440x1000 surplus-food welcome interface named Second
Table: true white, forest/sage/orange editorial direction; exact “Good food. Better
shared.” headline and source-aligned descriptions; open numbered timeline;
community role tabs; no fake metrics, photos, decorative badges or unrelated controls.
The tool returned the retained 1505x1045 concept. Responsive layout is an intentional
extension of the same design system. Functional and screenshot comparison evidence
is recorded in STATUS.md after verification.

## Account UI extension and final comparison (2026-10-05)

The user requested better UI and working controls. This extends the existing design
system with functional account forms rather than changing the visual direction;
the skill's existing-design-system exception applies. The retained concept above
remains the reference for welcome layout, typography and palette. Forms/admin
lists are necessary additions for the already implemented identity APIs.

Inspected the concept and latest live browser captures with `view_image` in the
same final QA pass. Captures used Playwright/installed Chrome at native 1505x1045
and mobile 390x844 viewports, with full-page screenshots for longer forms.
Browser plugin was absent; attempted built-in IAB also returned unavailable.

| Comparison point | Reference / observed render | Resolution |
| --- | --- | --- |
| Palette | White page, forest text/actions, sage community strip, orange steps | Retained exact shared CSS tokens; no tint, gradient or raster UI |
| Typography | Georgia headline/wordmark, Arial body, two headline lines | Retained fonts/scale and prevented accidental headline wrapping; explicit form/control sizes |
| Layout | Open two-column hero/timeline and full-width community band | Retained desktop columns, timeline positions, shared container and footer; added role CTA increases band height intentionally |
| Navigation | Original two home-section links | Added sign-in/account destination; corrected section URLs from account pages; compact mobile header stays readable |
| Actions/copy | Original primary “See how it works” | Intentionally promoted “Join your community” and kept the original as secondary; added real per-role registration links |
| Account states | New API-backed surface required by request | Open two-column sign-in/register; sage profile summary; structured admin rows and expandable review form using the same tokens |
| Responsive/focus | Mobile stacking is an existing extension | Inspected registration/profile/admin and welcome at 390px; visible focus/labels, readable long contacts and zero horizontal overflow |

Above-the-fold copy diff: headline, introduction, timeline and footer preserved.
Intentional additions are sign-in/account navigation and account-entry CTA; the
original explanatory CTA becomes secondary. Role signup links and account/admin
copy are functional extensions, not claims of implemented food redistribution.
No unexplained added copy, invented metrics, placeholder inputs, or inactive domain
buttons remain. The retained design was faithfully verified with these recorded
extensions; no material visual mismatch remains. Temporary QA captures stay outside
Git and are removed after inspection; this ledger records durable evidence.
