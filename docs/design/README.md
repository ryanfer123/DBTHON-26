# Public welcome-screen design

[welcome-concept.png](welcome-concept.png) was generated with the built-in Image
Gen tool on 2026-10-05 and selected as the working P01 design. Native size:
1505 x 1045. It is a full public welcome screen, not a simulated donor dashboard.
Working product name: Second Table; academic repository/project identity is unchanged.

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
