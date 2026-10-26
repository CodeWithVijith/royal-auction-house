# Sports Auction visual system

Reference: https://neoauction.vercel.app/ (captured 26 October 2026 at 1366 x 768). The public login route was inspected using its rendered screenshot, HTML, branding output, and page text. Authenticated auction pages were also observed during the product comparison.

## Direction

Use a premium black, slate, and amber auction-room aesthetic. Preserve Royal's data-rich workflows while adopting NeoAuction's compact navigation, clear empty states, centered authentication card, and strong gold action hierarchy.

## Tokens

- Background: `#050608` with deep slate gradient to `#0e1526`
- Surface: `#0f151e`; raised surface: `#131b29`
- Border: `#273244`
- Primary text: `#f8fafc`; muted: `#94a3b8`
- Accent: amber `#f59e0b`; highlight `#fbbf24`
- Font: Montserrat where available, then Helvetica Neue/Arial
- Base radius: 8px; feature cards may use 16px
- Controls: minimum 44px height

## Layout and components

- Sticky, translucent black application header with a thin amber border.
- Auction navigation is a single compact horizontal strip. It scrolls horizontally below tablet width and never expands the viewport.
- On desktop, brand, primary auction navigation, and organizer profile occupy one header row.
- The live room is a fixed-height event canvas: team rail on the left, auction stage on the right, and a persistent live footer. Audit history moves below the canvas only on smaller screens.
- Primary actions use an amber gradient, white bold text, a subtle amber shadow, and restrained scale feedback.
- Inputs use translucent slate fills, slate borders, and amber focus rings.
- Authentication uses a centered, viewport-safe card with a blurred amber halo and circular auction mark.
- Content remains inside a 1280px maximum container with 16px mobile gutters.
- Dense tables and dialogs must scroll internally; no page-level horizontal overflow.

## Responsive behavior

- Minimum supported width is 320px.
- Header secondary identity text hides on small screens.
- Navigation retains one line and scrolls horizontally with no visible scrollbar.
- Authentication and action rows collapse without fixed widths.
- Use `min-h-dvh` for full-height screens to account for mobile browser chrome.

## Performance guidance

- Public landing content is statically renderable and must not wait for API health checks.
- Authentication presence in the workspace shell is checked from the local session cookie; pages that need data perform their own API authorization.
- Avoid duplicate server API requests in nested layouts.
- Keep images optional and sized; the interface should not depend on remote decorative assets.

The reference's exact internal authenticated CSS was not scraped. Authenticated layout observations are therefore visual approximations rather than a pixel-perfect reproduction.
