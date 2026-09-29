"use client";

/**
 * DOM nodes the hero pieces share without prop drilling: where focus returns when the part
 * panel closes (the parts-list trigger or the stage), and the boxes the camera frames around.
 */
export const heroDom: {
  stage: HTMLElement | null;
  media: HTMLElement | null;
  copy: HTMLElement | null;
  strip: HTMLElement | null;
  listTrigger: HTMLButtonElement | null;
} = {
  stage: null,
  media: null,
  copy: null,
  strip: null,
  listTrigger: null,
};
