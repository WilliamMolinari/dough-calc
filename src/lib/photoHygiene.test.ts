import { describe, expect, it } from "vitest";
import { canTrashPhoto, referencedPhotoNames, unusedPhotos } from "./photoHygiene";

describe("desktop photo cleanup", () => {
  it("reads the filenames the journal still points at", () => {
    const names = referencedPhotoNames([
      "file:doughlab-20260101-1200-abc123.jpg",
      "data:image/jpeg;base64,AAAA",
      "file:../escape.jpg",
    ]);
    expect([...names]).toEqual(["doughlab-20260101-1200-abc123.jpg"]);
  });

  it("proposes only unreferenced files this app created", () => {
    const referenced = referencedPhotoNames(["file:doughlab-keep.jpg"]);
    const unused = unusedPhotos(
      [
        { name: "doughlab-keep.jpg", size: 1000 },
        { name: "doughlab-orphan.jpg", size: 2000 },
        { name: "doughlab-orphan.png", size: 500 },
        { name: "holiday.jpg", size: 9000 },
        { name: "notes.txt", size: 10 },
      ],
      referenced,
    );
    expect(unused.count).toBe(2);
    expect(unused.bytes).toBe(2500);
    expect(unused.files.map((file) => file.name)).toEqual([
      "doughlab-orphan.jpg",
      "doughlab-orphan.png",
    ]);
  });

  it("refuses anything that could escape the photo folder", () => {
    expect(canTrashPhoto("doughlab-20260101-1200-abc.jpg")).toBe(true);
    expect(canTrashPhoto("../doughlab-x.jpg")).toBe(false);
    expect(canTrashPhoto("doughlab-x/../../y.jpg")).toBe(false);
    expect(canTrashPhoto("someone-elses.jpg")).toBe(false);
  });
});
