/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIFF_ID: string
  readonly VITE_API_URL: string
  readonly VITE_LIVE_API_URL: string
  readonly VITE_ENV: 'development' | 'production'
  readonly VITE_AWS_IVS_API_KEY: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
