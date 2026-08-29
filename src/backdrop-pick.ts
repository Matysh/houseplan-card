/**
 * #39: the shared plan-file pick flow — classification, safe encoding and the
 * reduced-copy path. One module feeds BOTH lazy runtimes (editor space dialog
 * and the onboarding first-space dialog), so the guard cannot drift between
 * them. Nothing here runs in the eager View graph.
 */
import { html, type TemplateResult } from 'lit';
import {
  DOWNSCALE_JPEG_QUALITY, DOWNSCALE_TARGET_PX, DOWNSCALE_TIMEOUT_MS,
  HARD_DIMENSION, downscaleDimensions, probeBackdrop, type BackdropProbe,
} from './backdrop-probe';
import type { I18nKey } from './i18n';

export interface PlanFilePayload {
  ext: string;
  b64: string;
  aspect: number;
  name: string;
}

export interface BackdropGuardState {
  file: File;
  ext: string;
  probe: BackdropProbe;
  busy: boolean;
}

export interface BackdropPickHost {
  _t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  _showToast: (text: string) => void;
  _backdropGuard: BackdropGuardState | null;
  requestUpdate?: () => void;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
};

export function planFileExt(file: File): string {
  return EXT_BY_MIME[file.type] || (file.name.toLowerCase().endsWith('.svg') ? 'svg' : '');
}

/**
 * Base64 via FileReader: the browser encodes natively instead of the old
 * char-by-char string build, cutting the JS-heap peak roughly in half on
 * every upload (spec §UX/safe). Output is byte-identical to btoa(binary).
 */
export function fileToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.onload = () => {
      const url = String(reader.result || '');
      const comma = url.indexOf(',');
      if (comma < 0) { reject(new Error('unexpected data url')); return; }
      resolve(url.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function aspectOf(blob: Blob, fallback = 1.414): Promise<number> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<number>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight : fallback);
      image.onerror = () => resolve(fallback);
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function encodePlanFile(blob: Blob, ext: string, name: string): Promise<PlanFilePayload> {
  const [b64, aspect] = await Promise.all([fileToBase64(blob), aspectOf(blob)]);
  return { ext, b64, aspect, name };
}

/**
 * Classify one picked file. 'svg' and small rasters go straight through; a
 * big or unreadable raster returns the guard state for the dialog. The probe
 * reads header bytes only — no decode happens on this path (spec §Диагностика).
 */
export async function classifyPlanFile(file: File): Promise<
  | { kind: 'reject' }
  | { kind: 'pass'; ext: string }
  | { kind: 'guard'; state: BackdropGuardState }
> {
  const ext = planFileExt(file);
  if (!ext) return { kind: 'reject' };
  if (ext === 'svg') return { kind: 'pass', ext };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const probe = probeBackdrop(bytes, ext);
  if (probe.kind === 'safe') return { kind: 'pass', ext };
  return { kind: 'guard', state: { file, ext, probe, busy: false } };
}

/** Test-only escape hatch for the 10s decode timeout (spec r3, reviewer Low). */
const decodeTimeoutMs = (): number =>
  (globalThis as { __HP_BACKDROP_TIMEOUT_MS?: number }).__HP_BACKDROP_TIMEOUT_MS
    ?? DOWNSCALE_TIMEOUT_MS;

/**
 * Build the reduced copy: EXIF-aware decode, aspect-preserving resize, PNG for
 * alpha, JPEG for opaque. Throws on decode failure or timeout — the caller
 * owns the honest phase-2 UX (toast, clean staging, no silent fallback).
 */
export async function downscaleBackdrop(
  state: BackdropGuardState,
): Promise<{ blob: Blob; ext: string; name: string }> {
  const decode = createImageBitmap(state.file, { imageOrientation: 'from-image' });
  const bitmap = await Promise.race([
    decode,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('decode timeout')), decodeTimeoutMs());
    }),
  ]);
  try {
    const { width, height } = downscaleDimensions(bitmap.width, bitmap.height, DOWNSCALE_TARGET_PX);
    const alpha = state.probe.alpha;
    const type = alpha ? 'image/png' : 'image/jpeg';
    let blob: Blob;
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await canvas.convertToBlob({ type, quality: DOWNSCALE_JPEG_QUALITY });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((out) => (out ? resolve(out) : reject(new Error('encode failed'))),
          type, DOWNSCALE_JPEG_QUALITY);
      });
    }
    const ext = alpha ? 'png' : 'jpg';
    const base = state.file.name.replace(/\.[^.]+$/, '') || 'plan';
    return { blob, ext, name: `${base}-reduced.${ext}` };
  } finally {
    bitmap.close();
  }
}

