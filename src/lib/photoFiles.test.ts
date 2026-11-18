import { describe, expect, it } from "vitest";
import {
  countInlinePhotos,
  isStoredPhoto,
  photoFileName,
  photoSrc,
  materializePhotos,
} from "./photoFiles";

const INLINE = "data:image/jpeg;base64,AAAA";

describe("photo files", () => {
  it("tells inline photos apart from saved files", () => {
    expect(isStoredPhoto(INLINE)).toBe(false);
    expect(isStoredPhoto("file:doughlab-1.jpg")).toBe(true);
    expect(photoFileName("file:doughlab-1.jpg")).toBe("doughlab-1.jpg");
    expect(photoFileName("file:../escape.jpg")).toBeNull();
    expect(photoFileName(INLINE)).toBeNull();
  });

  it("passes inline photos straight through to an img src", () => {
    expect(photoSrc(INLINE)).toBe(INLINE);
  });

  it("shows a placeholder instead of a broken image without the desktop app", () => {
    expect(photoSrc("file:doughlab-1.jpg")).toMatch(/^data:image\/svg\+xml/);
    expect(photoSrc("")).toMatch(/^data:image\/svg\+xml/);
  });

  it("leaves photos untouched in the browser build", async () => {
    const photos = [INLINE, "file:doughlab-1.jpg"];
    expect(await materializePhotos(photos)).toEqual(photos);
    expect(countInlinePhotos(photos)).toBe(1);
  });
});
