import type { Api } from './types';

// Sigurnosna provjera: ako preload most nije učitan, ovo je vidljivo umjesto "mrtvog" ekrana.
export const apiAvailable = typeof window !== 'undefined' && !!window.api;

export const api: Api = (window.api as Api) ?? ({} as Api);
