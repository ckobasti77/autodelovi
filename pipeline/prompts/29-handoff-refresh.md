<!-- META | Korak 29 | Opus 5.5 | effort: high | sesija: NOVA | mode: auto -->
# Step 29 — Update the handoff after the rebrand and the UI boost

Steps 24–28 gave the site a new name and logo (Euromotors Plus by OEM Parts) and a full UI/UX upgrade. Bring the owner-facing handoff up to date.

## Read first
- `docs/PREDAJA.md`, `docs/GO-LIVE.md`, `docs/README.md` and the root `README.md`
- `pipeline/REPORT.md` and `docs/showcase/`
- `docs/brand/LOGO.md` and `docs/design/UI-BOOST.md`
- `docs/HUMAN-TODO.md`
- `pipeline/logs/24-result.md` through `pipeline/logs/28-result.md`

## Work
1. **Owner docs** (Serbian; update in place):
   - the new name;
   - where the logo kit is and how to use it;
   - a short "Šta je novo" section covering the soft corners, the reveal animations, the new header and mobile bar, and the main page improvements;
   - how to tune the reveal trigger line (the one constant, with its file and default value).
2. **Showcase:** refresh `docs/showcase/` with new screenshots at 390 and 1440 px (scroll through before capturing) and add the brand board. Update `docs/showcase/index.html` so it presents the new brand and UI. Use no external requests and keep the file self-contained.
3. **HUMAN-TODO:** make sure `docs/HUMAN-TODO.md` asks for:
   - the client's approval of the logo;
   - the real domain and e-mail sender;
   - the real company data.
4. **Check:** every link and image in these docs resolves.

Commit. Step report.
