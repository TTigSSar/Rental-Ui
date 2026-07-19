Project: DoRent

Architecture:
- Angular standalone
- NgRx
- ASP.NET Core
- MSSQL
- Docker
- nginx reverse proxy

Design:
- Flow A
- Refined Warm
- Mobile first
- Airbnb-inspired
- Shared UI primitives required
- Use design tokens only
- No hardcoded colors

Current MVP status:

Completed:
✓ Moderation
✓ Listings
✓ Favorites
✓ Bookings
✓ Booking lifecycle
✓ Reviews
✓ Public owner profiles
✓ Listing trust indicators
✓ Mobile navigation redesign

Current phase:
Phase 2.10
Final Mobile QA & MVP Polish

Next phases:
Phase 2.10
Phase 2.11 Production Readiness
Phase 2.12 Seed Marketplace Data

Rules:
- Always build after changes
- Always validate Docker
- Never break existing routes
- Reuse existing components
- Prefer shared primitives
- Mobile M (390px) is primary target
- Validate 375 / 390 / 414

Commit naming:
feat(...)
fix(...)
refactor(...)
chore(...)
test(...)

Output format:
- changed files
- rationale
- build result
- docker result