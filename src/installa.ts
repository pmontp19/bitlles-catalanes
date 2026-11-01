// Instal·lació com a app (PWA). Android/Chrome: avís natiu (`beforeinstallprompt`).
// iPhone/iPad: Safari no avisa mai; cal explicar "Compartir → Afegeix a la pantalla d'inici".
// Es proposa quan el jugador ja ha jugat (no a la primera visita) i, si la descarta, no s'insisteix en 7 dies.

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let diferit: PromptEvent | null = null;
let onCanvi: () => void = () => {};

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sense emmagatzematge */ } };

export function esInstallada(): boolean {
  return matchMedia('(display-mode: fullscreen)').matches
    || matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function esIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Es pot proposar ara mateix? (no instal·lada, i el navegador ho permet o és un iPhone). */
export function potInstallar(): boolean {
  if (esInstallada() || get('installada') === '1') return false;
  return !!diferit || esIOS();
}

/** Toca proposar-ho per iniciativa nostra? Només si ja ha jugat i no ho ha descartat fa poc. */
export function tocaProposar(): boolean {
  if (!potInstallar()) return false;
  if (Number(get('partides') ?? 0) < 1) return false;
  const desc = Number(get('installa-descartat') ?? 0);
  return Date.now() - desc > 7 * 24 * 3600 * 1000;
}

export function descarta() { set('installa-descartat', String(Date.now())); }

/** Android: obre l'avís natiu. Torna `true` si s'ha instal·lat. iOS: torna `null` (cal ensenyar instruccions). */
export async function installa(): Promise<boolean | null> {
  if (!diferit) return null;
  const e = diferit;
  diferit = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') set('installada', '1'); else descarta();
  onCanvi();
  return outcome === 'accepted';
}

/** Icona del botó Compartir de Safari, per a les instruccions d'iOS. */
export const ICONA_COMPARTIR = `<svg viewBox="0 0 24 24" width="22" height="22" aria-label="Compartir" style="vertical-align:-5px"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6v10h12V10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

export function iniciaInstallacio(canvi: () => void) {
  onCanvi = canvi;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // la proposem nosaltres, en el moment adequat
    diferit = e as PromptEvent;
    onCanvi();
  });
  addEventListener('appinstalled', () => { set('installada', '1'); diferit = null; onCanvi(); });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js'); });
  }
}

export function comptaPartida() {
  set('partides', String(Number(get('partides') ?? 0) + 1));
}
