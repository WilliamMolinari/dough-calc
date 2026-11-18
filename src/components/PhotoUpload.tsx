import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { cx } from "./ui";

export const MAX_PHOTOS = 6;
const MAX_EDGE = 1400;

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image"));
    img.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function PhotoUpload({
  photos,
  onChange,
  onError,
  onBusyChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const setWorking = (value: boolean) => {
    setBusy(value);
    onBusyChange?.(value);
  };

  const addFiles = async (files: FileList | null) => {
    if (busy || !files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      onError?.(`You can attach up to ${MAX_PHOTOS} photos per bake.`);
      return;
    }

    const chosen = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, room);

    if (chosen.length === 0) {
      onError?.("Only image files can be attached.");
      return;
    }

    setWorking(true);
    const results: string[] = [];
    for (const file of chosen) {
      try {
        results.push(await compressImage(file));
      } catch {
        onError?.(`Could not read ${file.name}.`);
      }
    }
    if (results.length) onChange([...photos, ...results]);
    setWorking(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-cream/60">Photos</p>
        <p className="font-mono text-[10px] text-cream/25">
          {photos.length}/{MAX_PHOTOS} · resized on device
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(event.dataTransfer.files);
        }}
        className={cx(
          "mt-1.5 rounded-2xl border border-dashed p-2.5 transition-colors",
          dragging ? "border-ember/60 bg-ember/[0.06]" : "border-white/12 bg-black/15",
        )}
      >
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div
              key={`${photo.slice(-24)}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/30"
            >
              <img
                src={photo}
                alt={`Bake photo ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, i) => i !== index))}
                disabled={busy}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full border border-white/20 bg-black/70 text-cream/80 opacity-90 transition-colors hover:bg-hot/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] text-cream/35 transition-colors hover:border-ember/40 hover:bg-ember/[0.05] hover:text-ember-2 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={18} className="animate-spin text-ember" />
              ) : (
                <ImagePlus size={18} />
              )}
              <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
                {busy ? "Working" : "Add"}
              </span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream/30 transition-colors hover:text-cream/60 disabled:opacity-40"
        >
          <Camera size={12} />
          or drop cornicione & crumb shots here
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="Add bake photos"
          onChange={(event) => void addFiles(event.target.files)}
        />
      </div>
    </div>
  );
}
