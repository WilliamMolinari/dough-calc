import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChefHat,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import {
  BakeSommelierError,
  DEFAULT_GEMINI_MODEL,
  askBakeSommelier,
  clearStoredKey,
  getActiveModel,
  getJournalCount,
  getKeySource,
  listAvailableModels,
  modelLabel,
  resetModel,
  saveKey,
  saveModel,
  type ChatTurn,
  type GeminiErrorKind,
  type GeminiKeySource,
} from "../lib/gemini";
import { useDialogLayer } from "../hooks/useDialogLayer";
import { photoSrc } from "../lib/photoFiles";
import { loadBakes } from "../lib/storage";
import { prepareChatPhoto } from "../lib/vision";
import { cx } from "./ui";

const STARTER_PROMPTS = [
  "Why did my last bake have a pale crust?",
  "Analyze my journal and suggest improvements",
  "How can I improve my fermentation schedule?",
];

const MODEL_PRESETS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash — current (default)" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite — fastest" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash — previous" },
  { id: "gemini-flash-latest", label: "Gemini Flash Latest — alias" },
  { id: "gemini-pro-latest", label: "Gemini Pro Latest — deepest analysis" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — legacy (deprecated)" },
];

const isPresetModel = (id: string) => MODEL_PRESETS.some((preset) => preset.id === id);

interface ChatAttachment {
  /** Small data URL used for the thumbnail. */
  preview: string;
  data: string;
  mimeType: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  /** Only user turns carry a photo. */
  photo?: ChatAttachment;
}

interface ChatError {
  kind: GeminiErrorKind;
  message: string;
}

const nextMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/* ------------------------------------------------------------------ */
/* Lightweight, safe markdown                                          */
/* ------------------------------------------------------------------ */

function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-cream">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={index}
            className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[10.5px] text-ember-2"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return <span key={index}>{part}</span>;
    });
}

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((raw, index) => {
          const line = raw.trim();
          if (!line || line.startsWith("```")) {
            return line ? null : <div key={index} className="h-1" />;
          }
          const heading = /^#{1,4}\s+(.*)$/.exec(line);
          if (heading) {
            return (
              <p key={index} className="pt-1 text-[12px] font-semibold text-cream">
                {inline(heading[1])}
              </p>
            );
          }
          const bullet = /^[-*•]\s+(.*)$/.exec(line);
          if (bullet) {
            return (
              <div key={index} className="flex gap-2">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-ember/70" />
                <p className="min-w-0 flex-1">{inline(bullet[1])}</p>
              </div>
            );
          }
          const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
          if (numbered) {
            return (
              <div key={index} className="flex gap-2">
                <span className="mt-[1px] shrink-0 font-mono text-[10px] text-ember/70">
                  {numbered[1]}.
                </span>
                <p className="min-w-0 flex-1">{inline(numbered[2])}</p>
              </div>
            );
          }
          return <p key={index}>{inline(line)}</p>;
        })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function BotAvatar({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-ember-2 via-ember to-hot text-[#1c0b05] shadow-[0_4px_16px_-6px_rgba(255,122,61,0.8)]",
        small ? "size-7" : "size-8",
      )}
    >
      <ChefHat size={small ? 13 : 15} strokeWidth={2} />
    </span>
  );
}

function HeaderButton({
  label,
  onClick,
  icon: Icon,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  icon: typeof X;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-30",
        active
          ? "border-ember/35 bg-ember/15 text-ember-2"
          : "border-white/8 bg-white/[0.03] text-cream/45 hover:border-white/20 hover:text-cream",
      )}
    >
      <Icon size={14} />
    </button>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2" aria-live="polite">
      <BotAvatar small />
      <div className="glass-soft rounded-2xl rounded-tl-md px-3 py-2.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="size-1.5 rounded-full bg-ember/80"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
            />
          ))}
          <span className="ml-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream/30">
            Reading your journal
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chatbot                                                             */
/* ------------------------------------------------------------------ */

