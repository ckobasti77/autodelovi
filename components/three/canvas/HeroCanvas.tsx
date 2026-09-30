"use client";

/**
 * The live 3D stage (dynamically imported by HeroExperience — never part of the first load).
 *
 * R3F `<Canvas frameloop="demand">`: a frame renders only when something changed (scroll
 * progress, hover/selection tweens, resize), nothing renders while the hero is off-screen.
 * DPR is clamped per tier and lowered when continuous animation runs below ~45 fps. Context
 * loss hands the stage back to the posters (one restore attempt).
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  NeutralToneMapping,
  SRGBColorSpace,
  Vector3,
  type PerspectiveCamera,
} from "three";

import { LIGHT_RIG } from "@/constants/xray";
import { MEDIA_CROP_MOBILE, MEDIA_STAGE_OVERLAY, currentFraming } from "@/lib/three/framing";
import { TIER_MAX_DPR } from "@/lib/three/tier";
import { heroStore, type HeroAnchor } from "@/components/three/heroStore";
import { HeroScene3D, OVERLAY_LAYER } from "@/components/three/canvas/controller";
import {
  buildBvhInIdle,
  buildEdgesInIdle,
  createEdgeMaterials,
  loadBvh,
  type EdgeMaterials,
} from "@/components/three/canvas/enhance";
import { yieldToMain } from "@/components/three/canvas/idle";
import { loadCarScene, type CarScene } from "@/components/three/canvas/loadCar";
import { usePointerPicking } from "@/components/three/canvas/usePointerPicking";

export type HeroCanvasProps = { tier: "high" | "mid" };

function lightDirection(azimuth: number, elevation: number): Vector3 {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

const KEY_POSITION = lightDirection(LIGHT_RIG.key.azimuth, LIGHT_RIG.key.elevation).multiplyScalar(10);
const RIM_POSITION = lightDirection(LIGHT_RIG.rim.azimuth, LIGHT_RIG.rim.elevation).multiplyScalar(10);

export default function HeroCanvas({ tier }: HeroCanvasProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, TIER_MAX_DPR[tier]]}
      camera={{ manual: true, fov: 28, near: 0.05, far: 60 }}
      gl={{
        antialias: tier === "high",
        alpha: true,
        stencil: false,
        powerPreference: "high-performance",
        toneMapping: NeutralToneMapping,
        toneMappingExposure: 1,
        outputColorSpace: SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        // Reading the program log forces every compile to finish synchronously, which defeats
        // KHR_parallel_shader_compile behind compileAsync; the shaders are fixed at build time.
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
      }}
      style={{ touchAction: "pan-y" }}
    >
      <HeroScene tier={tier} />
    </Canvas>
  );
}

function HeroScene({ tier }: HeroCanvasProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const [car, setCar] = useState<CarScene | null>(null);
  const controllerRef = useRef<HeroScene3D | null>(null);
  const edgeMaterialsRef = useRef<EdgeMaterials | null>(null);
  const firstFrame = useRef(false);

  // ---------------------------------------------------------------- load
  useEffect(() => {
    let cancelled = false;
    let loaded: CarScene | null = null;
    heroStore.setState({ status: "loading" });
    loadCarScene({ tier, renderer: gl })
      .then(async (result) => {
        if (cancelled) {
          result.dispose();
          return;
        }
        loaded = result;
        scene.environment = result.environment;
        scene.environmentIntensity = LIGHT_RIG.environmentIntensity;
        const controller = new HeroScene3D({
          car: result,
          camera,
          invalidate,
          reducedMotion: heroStore.getState().reducedMotion,
        });
        controllerRef.current = controller;
        // Upload textures and compile every program before the first visible frame — one
        // upload per task, so a phone never sees one long block of GPU uploads.
        for (const texture of result.textures) {
          await yieldToMain();
          if (cancelled) return;
          gl.initTexture(texture);
        }
        await yieldToMain();
        if (cancelled) return;
        scene.add(result.root);
        const { width, height } = gl.domElement.getBoundingClientRect();
        controller.setLayout({ width, height, ...currentFraming() });
        controller.buildExplode(heroStore.getState().timeline);
        controller.setProgress(heroStore.getState().progress);
        controller.updateCamera();
        await yieldToMain();
        if (cancelled) return;
        await gl.compileAsync(scene, camera);
        if (cancelled) return;
        setCar(result);
        invalidate();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("3D prikaz nije učitan:", error);
        heroStore.setState({ status: "failed" });
      });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
      if (loaded) {
        scene.remove(loaded.root);
        loaded.dispose();
        scene.environment = null;
      }
      const edges = edgeMaterialsRef.current;
      edges?.hidden.dispose();
      edges?.visible.dispose();
      edges?.depth.dispose();
    };
  }, [tier, gl, scene, camera, invalidate]);

  // The first frame after the scene is committed reports readiness (see useFrame below).
  useEffect(() => {
    if (car) invalidate();
  }, [car, invalidate]);

  // ---------------------------------------------------------------- store → scene
  useEffect(() => {
    if (!car) return;
    const controller = controllerRef.current;
    if (!controller) return;
    let last = heroStore.getState();
    controller.setHovered(last.hovered);
    controller.setSelected(last.selected);
    controller.setFreeArea(last.freeArea);
    const unsubscribe = heroStore.subscribe((state) => {
      if (state.progress !== last.progress) controller.setProgress(state.progress);
      if (state.timeline !== last.timeline) {
        controller.buildExplode(state.timeline);
        invalidate();
      }
      if (state.freeArea !== last.freeArea) controller.setFreeArea(state.freeArea);
      if (state.hovered !== last.hovered) controller.setHovered(state.hovered);
      if (state.selected !== last.selected) controller.setSelected(state.selected);
      if (state.reducedMotion !== last.reducedMotion) controller.setReducedMotion(state.reducedMotion);
      if (state.inView !== last.inView) {
        setFrameloop(state.inView ? "demand" : "never");
        if (state.inView) invalidate();
      }
      last = state;
    });
    return unsubscribe;
  }, [car, invalidate, setFrameloop]);

  // ---------------------------------------------------------------- layout
  const viewportDpr = useThree((s) => s.viewport.dpr);
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !car) return;
    controller.setLayout({ width: size.width, height: size.height, ...currentFraming() });
  }, [size.width, size.height, car]);

  useEffect(() => {
    controllerRef.current?.setPixelRatio(viewportDpr);
  }, [viewportDpr, car]);

  useEffect(() => {
    if (!car) return;
    const queries = [MEDIA_CROP_MOBILE, MEDIA_STAGE_OVERLAY].map((q) => window.matchMedia(q));
    const onChange = () => {
      const { width, height } = gl.domElement.getBoundingClientRect();
      controllerRef.current?.setLayout({ width, height, ...currentFraming() });
    };
    for (const q of queries) q.addEventListener("change", onChange);
    return () => {
      for (const q of queries) q.removeEventListener("change", onChange);
    };
  }, [car, gl]);

  // ---------------------------------------------------------------- idle enhancements
  // The desktop posters carry Freestyle edges, so the crossfade waits for the edge lines
  // (built in idle slices after the first, still hidden frame; 2.5 s at most).
  const edgesReady = useRef(tier !== "high");
  useEffect(() => {
    if (!car) return;
    let cancelBvh = () => {};
    let disposed = false;
    const startBvh = () => {
      void loadBvh().then(() => {
        if (!disposed) cancelBvh = buildBvhInIdle(car.pickables);
      });
    };
    // Hover raycasts only: a touch-only device keeps three's plain raycast (see enhance.ts).
    let unsubscribePointer = () => {};
    if (heroStore.getState().finePointer) startBvh();
    else {
      unsubscribePointer = heroStore.subscribe((state) => {
        if (!state.finePointer) return;
        unsubscribePointer();
        startBvh();
      });
    }
    let cancelEdges = () => {};
    let fallback = 0;
    if (tier === "high" && car.shellMeshes.length > 0) {
      const materials = createEdgeMaterials();
      edgeMaterialsRef.current = materials;
      const done = () => {
        window.clearTimeout(fallback);
        edgesReady.current = true;
        invalidate();
      };
      cancelEdges = buildEdgesInIdle(car.shellMeshes, materials, () => {
        controllerRef.current?.setEdgeMaterials(materials);
        done();
      });
      fallback = window.setTimeout(done, 2500);
    } else {
      edgesReady.current = true;
      invalidate();
    }
    return () => {
      disposed = true;
      unsubscribePointer();
      cancelBvh();
      cancelEdges();
      window.clearTimeout(fallback);
    };
  }, [car, tier, invalidate]);

  // ---------------------------------------------------------------- context loss
  useEffect(() => {
    const canvas = gl.domElement;
    let losses = 0;
    const onLost = (event: Event) => {
      event.preventDefault();
      losses += 1;
      heroStore.setState({ status: losses > 1 ? "failed" : "lost" });
    };
    const onRestored = () => {
      if (losses > 1) return;
      heroStore.setState({ status: "ready" });
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, invalidate]);

  usePointerPicking(controllerRef, Boolean(car));

  // ---------------------------------------------------------------- frame
  const anchor = useRef<HeroAnchor>({ slug: "", x: 0, y: 0, visible: false });
  const perf = useRef({ last: 0, sum: 0, count: 0 });

  // Priority 1: this callback renders the frame itself (normal pass + the selected on-top pass).
  useFrame(({ gl: renderer, scene: frameScene }) => {
    const controller = controllerRef.current;
    if (!controller || !car) {
      renderer.render(frameScene, camera);
      return;
    }
    controller.updateCamera();
    renderer.render(frameScene, camera);
    if (controller.hasOverlay) {
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      camera.layers.set(OVERLAY_LAYER);
      renderer.render(frameScene, camera);
      camera.layers.set(0);
      renderer.autoClear = autoClear;
    }

    const { hovered, selected } = heroStore.getState();
    const slug = selected ?? hovered;
    if (slug) {
      controller.anchorOf(slug, anchor.current);
      const a = anchor.current;
      const prev = heroStore.getState().anchor;
      if (!prev || prev.slug !== slug || prev.x !== a.x || prev.y !== a.y || prev.visible !== a.visible) {
        heroStore.setState({ anchor: { slug, x: a.x, y: a.y, visible: a.visible } });
      }
    } else if (heroStore.getState().anchor) {
      heroStore.setState({ anchor: null });
    }

    // Adaptive DPR: only continuous runs count (demand rendering has idle gaps).
    const now = performance.now();
    const p = perf.current;
    const gap = now - p.last;
    p.last = now;
    if (gap > 0 && gap < 100) {
      p.sum += gap;
      p.count += 1;
      if (p.count >= 90) {
        const average = p.sum / p.count;
        p.sum = 0;
        p.count = 0;
        // Step down from the pixel ratio actually in use (a DPR-1 screen starts at 1, not at
        // the tier maximum), never below 1; every change reallocates the drawing buffer.
        const current = renderer.getPixelRatio();
        if (average > 22 && current > 1) setDpr(Math.max(1, current - 0.25));
      }
    }

    if (!firstFrame.current && edgesReady.current) {
      firstFrame.current = true;
      // This frame is on screen after the callback; report readiness on the next tick.
      requestAnimationFrame(() => {
        if (heroStore.getState().status === "loading") heroStore.setState({ status: "ready" });
      });
    }
  }, 1);

  const onOverlay = (object: { layers: { enable: (layer: number) => void } } | null) =>
    object?.layers.enable(OVERLAY_LAYER);

  return (
    <>
      <hemisphereLight
        ref={onOverlay}
        args={[LIGHT_RIG.hemisphere.sky, LIGHT_RIG.hemisphere.ground, LIGHT_RIG.hemisphere.intensity]}
      />
      <directionalLight
        ref={onOverlay}
        color={LIGHT_RIG.key.color}
        intensity={LIGHT_RIG.key.intensity}
        position={KEY_POSITION}
      />
      <directionalLight
        ref={onOverlay}
        color={LIGHT_RIG.rim.color}
        intensity={LIGHT_RIG.rim.intensity}
        position={RIM_POSITION}
      />
    </>
  );
}
