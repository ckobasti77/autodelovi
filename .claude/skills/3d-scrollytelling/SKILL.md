---
name: 3d-scrollytelling
description: Use this skill when building or polishing premium scroll-driven 3D landing page sections with React Three Fiber, GSAP ScrollTrigger, GLB models, phone screen surfaces, book animations, audio waves, and HTML overlays.
---

# 3D Scrollytelling Skill

Use this workflow for premium landing page sections that combine:

- React Three Fiber
- Three.js
- @react-three/drei
- GSAP ScrollTrigger
- HTML/CSS overlays
- responsive fallback behavior
- GLB phone models
- screen material replacement
- scroll-driven visual storytelling

## Core Rules

- Keep the 3D scene isolated.
- Do not rewrite the whole app.
- Do not put important copy or CTA buttons inside the canvas.
- Keep text, buttons, and navigation as accessible HTML.
- Use the canvas for visual storytelling only.
- Use dynamic import with SSR disabled if React Three Fiber causes server rendering issues.
- Keep the canvas pointer-events disabled unless interaction is required.
- Protect the rest of the page from z-index and overflow issues.
- Avoid changing backend, auth, payment, database, admin, CMS, or API logic.

## GLB Phone Rules

When using a GLB phone model:

- Inspect the GLB scene graph.
- Log or document important node names during development.
- Hide duplicate phone objects if the model contains more than one device.
- Prefer replacing the real screen/display mesh material if the model exposes one.
- Search for possible screen node names such as:
  - screen
  - display
  - glass
  - lcd
  - front
  - panel
- If no usable screen mesh exists, create a precisely aligned fallback screen plane.
- The fallback plane must be parented to the phone rig and tuned with constants.
- The fallback screen plane should feel like it belongs to the model, not like a floating image pasted over it.
- Keep all screen position, rotation, and scale values in constants.

## Phone Screen App UI Rules

The phone screen should show the EdenBooks mobile app.

Preferred order:

1. Use the real GLB screen mesh and replace its material.
2. If impossible, use a perfectly aligned `PhoneScreenSurface` plane.
3. Avoid loose overlay images that feel detached from the model.

The app UI can be built as:

- a CanvasTexture generated from code
- a Three.js group of simple UI shapes parented to the screen
- a carefully aligned screen surface with reader/audio states

The app UI should include:

Reader mode:
- EdenBooks branding
- open book title
- readable paragraph-like rows
- progress indicator
- clean premium mobile UI

Audio mode:
- book cover / circular artwork
- title
- audio progress bar
- play control
- subtle blue glow
- premium audio player feel

The screen should transition after enough scroll progress, similar to the previous 2D scrollytelling phone behavior.

## Book Animation Rules

The book animation must feel premium and cinematic.

- Books should start behind the phone.
- Books should emerge from behind the phone in a smooth semi-circle / arc.
- The motion should be smooth, not linear and robotic.
- Use eased curves, CatmullRom curves, or bezier-like interpolation.
- Add slight stagger between books.
- Add subtle rotation and depth movement.
- Do not make books randomly fly from screen edges.
- Do not use physics.
- Do not create chaotic particle-like movement.
- After the arc reveal, books should move into the phone screen.
- At the moment books enter the screen, increase screen glow and activate the mobile app UI.

Phone behavior during book reveal:

- The phone should subtly tilt toward the book arc.
- The tilt must be premium and restrained.
- After the books enter the screen, the phone should return toward a cleaner front-facing reading position.

## Audio Wave Rules

Audio waves must come from the speaker / lower phone area.

- They should appear mainly during audio mode.
- They should originate from the phone speaker area, not from the center of the screen.
- Use simple curves, rings, or line geometry.
- Animate opacity, scale, and slight outward movement.
- Keep it elegant and lightweight.
- Avoid noisy particles.
- Audio waves should clearly communicate audiobook playback.

## Performance Rules

- Avoid heavy postprocessing.
- Avoid large particle systems.
- Avoid physics.
- Use simple meshes and planes where possible.
- Keep texture count low.
- Use mobile fallbacks.
- Respect prefers-reduced-motion.
- Keep DPR controlled.
- Use refs and useFrame for animation where possible.
- Avoid excessive React state updates during scroll.

## Implementation Pattern

Recommended section structure:

<section className="relative h-[240vh]">
  <div className="sticky top-0 h-screen overflow-hidden">
    <ThreeScene progress={progress} />
    <HtmlOverlay progress={progress} />
  </div>
</section>

## Scroll Progress

Use GSAP ScrollTrigger or the existing scroll system to create a normalized progress value from 0 to 1.

Avoid tying complex animation state directly to React re-renders if it can be handled inside useFrame or refs.

Suggested timing:

progress 0.00 - 0.18:
- phone idle
- books hidden behind phone

progress 0.18 - 0.45:
- books emerge in arc
- phone tilts toward books

progress 0.45 - 0.68:
- books fly into screen
- screen glow increases

progress 0.68 - 0.78:
- EdenBooks reader app turns on inside phone screen

progress 0.78 - 1.00:
- audio app state appears
- waves emit from speaker area

## Mobile Rules

- Reduce 3D complexity.
- Reduce movement.
- Keep the CTA visible and tappable.
- Avoid horizontal overflow.
- Hide or simplify the 3D scene if needed.
- Mobile fallback must still look premium.

## Final Checks

Before finishing:

- Run lint.
- Run build.
- Check mobile layout.
- Check for horizontal overflow.
- Check that canvas does not block buttons.
- Check hydration issues.
- Check that the phone screen is visually attached to the GLB phone.
- Check that the audio waves originate from the speaker area.