export function BakeChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [journalCount, setJournalCount] = useState(0);
  const [keySource, setKeySource] = useState<GeminiKeySource>("none");
  const [keyDraft, setKeyDraft] = useState("");
  const [revealKey, setRevealKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [model, setModel] = useState(getActiveModel);
  const [customModel, setCustomModel] = useState(getActiveModel);
  const [customModelOpen, setCustomModelOpen] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [journalPhotos, setJournalPhotos] = useState<
    Array<{ id: string; bake: string; photo: string }>
  >([]);

  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const titleId = useId();

  const refreshJournal = useCallback(() => {
    setJournalCount(getJournalCount());
  }, []);

  const openChat = useCallback(() => {
    setOpen(true);
    refreshJournal();
    setKeySource(getKeySource());
    setModel(getActiveModel());
  }, [refreshJournal]);

  const closeChat = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => fabRef.current?.focus(), 180);
  }, []);

  useEffect(() => {
    const openSettings = () => {
      openChat();
      setShowKey(true);
    };
    window.addEventListener("doughlab:open-ai-settings", openSettings);
    return () => window.removeEventListener("doughlab:open-ai-settings", openSettings);
  }, [openChat]);

  useDialogLayer({
    active: open,
    onClose: closeChat,
    lockScroll: false,
    trapFocus: false,
    restoreFocus: false,
    autoFocus: false,
  });

  useEffect(() => {
    if (!open) return;
    refreshJournal();
    setKeySource(getKeySource());
    setModel(getActiveModel());
    setCustomModel(getActiveModel());
    setCustomModelOpen(false);
    setModels(null);
    setModelsError(null);
    const timer = window.setTimeout(() => {
      if (showKey) keyInputRef.current?.focus();
      else inputRef.current?.focus();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [open, showKey, refreshJournal]);

  useEffect(() => {
    if (!open) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === "doughlab.bakes.v1") refreshJournal();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [open, refreshJournal]);

  useEffect(() => {
    const area = inputRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 112)}px`;
  }, [input, open, showKey]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !open || showKey) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, loading, error, open, showKey]);

  const requestReply = useCallback(async (history: ChatMessage[]) => {
    if (!history.length) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const turns: ChatTurn[] = history.map(({ role, text, photo }) => ({
      role,
      text,
      ...(photo ? { photo: { data: photo.data, mimeType: photo.mimeType } } : {}),
    }));

    try {
      const reply = await askBakeSommelier(turns, controller.signal);
      if (requestIdRef.current !== requestId) return;
      setMessages((prev) => [...prev, { id: nextMessageId(), role: "model", text: reply }]);
    } catch (caught) {
      if (requestIdRef.current !== requestId) return;
      if (caught instanceof BakeSommelierError) {
        setError({ kind: caught.kind, message: caught.message });
      } else {
        setError({
          kind: "unknown",
          message: "The sommelier couldn't answer that one. Try again.",
        });
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        abortRef.current = null;
        refreshJournal();
      }
    }
  }, [refreshJournal]);

  const send = useCallback(
    async (promptText?: string) => {
      if (loading) return;
      const text = (promptText ?? input).trim();
      const photo = attachment;
      if (!text && !photo) return;

      if (getKeySource() === "none") {
        setKeySource("none");
        setShowKey(true);
        setError({
          kind: "missing-key",
          message: "Add a Gemini API key to start chatting — it stays in this browser.",
        });
        return;
      }

      const userMessage: ChatMessage = {
        id: nextMessageId(),
        role: "user",
        text: (
          text || "What do you see in this photo, and what should I change next?"
        ).slice(0, 2000),
        photo: photo ?? undefined,
      };
      const history = [...messages, userMessage];
      setMessages(history);
      setInput("");
      setAttachment(null);
      setAttachOpen(false);
      setAttachError(null);
      setError(null);
      await requestReply(history);
    },
    [attachment, input, loading, messages, requestReply],
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const retry = () => {
    if (!loading && messages.length) void requestReply(messages);
  };

  const resetChat = () => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setMessages([]);
    setError(null);
    setInput("");
    setAttachment(null);
    setAttachOpen(false);
    setAttachError(null);
    setKeyError(null);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleSaveKey = () => {
    const result = saveKey(keyDraft);
    if (!result.ok) {
      setKeyError(result.error);
      return;
    }
    setKeyDraft("");
    setRevealKey(false);
    setKeyError(null);
    setError(null);
    setKeySource(getKeySource());
    setModels(null);
    setModelsError(null);
    setShowKey(false);
    window.setTimeout(() => inputRef.current?.focus(), 120);
  };

  const handleClearKey = () => {
    clearStoredKey();
    setKeyDraft("");
    setKeyError(null);
    setKeySource(getKeySource());
    setModels(null);
    setModelsError(null);
  };

  const applyModel = (id: string) => {
    const result = saveModel(id);
    if (!result.ok) {
      setModelsError(result.error);
      return;
    }
    const next = getActiveModel();
    setModel(next);
    setCustomModel(next);
    setCustomModelOpen(false);
    setModelsError(null);
    setError(null);
  };

  const handleCustomModel = () => {
    if (!customModel.trim()) return;
    applyModel(customModel);
  };

  const handleResetModel = () => {
    resetModel();
    const next = getActiveModel();
    setModel(next);
    setCustomModel(next);
    setCustomModelOpen(false);
    setModelsError(null);
    setError(null);
  };

  const handleLoadModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const available = await listAvailableModels();
      setModels(available);
      if (!available.length) {
        setModelsError(
          "This key returned no models that support chat. Check its project in Google AI Studio.",
        );
      }
    } catch (caught) {
      setModelsError(
        caught instanceof BakeSommelierError
          ? caught.message
          : "Couldn't load models for this key. Try again.",
      );
    } finally {
      setModelsLoading(false);
    }
  };

  const attachPhoto = async (source: string) => {
    setAttachBusy(true);
    setAttachError(null);
    try {
      const prepared = await prepareChatPhoto(source);
      setAttachment({
        ...prepared,
        preview: `data:${prepared.mimeType};base64,${prepared.data}`,
      });
      setAttachOpen(false);
    } catch (caught) {
      setAttachError(caught instanceof Error ? caught.message : "That photo could not be read.");
    } finally {
      setAttachBusy(false);
    }
  };

  const toggleAttach = () => {
    setAttachOpen((value) => {
      const next = !value;
      if (next) {
        setAttachError(null);
        try {
          setJournalPhotos(
            loadBakes()
              .flatMap((bake) =>
                bake.photos.map((photo, index) => ({
                  id: `${bake.id}-${index}`,
                  bake: bake.name,
                  photo,
                })),
              )
              .slice(0, 18),
          );
        } catch {
          setJournalPhotos([]);
        }
      }
      return next;
    });
  };

  const attachFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAttachError("Choose an image file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setAttachError("That photo is over 12 MB — pick a smaller one.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that file."));
        reader.readAsDataURL(file);
      });
      await attachPhoto(dataUrl);
    } catch (caught) {
      setAttachError(caught instanceof Error ? caught.message : "Could not read that file.");
    }
  };

  const hasKey = keySource !== "none";
  const modelHeading = /^gemini-/.test(model) ? `Gemini ${modelLabel(model)}` : model;
  const sourceLabel =
    keySource === "stored"
      ? "Personal key saved"
      : keySource === "env"
        ? "Project key active"
        : "No key configured";

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            ref={fabRef}
            type="button"
            onClick={openChat}
            aria-label="Ask the DoughLab AI bake sommelier"
            aria-haspopup="dialog"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="group fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2 rounded-full border border-ember/25 bg-[#100b0c]/90 p-1.5 pr-1.5 shadow-[0_18px_50px_-16px_rgba(255,92,61,0.55)] backdrop-blur-xl transition-colors hover:border-ember/50 md:bottom-6 md:right-6 md:pr-4"
          >
            <span className="relative grid size-11 place-items-center rounded-full bg-gradient-to-br from-ember-2 via-ember to-hot text-[#1c0b05] shadow-[0_6px_20px_-6px_rgba(255,122,61,0.9)]">
              <Sparkles size={19} strokeWidth={2} />
              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#100b0c] bg-lime" />
            </span>
            <span className="hidden text-left md:block">
              <span className="block text-[12px] font-semibold leading-tight text-cream">
                Ask the Sommelier
              </span>
              <span className="block font-mono text-[8.5px] uppercase tracking-[0.16em] text-cream/35">
                journal-aware AI
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="chat-panel glass fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 flex h-[min(86dvh,720px)] flex-col overflow-hidden rounded-[26px] border-white/12 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px]"
          >
            {/* Header */}
            <div className="relative shrink-0 border-b border-white/8 bg-gradient-to-r from-ember/[0.09] via-transparent to-hot/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ember-2 via-ember to-hot text-[#1c0b05] shadow-[0_6px_18px_-8px_rgba(255,122,61,0.8)]">
                  <Sparkles size={16} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="truncate text-[13.5px] font-semibold text-cream">
                    Bake Sommelier
                  </h2>
                  <p className="flex items-center gap-1.5 truncate font-mono text-[8.5px] uppercase tracking-[0.1em] text-cream/35">
                    <span
                      className={cx(
                        "size-1.5 shrink-0 rounded-full",
                        hasKey ? "bg-lime" : "bg-hot",
                      )}
                    />
                    {journalCount} {journalCount === 1 ? "bake" : "bakes"} · {modelHeading}
                  </p>
                </div>
                <HeaderButton
                  label="AI settings"
                  onClick={() => {
                    setShowKey((value) => !value);
                    setKeyError(null);
                  }}
                  icon={KeyRound}
                  active={showKey}
                />
                {!showKey && (messages.length > 0 || error) && (
                  <HeaderButton label="Start a new chat" onClick={resetChat} icon={RotateCcw} />
                )}
                <HeaderButton label="Close sommelier" onClick={closeChat} icon={X} />
              </div>
            </div>

            {/* Body */}
            <div
              ref={listRef}
              className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-3.5 py-3"
            >
              {showKey ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-ember/20 bg-ember/10 text-ember">
                      <KeyRound size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-cream">Gemini access</p>
                      <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-cream/35">
                        {sourceLabel}
                      </p>
                    </div>
                    <span
                      className={cx(
                        "ml-auto shrink-0 rounded-full border px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em]",
                        hasKey
                          ? "border-lime/30 bg-lime/10 text-lime"
                          : "border-hot/30 bg-hot/10 text-hot",
                      )}
                    >
                      {hasKey ? "Ready" : "Required"}
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed text-cream/55">
                    The sommelier runs on{" "}
                    <span className="font-mono text-[10px] text-cream/70">{model}</span>. Each
                    question includes a summary of your saved bakes, which is sent to Google&apos;s
                    Gemini API.
                  </p>

                  <label className="block">
                    <span className="text-[11px] font-medium text-cream/60">Personal API key</span>
                    <span className="relative mt-1.5 block">
                      <input
                        ref={keyInputRef}
                        type={revealKey ? "text" : "password"}
                        value={keyDraft}
                        onChange={(event) => {
                          setKeyDraft(event.target.value);
                          setKeyError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleSaveKey();
                        }}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder={
                          keySource === "env"
                            ? "Project key active — save one to override"
                            : keySource === "stored"
                              ? "Paste a new key to replace the saved one"
                              : "Paste your Gemini API key"
                        }
                        aria-label="Gemini API key"
                        className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-2.5 pr-10 font-mono text-[12px] text-cream outline-none transition-colors placeholder:font-sans placeholder:text-[11px] placeholder:text-cream/25 focus:border-ember/60"
                      />
                      <button
                        type="button"
                        onClick={() => setRevealKey((value) => !value)}
                        aria-label={revealKey ? "Hide API key" : "Show API key"}
                        className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-cream/35 transition-colors hover:bg-white/[0.06] hover:text-cream/75"
                      >
                        {revealKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </span>
                    {keyError && (
                      <span role="alert" className="mt-1.5 block text-[10.5px] text-hot/90">
                        {keyError}
                      </span>
                    )}
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveKey}
                      disabled={!keyDraft.trim()}
                      className="btn-ember sheen inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <KeyRound size={13} /> {keySource === "stored" ? "Replace key" : "Save key"}
                    </button>
                    {keySource === "stored" && (
                      <button
                        type="button"
                        onClick={handleClearKey}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-cream/60 transition-colors hover:border-hot/30 hover:text-hot"
                      >
                        Remove saved key
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/8 bg-black/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-cream/70">Gemini model</p>
                        <p className="truncate font-mono text-[9px] text-cream/35">{model}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleLoadModels()}
                        disabled={!hasKey || modelsLoading}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-cream/55 transition-colors hover:border-ember/30 hover:text-cream disabled:opacity-40"
                      >
                        {modelsLoading ? "Checking…" : "Load available"}
                      </button>
                    </div>

                    <div className="relative mt-2">
                      <select
                        aria-label="Gemini model"
                        value={customModelOpen || !isPresetModel(model) ? "__custom" : model}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "__custom") {
                            setCustomModelOpen(true);
                            setCustomModel(isPresetModel(model) ? "" : model);
                            setModelsError(null);
                            return;
                          }
                          applyModel(value);
                        }}
                        className="w-full appearance-none rounded-xl border border-white/10 bg-[#0e0e15] py-2 pl-2.5 pr-8 text-[11.5px] text-cream outline-none transition-colors focus:border-ember/60 [&>option]:bg-[#14141c]"
                      >
                        {MODEL_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                        <option value="__custom">Custom model ID…</option>
                      </select>
                      <ChevronDown
                        size={13}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-cream/35"
                      />
                    </div>

                    {model === "gemini-2.5-flash" && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-ember/20 bg-ember/[0.06] px-2 py-1.5">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0 text-ember" />
                        <p className="flex-1 text-[9.5px] leading-relaxed text-cream/55">
                          Gemini 2.5 Flash is deprecated for new API keys.
                        </p>
                        <button
                          type="button"
                          onClick={() => applyModel("gemini-3.8-flash")}
                          className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] text-ember-2 underline-offset-2 hover:underline"
                        >
                          Use 3.8
                        </button>
                      </div>
                    )}

                    {(customModelOpen || !isPresetModel(model)) && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <input
                          value={customModel}
                          onChange={(event) => {
                            setCustomModel(event.target.value);
                            setModelsError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") handleCustomModel();
                          }}
                          placeholder="e.g. gemini-2.5-flash-lite"
                          aria-label="Custom Gemini model ID"
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[10.5px] text-cream outline-none placeholder:font-sans placeholder:text-[10px] placeholder:text-cream/25 focus:border-ember/60"
                        />
                        <button
                          type="button"
                          onClick={handleCustomModel}
                          disabled={!customModel.trim()}
                          className="shrink-0 rounded-lg border border-ember/25 bg-ember/10 px-2 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-ember-2 transition-colors hover:bg-ember/15 disabled:opacity-40"
                        >
                          Use
                        </button>
                      </div>
                    )}

                    {models && (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/8 bg-black/25 p-1">
                        {models.length === 0 ? (
                          <p className="px-2 py-1.5 text-[10px] text-cream/40">
                            No chat models returned for this key.
                          </p>
                        ) : (
                          models.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => applyModel(id)}
                              className={cx(
                                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]",
                                id === model ? "text-ember-2" : "text-cream/60",
                              )}
                            >
                              <span className="truncate font-mono text-[10px]">{id}</span>
                              {id === model && <Check size={11} className="shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {modelsError && (
                      <p role="alert" className="mt-2 text-[10px] leading-relaxed text-hot/85">
                        {modelsError}
                      </p>
                    )}

                    <div className="mt-2 flex items-start justify-between gap-2">
                      <p className="text-[10px] leading-relaxed text-cream/40">
                        If this model isn&apos;t available for your key or region, load the list and
                        pick one your project can use.
                      </p>
                      {model !== DEFAULT_GEMINI_MODEL && (
                        <button
                          type="button"
                          onClick={handleResetModel}
                          className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] text-cream/30 underline-offset-2 transition-colors hover:text-cream/60 hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky/15 bg-sky/[0.04] p-2.5">
                    <p className="text-[10.5px] leading-relaxed text-sky/80">
                      <ShieldCheck size={11} className="mr-1 inline" />
                      A key saved here stays in this browser&apos;s localStorage. For a public
                      deployment, proxy Gemini through a server so the key is never shipped to
                      visitors.
                    </p>
                  </div>

                  <p className="text-[10px] leading-relaxed text-cream/40">
                    Build-time default: set{" "}
                    <span className="font-mono text-[9.5px] text-cream/60">VITE_GEMINI_API_KEY</span>{" "}
                    (and optionally <span className="font-mono text-[9.5px] text-cream/60">VITE_GEMINI_MODEL</span>)
                    before building. Vite inlines these values, so visitors can read them — use a
                    server proxy for a shared site.
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-ember-2 transition-opacity hover:opacity-80"
                    >
                      Get a key at Google AI Studio <ExternalLink size={11} />
                    </a>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-cream/20">
                      {keySource === "stored"
                        ? "using personal key"
                        : keySource === "env"
                          ? "using VITE_GEMINI_API_KEY"
                          : "no key"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowKey(false)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 text-[12px] text-cream/70 transition-colors hover:border-white/20 hover:text-cream"
                  >
                    Back to chat
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-ember/[0.08] to-transparent p-3">
                    <div className="flex items-start gap-2.5">
                      <BotAvatar />
                      <div className="min-w-0">
                        <p className="text-[12px] leading-relaxed text-cream/80">
                          I&apos;m your bake sommelier.{" "}
                          {journalCount > 0
                            ? `I've read all ${journalCount} saved ${
                                journalCount === 1 ? "bake" : "bakes"
                              } — formulas, temperatures, timings, ratings and notes.`
                            : "Your journal is empty, so I'll answer from pizza science for now. Save a bake and I can diagnose it specifically."}
                        </p>
                        <p className="mt-1.5 text-[10.5px] leading-relaxed text-cream/50">
                          Ask why a crust came out pale, what to change next time, or how to fix a
                          fermentation schedule.
                        </p>
                        {!hasKey && (
                          <button
                            type="button"
                            onClick={() => setShowKey(true)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-ember/30 bg-ember/10 px-2 py-1 text-[10.5px] text-ember-2 transition-colors hover:bg-ember/15"
                          >
                            <KeyRound size={11} /> Connect Gemini to start
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions"
                    className="mt-3 space-y-3"
                  >
                    {messages.map((message) =>
                      message.role === "user" ? (
                        <div key={message.id} className="flex justify-end">
                          <div className="max-w-[86%] overflow-hidden rounded-2xl rounded-br-md border border-ember/20 bg-ember/[0.12] px-3 py-2 text-[12px] leading-relaxed text-cream/90">
                            {message.photo && (
                              <img
                                src={message.photo.preview}
                                alt="Bake photo attached to this message"
                                className="mb-2 max-h-44 w-full rounded-xl object-cover"
                              />
                            )}
                            {message.text}
                          </div>
                        </div>
                      ) : (
                        <div key={message.id} className="flex items-start gap-2">
                          <BotAvatar small />
                          <div className="max-w-[87%] rounded-2xl rounded-tl-md border border-white/8 bg-white/[0.035] px-3 py-2.5 text-[11.5px] leading-relaxed text-cream/70">
                            <ChatMarkdown text={message.text} />
                          </div>
                        </div>
                      ),
                    )}
                    {loading && <TypingBubble />}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!showKey && (
              <div className="shrink-0 border-t border-white/8 bg-black/20">
                {attachOpen && (
                  <div className="mx-3 mt-2 rounded-xl border border-white/10 bg-black/30 p-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-cream/35">
                        Attach a bake photo
                      </p>
                      <button
                        type="button"
                        onClick={() => setAttachOpen(false)}
                        aria-label="Close photo picker"
                        className="text-cream/35 transition-colors hover:text-cream"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    {journalPhotos.length > 0 ? (
                      <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
                        {journalPhotos.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void attachPhoto(item.photo)}
                            aria-label={`Attach photo from ${item.bake}`}
                            title={item.bake}
                            className="h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-ember/50"
                          >
                            <img src={photoSrc(item.photo)} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[10px] leading-relaxed text-cream/35">
                        No saved bake photos yet — upload one below.
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={attachBusy}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-cream/65 transition-colors hover:border-ember/30 hover:text-ember-2 disabled:opacity-40"
                      >
                        {attachBusy ? "Preparing…" : "Upload a photo"}
                      </button>
                      <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-cream/20">
                        sent only when you press send
                      </span>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        void attachFile(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    {attachError && (
                      <p role="alert" className="mt-1.5 text-[10px] leading-relaxed text-hot/90">
                        {attachError}
                      </p>
                    )}
                  </div>
                )}

                {attachment && (
                  <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-sky/20 bg-sky/[0.06] p-1.5">
                    <img
                      src={attachment.preview}
                      alt="Attached bake"
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                    <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-cream/55">
                      Photo attached — the sommelier sees the shot with this message.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      aria-label="Remove attached photo"
                      className="grid size-6 shrink-0 place-items-center rounded-lg text-cream/40 transition-colors hover:text-hot"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="mx-3 mt-2 rounded-xl border border-hot/25 bg-hot/[0.07] px-2.5 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-hot" />
                      <p className="flex-1 text-[10.5px] leading-relaxed text-hot/90">
                        {error.message}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 pl-5">
                      {(error.kind === "missing-key" ||
                        error.kind === "invalid-key" ||
                        error.kind === "model") && (
                        <button
                          type="button"
                          onClick={() => setShowKey(true)}
                          className="rounded-lg border border-hot/25 bg-hot/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-hot transition-colors hover:bg-hot/20"
                        >
                          {error.kind === "model" ? "Model settings" : "Key settings"}
                        </button>
                      )}
                      {error.kind !== "missing-key" && error.kind !== "invalid-key" && (
                        <button
                          type="button"
                          onClick={retry}
                          disabled={loading}
                          className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-cream/60 transition-colors hover:text-cream disabled:opacity-40"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {messages.length === 0 && (
                  <div className="px-3 pt-2.5">
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-cream/25">
                      Try asking
                    </p>
                    <div className="mt-1.5 space-y-1">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void send(prompt)}
                          disabled={loading}
                          className="group flex w-full items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-left text-[10.5px] leading-snug text-cream/55 transition-colors hover:border-ember/30 hover:bg-ember/[0.06] hover:text-cream disabled:opacity-45"
                        >
                          <span>{prompt}</span>
                          <ArrowUp
                            size={11}
                            className="shrink-0 rotate-45 text-cream/20 transition-colors group-hover:text-ember/80"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-3 pb-2.5 pt-2">
                  <div className="flex items-end gap-1.5 rounded-2xl border border-white/10 bg-black/30 p-1.5 transition-colors focus-within:border-ember/40">
                    <button
                      type="button"
                      onClick={toggleAttach}
                      disabled={loading}
                      aria-label="Attach a bake photo"
                      aria-pressed={attachOpen || !!attachment}
                      title="Attach a bake photo"
                      className={cx(
                        "grid size-8 shrink-0 place-items-center rounded-xl border transition-colors disabled:opacity-40",
                        attachment
                          ? "border-sky/40 bg-sky/15 text-sky-2"
                          : "border-white/10 bg-white/[0.04] text-cream/45 hover:text-cream",
                      )}
                    >
                      <ImagePlus size={14} />
                    </button>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                      rows={1}
                      maxLength={2000}
                      placeholder={
                        hasKey ? "Ask about your last bake…" : "Add a key, then ask about a bake…"
                      }
                      aria-label="Ask the bake sommelier"
                      className="max-h-28 min-h-[38px] w-full resize-none bg-transparent px-1.5 py-2 text-[12px] leading-relaxed text-cream outline-none placeholder:text-cream/25"
                    />
                    {loading ? (
                      <button
                        type="button"
                        onClick={stop}
                        aria-label="Stop generating"
                        className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06] text-cream/70 transition-colors hover:text-cream"
                      >
                        <Square size={11} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void send()}
                        disabled={!input.trim() && !attachment}
                        aria-label="Send message"
                        className="btn-ember grid size-8 shrink-0 place-items-center rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowUp size={15} strokeWidth={2.4} />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 px-1 font-mono text-[8.5px] uppercase tracking-[0.06em] text-cream/25">
                    <span>Enter to send</span>
                    <span>AI can be wrong — trust the dough</span>
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
