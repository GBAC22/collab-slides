/// <reference types="vite/client" />


interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // agrega otras variables que uses
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
