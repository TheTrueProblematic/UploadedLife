# Uploaded Life (Public Build)

<!-- TOC -->
* [Uploaded Life (Public Build)](#uploaded-life-public-build)
  * [Purpose and Scope](#purpose-and-scope)
  * [Narrative Premise](#narrative-premise)
  * [Application Architecture](#application-architecture)
  * [Game Loop and Mechanics](#game-loop-and-mechanics)
  * [Scenario Library Summary](#scenario-library-summary)
  * [Asset Inventory](#asset-inventory)
  * [State Persistence and Data Handling](#state-persistence-and-data-handling)
  * [Audio and Media Handling](#audio-and-media-handling)
  * [Interface Behavior and Responsiveness](#interface-behavior-and-responsiveness)
  * [Local Development and Deployment](#local-development-and-deployment)
  * [Testing and Verification Notes](#testing-and-verification-notes)
  * [Maintenance Checklist](#maintenance-checklist)
  * [Appendix A: File Map](#appendix-a-file-map)
<!-- TOC -->

## Purpose and Scope
This directory holds the production-facing, fully static build of Uploaded Life, an interactive vignette about compulsory identity verification and its downstream risks. The site runs entirely in client browsers, so every asset necessary for rendering narrative content, music, and stateful gameplay resides here. There are no server-side components, build pipelines, or external dependencies beyond the documented embeds, making this folder the authoritative source of truth for distribution.

## Narrative Premise
Uploaded Life follows Alex, a recent renter with $10,000 in savings and 50% baseline happiness. Each month presents quietly consequential lifestyle choices: selecting work, purchasing hobbies, verifying identity for services, and weighing the erosion of privacy against day-to-day comfort. Sustained participation in platforms that require government ID uploads gradually increases systemic risk. If enough services are trusted—or enough months pass—Alex experiences cascading identity theft that freezes accounts, collapses happiness to 1%, and funnels the player to the Learn More brief on age-gating. Opting out of joy likewise ends the run through the “No Happiness” fail state. The entire narrative is therefore a tension between economic survival, emotional maintenance, and data exposure.

## Application Architecture
- `index.html` is the single entry document. It defines the `#app-root` viewport plus inline `<template>` definitions for the intro, learn more, credits, and mobile views before attaching `styles.css` and `scripts.js`.
- Scenario pages and utility screens are composed dynamically. Narrative scenarios are generated directly from the definitions inside `scripts.js`, while the administrative views clone the inline templates at the bottom of `index.html`, eliminating the need for a standalone `Pages/` directory.
- `scripts.js` defines a single global controller, `UploadedLifeHost`, which handles navigation, state mutation, modal dialogs, responsive fallbacks, and audio mediation. The host now renders every view directly inside the main document while still managing cross-view audio state.
- `styles.css` centralizes the retro terminal aesthetic: monospace typography, dark palette, grid-based HUD, modal overlay styles, scrollbar hints, and responsive clamps. It also ensures the root container stretches across the viewport.
- Assets are stored in `Resources/`, including four background music loops (`Base.mp3`, `PeakPlay.mp3`, `Spicy.mp3`, `SomberEnd.mp3`), a general-purpose `music.mp3`, an introductory `intro.webm`, and an images stub preserved via `.gitkeep`.

## Game Loop and Mechanics
1. **Initialization**: `UploadedLifeHost` seeds a state object with `money: 10000`, `happiness: 50`, arrays for economy and happiness effects (with `Bills` preset to −$1,000), empty `idList`, `hobbies`, and `relationship`, plus bookkeeping fields (`turn`, `visitedRandom`, `lastSnapshot`). The structure persists under the `uploaded-life-state-v1` localStorage key.
2. **Scenario Progression**: Each turn corresponds to a calendar month. Core scenarios (`a1r7`/`d8k3`, `b4m2`, `c7t9`, `d2q5`, `f9h3`, etc.) advance the storyline deterministically until the player enters the random pool. Subsequent choices are sampled from eligible definitions while avoiding immediate repeats.
3. **Decision Handling**: Each rendered scenario defines labeled buttons whose payloads may change money, happiness, and collections of ongoing effects. Some choices inject metadata (`addHobby`, `verifyHobby`, `setPendingRelationship`, `removeRelationship`, `additionalHappinessEffect`) processed after commitment. Monetary updates are clamped through helper utilities to prevent runaway values.
4. **ID Verification Pressure**: Many economic opportunities, hobbies, and pop-up events flag `idRequirement`. When triggered, the player is forced into a modal that simulates uploading documents or declining the opportunity. Accepting appends provider names such as `WorkGate HR`, `StreamDeck`, or `Summit Yard` to `state.idList`, which later influences breach probability.
5. **Identity Theft Trigger**: After turn 10, `shouldTriggerIdentityTheft` calculates `chance = min(0.05 + 0.04 * idList.length + 0.01 * (turn - 9), 0.65)`. Once the random draw succeeds, `triggerIdentityTheft()` wipes income modifiers, hobbies, and relationships, sets money to −$50,000 (later −$66,000), locks progression, and routes through `identitytheft1.html`, `identitytheft2.html`, and `identitytheft3.html`.
6. **Failure Routes**: If happiness falls to zero, the engine navigates to `nohappiness.html`, shows current balances, and offers a restart button. Completing the identity theft arc leads to `learnmore.html`, which embeds the published research document and a “Play Again” control.
7. **Audio Themes**: The soundtrack switches between `base`, `peak`, `spicy`, and `somber` themes depending on the current view target. Because modern browsers block autoplay, the host registers pointer and key listeners to unlock audio once the player interacts with the window.

## Scenario Library Summary
The `buildScenarioLibrary` factory in `scripts.js` registers every playable moment. Highlights:
- **Foundational Months**: `a1r7` and `d8k3` assign Alex to service work; `b4m2` forces HR identity upload; `c7t9` mandates a joy source (streaming vs. bowling) while optionally requiring ID.
- **Budget Upkeep**: `d2q5`, `e5v1`, and `f9h3` compare gig economy supplements, forcing trade-offs between cash and happiness.
- **Randomized Offers**: `goodEvents` (IDs `g6k8` through `v6x2`) cover experiential splurges, each with weighted costs and ID requirements tied to providers like `SavoryLab`, `Atlas VR`, or `City Lanes`.
- **Setbacks**: `k8n2` (radiator failure) and `l5r6` (friend relocation) reduce resources, with optional spending to blunt happiness loss.
- **Hobbies**: IDs `m3s8`, `n4t1`, and `w3b7` let Alex add ongoing expenses that also boost mood. `t4u7` later demands identity re-verification for any hobby that initially skipped documentation.
- **Relationships**: Invitations (`q8w3`, `y2d5`) open the path to `r0q9.html`, which models partner dynamics, recurring costs, and happiness effects. `p2v5` cleanly removes the relationship modifiers when a breakup occurs.
- **Promotions**: `s9y2` and `x4f8` offer raises plus possible stress penalties via `additionalHappinessEffect`.
- **Administrative Views**: `main`, `mobile`, three `identitytheft*`, `learnmore`, and `nohappiness` are non-scenario frames rendered through bespoke host logic and the inline templates bundled in `index.html`.

Each view is either generated entirely by JavaScript (scenarios, identity theft, no-happiness) or cloned from the templates in `index.html` (intro, learn-more, credits, and mobile). This keeps Git history readable while letting the scenario graph evolve in one place.

## Asset Inventory
- `index.html`: Parent document with the `#app-root` container, inline templates for administrative views, and a `<noscript>` warning.
- `scripts.js`: 1,000+ lines covering utilities, host class, HUD rendering, modal system, responsive logic, and the complete scenario dataset.
- `styles.css`: Layouts for `.page-shell`, `.hud-grid`, `.stat-block`, `.scenario-card`, `.cta-button`, `.modal-overlay`, `.mobile-wrapper`, and the site footer.
- `Resources/Music/Base.mp3`, `PeakPlay.mp3`, `Spicy.mp3`, `SomberEnd.mp3`, plus `Resources/music.mp3`: four theme loops and one auxiliary track.
- `Resources/intro.webm`: Video asset reserved for intro experiments (currently not auto-mounted).
- `Resources/Images/.gitkeep`: Placeholder to keep the images directory under version control until real art arrives.

## State Persistence and Data Handling
- State is serialized into localStorage each time a random scenario is recorded or a choice commits. Reloading the page therefore restores Alex’s trajectory, including outstanding hobbies and ID submissions.
- The `lastSnapshot` field records money and happiness at the start of each turn so that failure screens can display the moment balances collapsed.
- The HUD surfaces the running totals by iterating economy and happiness effect arrays, generating line items (e.g., `Bills`, `Roastery Pay`, `League friends`) along with dynamically formatted currency or percentage values.
- Identity-related services are rendered as pills. When no services exist, the UI intentionally states “No services yet” to underline how exposure accumulates.

## Audio and Media Handling
- `UploadedLifeHost` generates a single looping `<audio>` element in the top window to prevent multiple layers of music as the inline views rerender.
- Theme resolution is keyed to filename endings: `main.html` and `mobile.html` default to the base track, `learnmore` and `nohappiness` receive the somber track, the identity theft files trigger the spicy track, and all other scenarios use the peak track.
- If autoplay fails, the host attaches temporary listeners for `pointerdown` and `keydown` events across the parent window, child frames, and their documents. Once the user interacts, the listeners self-remove and playback resumes.
- Video and additional audio assets live under `Resources/`, allowing future enhancements (e.g., intro animations) without changing the build process.

## Interface Behavior and Responsiveness
- The entire experience assumes a widescreen viewport. The parent window measures the width-to-height ratio; if it drops below 1.5, the app root swaps to the inline mobile template, which displays instructions to rotate or resize before resuming play.
- `.page-shell` provides consistent padding and vertical rhythm, while `.hud-grid` uses flexbox to keep stat panels legible on large or small screens.
- Modal dialogs are injected on demand with an overlay lock that removes scrolling, matching native focus management.
- Footer links (`TrueProblematic © YEAR`) appear on the intro, mobile, learn-more, and fail-state screens, reinforcing the branding even when the HUD is hidden.

## Local Development and Deployment
1. Ensure you are in this `public/` directory so that relative asset paths remain correct.
2. Launch any static file server (examples):
   - `python3 -m http.server 4173`
   - `npx serve .`
3. Visit `http://localhost:4173/` (or equivalent). Loading `index.html` via direct file URLs is discouraged because some browsers block audio unlock logic in `file://` contexts.
4. To test on smaller screens, resize the browser until the mobile notice appears, then press “I have a wider screen now” to rerun the viewport heuristic without refreshing.
Deployment to hosting providers consists of uploading this folder and pointing the root to `index.html`. No preprocessing is required.

## Testing and Verification Notes
- **Start-to-End Run**: Begin on the intro view, accept a job, comply with the payroll ID check, and purchase at least one hobby to verify that ongoing effects render in the HUD.
- **Modal Enforcement**: Trigger a choice with `requireModal` or `idRequirement` to confirm that declining properly branches and that service badges update.
- **Random Rotation**: Play through enough months to ensure random scenarios respect eligibility gates (e.g., relationship invites do not appear while already partnered).
- **Identity Theft Arc**: Force the breach by collecting multiple ID-requiring services and advancing beyond month 10. Confirm that money drops to negative balances and that the three-step narrative concludes on `learnmore`.
- **No Happiness State**: Repeatedly choose options that harm happiness to confirm that `nohappiness.html` becomes reachable and that restarting clears modifiers.
- **Audio Unlock**: Load the site with autoplay disabled, click once, and note that background music begins without stacking loops.
- **Mobile Gate**: Narrow the viewport, observe the inline mobile template, then widen and use the provided button to restore the active view.

## Maintenance Checklist
- When adding a new scenario, register it in `buildScenarioLibrary` and decide whether it belongs to the `core` or `random` pool—no standalone HTML stub is necessary.
- Update `Resources/` references inside `scripts.js` if audio file names change; otherwise the themed soundtrack will fail silently.
- Keep CSS variable definitions synchronized with any new components to avoid unstyled artifacts.
- Validate that the Google Docs embed in `learnmore.html` still publishes publicly; if the document URL changes, replace it in the iframe `src`.
- Review the identity theft probability formula whenever adjusting the maximum number of ID-requiring services to maintain the intended tension curve.

## Appendix A: File Map
- `index.html`
- `styles.css`
- `scripts.js`
- `Resources/Music/Base.mp3`
- `Resources/Music/PeakPlay.mp3`
- `Resources/Music/Spicy.mp3`
- `Resources/Music/SomberEnd.mp3`
- `Resources/music.mp3`
- `Resources/intro.webm`
- `Resources/Images/.gitkeep`

[TrueProblematic © 2025](https://maximilianmcclelland.com)
