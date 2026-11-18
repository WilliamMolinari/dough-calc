/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional project-level Gemini API key. Prefer a server proxy for public deployments. */
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
