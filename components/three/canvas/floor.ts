/**
 * Floor (DESIGN-SYSTEM §7.1): one transparent quad on the ground — a 6.4 m disc gradient
 * (#15191D → transparent at 55 %), the ruler floor (lines every 0.5 m at 6 %, every 1 m at
 * 10 %, in the rim tone, fading out from 2.2 m) and the baked contact shadows (assembled ↔
 * exploded, crossfaded along the explode). The posters carry only the shadows, so the disc and
 * the ruler fade in after the poster → canvas crossfade (`uReveal`).
 *
 * Shadow textures: top-down, image up = vehicle front (+Z), image left = vehicle left (+X),
 * centred on the origin (contract F7.7).
 */
import {
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from "three";

import { FLOOR } from "@/constants/xray";

export type FloorUniforms = {
  uShadowA: { value: Texture | null };
  uShadowB: { value: Texture | null };
  uShadowMix: { value: number };
  /** 1 with every part on the car … 0 with the car stripped (hero v2). */
  uShadowGain: { value: number };
  uReveal: { value: number };
};

export function createFloor(shadowA: Texture | null, shadowB: Texture | null) {
  const size = FLOOR.shadowExplodedSize;
  const geometry = new PlaneGeometry(size, size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = {
    uShadowA: { value: shadowA },
    uShadowB: { value: shadowB },
    uShadowMix: { value: 0 },
    uShadowGain: { value: 1 },
    uReveal: { value: 0 },
    uSizeA: { value: FLOOR.shadowAssembledSize },
    uSizeB: { value: FLOOR.shadowExplodedSize },
    uCentre: { value: new Color(FLOOR.centre) },
    uLine: { value: new Color(FLOOR.line) },
    uRadius: { value: FLOOR.radius },
    uDiscOpacity: { value: FLOOR.discOpacity },
    uMinor: { value: FLOOR.minorStep },
    uMajor: { value: FLOOR.majorStep },
    uMinorOpacity: { value: FLOOR.minorOpacity },
    uMajorOpacity: { value: FLOOR.majorOpacity },
    uFadeFrom: { value: FLOOR.fadeFrom },
  };
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vGround;
      void main() {
        vec4 world = modelMatrix * vec4( position, 1.0 );
        vGround = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uShadowA;
      uniform sampler2D uShadowB;
      uniform float uShadowMix;
      uniform float uShadowGain;
      uniform float uReveal;
      uniform float uSizeA;
      uniform float uSizeB;
      uniform vec3 uCentre;
      uniform vec3 uLine;
      uniform float uRadius;
      uniform float uDiscOpacity;
      uniform float uMinor;
      uniform float uMajor;
      uniform float uMinorOpacity;
      uniform float uMajorOpacity;
      uniform float uFadeFrom;
      varying vec2 vGround;

      float gridLine( vec2 p, float step ) {
        vec2 g = p / step;
        vec2 w = fwidth( g );
        vec2 d = abs( fract( g - 0.5 ) - 0.5 ) / max( w, vec2( 1e-4 ) );
        return 1.0 - min( min( d.x, d.y ), 1.0 );
      }

      float shadowAt( sampler2D tex, float size ) {
        // image left = vehicle left (+X), image up = vehicle front (+Z)
        vec2 uv = vec2( 0.5 - vGround.x / size, 0.5 + vGround.y / size );
        if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) return 0.0;
        return texture2D( tex, uv ).a;
      }

      vec4 over( vec4 dst, vec3 color, float alpha ) {
        float a = alpha + dst.a * ( 1.0 - alpha );
        vec3 c = ( color * alpha + dst.rgb * dst.a * ( 1.0 - alpha ) ) / max( a, 1e-5 );
        return vec4( c, a );
      }

      void main() {
        float r = length( vGround );
        float disc = ( 1.0 - smoothstep( 0.0, uRadius, r ) ) * uDiscOpacity * uReveal;
        float fade = 1.0 - smoothstep( uFadeFrom, uRadius, r );
        float lines = max( gridLine( vGround, uMinor ) * uMinorOpacity,
                           gridLine( vGround, uMajor ) * uMajorOpacity ) * fade * uReveal;
        float shadow = mix( shadowAt( uShadowA, uSizeA ), shadowAt( uShadowB, uSizeB ), uShadowMix ) * uShadowGain;

        vec4 c = vec4( uCentre, disc );
        c = over( c, uLine, lines );
        c = over( c, vec3( 0.0 ), shadow );
        gl_FragColor = c;
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = "sk_floor";
  const mesh = new Mesh(geometry, material);
  mesh.name = "sk_floor";
  mesh.position.y = 0.0005;
  mesh.renderOrder = 1;
  mesh.raycast = () => {};
  return { mesh, uniforms: uniforms as FloorUniforms & typeof uniforms };
}
