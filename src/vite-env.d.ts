/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_HIDRO_PROXY_BASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