const megabytes = (bytes: number): string => (bytes / 1048576).toFixed(bytes >= 10 * 1048576 ? 0 : 1);

/**
 * The guard dialog, shared verbatim by both runtimes. `apply` receives the
 * encoded payload of whichever copy the user chose; `close` clears the state.
 */
export function renderBackdropGuard(
  host: BackdropPickHost,
  apply: (payload: PlanFilePayload) => void,
  close: () => void,
  hass: unknown,
): TemplateResult | null {
  const guard = host._backdropGuard;
  if (!guard) return null;
  const { probe } = guard;
  const hard = probe.kind === 'hard';
  const body = hard
    ? host._t('backdrop.too_large_body', {
      w: probe.width ?? 0, h: probe.height ?? 0, limit: HARD_DIMENSION,
    })
    : probe.kind === 'unknown'
      ? host._t('backdrop.unknown_body')
      : host._t('backdrop.large_body', {
        w: probe.width ?? 0,
        h: probe.height ?? 0,
        fileMb: megabytes(guard.file.size),
        decodedMb: megabytes(probe.decodedBytes ?? 0),
      });
  // r1-M1: while a decision is executing, dismissal must not race it — the
  // dialog stays up (buttons are disabled), and even if the guard somehow
  // vanished mid-flight, a stale flow must not apply its result silently.
  const dismiss = (): void => {
    if (host._backdropGuard?.busy) return;
    close();
  };
  const stillCurrent = (): boolean => host._backdropGuard?.file === guard.file;
  const original = async (): Promise<void> => {
    if (host._backdropGuard?.busy) return;
    const payload = await encodePlanFile(guard.file, guard.ext, guard.file.name);
    if (!stillCurrent()) return;
    apply(payload);
    close();
  };
  const reduced = async (): Promise<void> => {
    if (host._backdropGuard?.busy) return;
    host._backdropGuard = { ...guard, busy: true };
    host.requestUpdate?.();
    try {
      const out = await downscaleBackdrop(guard);
      const payload = await encodePlanFile(out.blob, out.ext, out.name);
      if (!stillCurrent()) return;
      apply(payload);
      close();
    } catch {
      // Honest phase 2 (spec §UX): no silent fallback to the original the
      // user just declined — staging stays clean, the toast says what happened.
      if (!stillCurrent()) return;
      close();
      host._showToast(host._t('backdrop.downscale_failed'));
    }
  };
  return html`<hp-dialog .hass=${hass}
      .title=${host._t(hard ? 'backdrop.too_large_title' : 'backdrop.large_title')}
      icon="mdi:image-size-select-large" dismiss-on-scrim @hp-close=${() => dismiss()}>
    <div class="body"><p>${body}</p></div>
    <div class="row" slot="footer">
      <button class="btn ghost" ?disabled=${guard.busy} @click=${() => dismiss()}>
        ${host._t('btn.cancel')}</button>
      <span class="spacer"></span>
      ${hard ? null : html`
        <button class="btn ghost" ?disabled=${guard.busy} @click=${() => original()}>
          ${host._t('backdrop.keep_original')}</button>
        <button class="btn on" ?disabled=${guard.busy} @click=${() => reduced()}>
          ${guard.busy ? host._t('backdrop.reducing') : host._t('backdrop.use_downscaled')}
        </button>`}
    </div>
  </hp-dialog>`;
}
