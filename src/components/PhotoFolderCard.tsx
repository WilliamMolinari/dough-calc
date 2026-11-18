import { useEffect, useState } from "react";
import { FolderOpen, Images, Loader2, MoveRight, Sparkles } from "lucide-react";
import { desktopBridge, type PhotoFolderInfo } from "../lib/desktop";
import { ActionButton, cx } from "./ui";

/**
 * Desktop-only: where bake photos live on disk. Renders nothing in the browser
 * build, where photos stay in IndexedDB.
 */
export function PhotoFolderCard({
  totalPhotos,
  inlinePhotos,
  onMovePhotos,
}: {
  totalPhotos: number;
  /** Photos still embedded in the journal and not yet on disk. */
  inlinePhotos: number;
  onMovePhotos: () => Promise<number>;
}) {
  const bridge = desktopBridge();
  const [folder, setFolder] = useState<PhotoFolderInfo | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge
      .getPhotoFolder()
      .then((info) => {
        if (!cancelled) setFolder(info);
      })
      .catch(() => {
        /* keep the card generic if the native call fails */
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  if (!bridge) return null;

  const chooseFolder = async () => {
    setChoosing(true);
    setMessage(null);
    try {
      const next = await bridge.choosePhotoFolder();
      if (next) {
        setFolder(next);
        setMessage(
          next.copied
            ? `Photos now save into “${next.name}”. ${next.copied} existing photo${next.copied === 1 ? "" : "s"} copied across.`
            : `Photos now save into “${next.name}”.`,
        );
      }
    } catch {
      setMessage("The folder picker could not open.");
    } finally {
      setChoosing(false);
    }
  };

  const movePhotos = async () => {
    setMoving(true);
    setMessage(null);
    try {
      const moved = await onMovePhotos();
      setMessage(
        moved
          ? `Moved ${moved} photo${moved === 1 ? "" : "s"} into the folder.`
          : "Those photos are already on disk.",
      );
    } catch {
      setMessage("Could not move those photos. They are still in the journal.");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-cream/30">
          <Images size={11} /> Photo folder
        </span>
        <span className="font-mono text-[9px] text-cream/25">
          {totalPhotos} photo{totalPhotos === 1 ? "" : "s"} · {inlinePhotos} in the journal
        </span>
      </div>

      <p
        title={folder?.path}
        className="mt-1.5 truncate font-mono text-[10.5px] text-cream/55"
      >
        {folder ? folder.path : "Finding your photo folder…"}
      </p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-cream/30">
        New photos are written here as ordinary JPEG files, so you can open them in Preview,
        Photos or Finder.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ActionButton
          onClick={() => void chooseFolder()}
          icon={choosing ? Loader2 : FolderOpen}
          className="px-2.5 py-1.5 text-[11px]"
          disabled={choosing}
        >
          {choosing ? "Opening…" : "Choose folder"}
        </ActionButton>
        <ActionButton
          onClick={() => void bridge.revealPhotoFolder().catch(() => undefined)}
          icon={Sparkles}
          className="px-2.5 py-1.5 text-[11px]"
        >
          Show in Finder
        </ActionButton>
        {inlinePhotos > 0 && (
          <ActionButton
            onClick={() => void movePhotos()}
            icon={moving ? Loader2 : MoveRight}
            className="px-2.5 py-1.5 text-[11px]"
            disabled={moving}
          >
            {moving ? "Moving…" : `Move ${inlinePhotos} into folder`}
          </ActionButton>
        )}
      </div>

      {message && (
        <p
          role="status"
          className={cx(
            "mt-1.5 text-[10px] leading-relaxed",
            /could not/i.test(message) ? "text-hot/80" : "text-lime/80",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
