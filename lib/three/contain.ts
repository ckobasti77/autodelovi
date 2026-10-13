/**
 * `object-fit: contain` maths for the hero poster (docs/3D-CONTRACT.md §F6). Pure — no three.js,
 * so the first-load bundle can frame the poster without pulling the 3D library in.
 */
export type ContainFrame = {
  /** Size of the poster image inside the box (CSS px). */
  imageWidth: number;
  imageHeight: number;
  /** Top-left of the image inside the box (CSS px). */
  offsetX: number;
  offsetY: number;
};

/**
 * Where `object-fit: contain; object-position: anchorX anchorY` draws a poster of
 * `posterAspect` inside a `width × height` box.
 */
export function containFrame(
  posterAspect: number,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
): ContainFrame {
  const boxAspect = width / Math.max(height, 1);
  const imageWidth = boxAspect >= posterAspect ? height * posterAspect : width;
  const imageHeight = boxAspect >= posterAspect ? height : width / posterAspect;
  return {
    imageWidth,
    imageHeight,
    offsetX: (width - imageWidth) * anchorX,
    offsetY: (height - imageHeight) * anchorY,
  };
}
