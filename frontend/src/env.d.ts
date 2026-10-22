/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_API_WS_BASE?: string
  [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
