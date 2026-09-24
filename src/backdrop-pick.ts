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
  /** The bytes as picked (or the reduced copy); uploaded as-is over HTTP (#617). */
  blob: Blob;
  aspect: number;
  name: string;
}

/**
 * #617: the plan file limit, in raw file bytes. The SAME number as
 * `MAX_PLAN_BYTES` in `custom_components/houseplan/validation.py` and the "8"
 * in both USER-GUIDEs — `test/plan-upload-limit.test.mjs` holds them together.
 * Inclusive: a file of exactly this size is accepted on both sides.
 */
export const MAX_PLAN_BYTES = 8 * 1024 * 1024;
/** The limit as users read it ("8 MB"), derived — never a second literal. */
export const MAX_PLAN_MB = MAX_PLAN_BYTES / 1048576;

export const PLAN_UPLOAD_PATH = '/api/houseplan/plans/upload';

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

/**
 * Stage a plan file for upload. No base64 any more (#617): the bytes travel
 * as multipart over HTTP, so the payload keeps the Blob itself and only the
 * aspect ratio has to be read here.
 */
export async function encodePlanFile(blob: Blob, ext: string, name: string): Promise<PlanFilePayload> {
  return { ext, blob, aspect: await aspectOf(blob), name };
}

/**
 * #617: one pick path for BOTH runtimes (editor space dialog and onboarding).
 * Returns the staged payload, or null when the file was refused (toast shown)
 * or handed to the #39 guard dialog. A raster above the plan limit always goes
 * to the guard — which then offers only the reduced copy — and anything else
 * above the limit (SVG) is refused right here, before a single byte is sent.
 */
export async function stagePlanFile(host: BackdropPickHost, file: File): Promise<PlanFilePayload | null> {
  const refuse = (key: I18nKey, vars?: Record<string, string | number>): null => {
    host._showToast(host._t(key, vars));
    return null;
  };
  const classified = await classifyPlanFile(file, MAX_PLAN_BYTES);
  if (classified.kind === 'reject') return refuse('toast.plan_formats');
  if (classified.kind === 'guard') {
    host._backdropGuard = classified.state;
    return null;
  }
  if (file.size > MAX_PLAN_BYTES) return refuse('toast.plan_too_large', { mb: MAX_PLAN_MB });
  return encodePlanFile(file, classified.ext, file.name);
}

/** Minimal slice of `hass` the upload needs — the same two paths `_pickMarkerFiles` uses. */
export interface PlanUploadHass {
  fetchWithAuth?: (path: string, init?: RequestInit) => Promise<Response>;
  auth?: { data?: { access_token?: string } };
}

/**
 * #617: upload a staged plan over HTTP and return its URL. WebSocket is not
 * involved: a base64 frame above ~3 MiB used to close the card's socket
 * before the server could even answer `too_large`. Errors are thrown as
 * user-facing text; a 413 without a JSON body (a proxy in front of HA)
 * still names the limit.
 */
export async function uploadPlanFile(
  hass: PlanUploadHass | null | undefined,
  t: BackdropPickHost['_t'],
  spaceId: string,
  payload: PlanFilePayload,
): Promise<{ url: string }> {
  const body = new FormData();
  body.append('space_id', spaceId);
  body.append('ext', payload.ext);
  body.append('file', payload.blob, payload.name || `plan.${payload.ext}`);
  // fetchWithAuth refreshes a stale access_token itself; the fallback is the raw token
  const response: Response = hass?.fetchWithAuth
    ? await hass.fetchWithAuth(PLAN_UPLOAD_PATH, { method: 'POST', body })
    : await fetch(PLAN_UPLOAD_PATH, {
      method: 'POST',
      body,
      headers: hass?.auth?.data?.access_token
        ? { authorization: `Bearer ${hass.auth.data.access_token}` } : {},
    });
  const json: { error?: string; max_mb?: number; url?: string } =
    await response.json().catch(() => ({}));
  if (!response.ok || json.error || typeof json.url !== 'string') {
    const code = json.error || (response.status === 413 ? 'too_large' : '');
    const messages: Record<string, string> = {
      too_large: t('err.too_large', { mb: json.max_mb || MAX_PLAN_MB }),
      bad_ext: t('err.bad_ext'),
      unauthorized: t('err.unauthorized'),
    };
    throw new Error(messages[code] || code || `HTTP ${response.status}`);
  }
  return { url: json.url };
}

/**
 * Classify one picked file. 'svg' and small rasters go straight through; a
 * big or unreadable raster returns the guard state for the dialog. The probe
 * reads header bytes only — no decode happens on this path (spec §Диагностика).
 */
export async function classifyPlanFile(file: File, guardAboveBytes = Infinity): Promise<
  | { kind: 'reject' }
  | { kind: 'pass'; ext: string }
  | { kind: 'guard'; state: BackdropGuardState }
> {
  const ext = planFileExt(file);
  if (!ext) return { kind: 'reject' };
  if (ext === 'svg') return { kind: 'pass', ext };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const probe = probeBackdrop(bytes, ext);
  if (probe.kind === 'safe' && file.size <= guardAboveBytes) return { kind: 'pass', ext };
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
  blobApply?: (blob: Blob, name: string) => Promise<void>,
  allowOriginal = true,
  planLimitBytes?: number,
): TemplateResult | null {
  const guard = host._backdropGuard;
  if (!guard) return null;
  const { probe } = guard;
  const hard = probe.kind === 'hard';
  const reducedDimensions = probe.width && probe.height
    ? downscaleDimensions(probe.width, probe.height, DOWNSCALE_TARGET_PX)
    : null;
  const overPlanLimit = planLimitBytes !== undefined && guard.file.size > planLimitBytes;
  const body = hard
    ? host._t('backdrop.too_large_body', {
      w: probe.width ?? 0, h: probe.height ?? 0, limit: HARD_DIMENSION,
    })
    : probe.kind === 'unknown'
      ? host._t('backdrop.unknown_body')
      : overPlanLimit
        ? host._t('backdrop.over_limit_body', {
          fileMb: megabytes(guard.file.size), mb: (planLimitBytes ?? 0) / 1048576,
        })
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
    if (blobApply) {
      host._backdropGuard = { ...guard, busy: true };
      host.requestUpdate?.();
      await blobApply(guard.file, guard.file.name);
      if (stillCurrent()) close();
      return;
    }
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
      if (blobApply) {
        await blobApply(out.blob, out.name);
        if (stillCurrent()) close();
        return;
      }
      // #617: the reduced copy of a huge scan can still be over the plan
      // limit — refuse it here instead of letting the server answer 413.
      if (planLimitBytes !== undefined && out.blob.size > planLimitBytes) {
        if (!stillCurrent()) return;
        close();
        host._showToast(host._t('toast.plan_too_large', { mb: planLimitBytes / 1048576 }));
        return;
      }
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
  return html`<hp-dialog .hass=${hass} data-kind="decor"
      .title=${host._t(hard ? 'backdrop.too_large_title' : 'backdrop.large_title')}
      icon="mdi:image-size-select-large" dismiss-on-scrim @hp-close=${() => dismiss()}>
    <div class="body"><p>${body}</p>
      ${reducedDimensions ? html`<p>${host._t('backdrop.reduced_dimensions', {
        w: reducedDimensions.width, h: reducedDimensions.height,
      })}</p>` : null}
    </div>
    <div class="row" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${guard.busy} @click=${() => dismiss()}>
        ${host._t('btn.cancel')}</button>
      <span class="spacer"></span>
      ${hard ? null : html`
        ${allowOriginal ? html`
          <button class="btn ghost" data-hp="dialog-confirm"
            ?disabled=${guard.busy} @click=${() => original()}>
            ${host._t('backdrop.keep_original')}</button>` : null}
        <button class="btn on" data-hp="dialog-confirm"
          ?disabled=${guard.busy} @click=${() => reduced()}>
          ${guard.busy ? host._t('backdrop.reducing') : host._t('backdrop.use_downscaled')}
        </button>`}
    </div>
  </hp-dialog>`;
}

/**
 * #617: the guard dialog for a PLAN file, shared by both runtimes. Above the
 * plan limit the original cannot be uploaded at all, so only the reduced copy
 * is offered — the same shape the decor path uses for its 2 MiB limit.
 */
export function renderPlanBackdropGuard(
  host: BackdropPickHost,
  apply: (payload: PlanFilePayload) => void,
  close: () => void,
  hass: unknown,
): TemplateResult | null {
  const size = host._backdropGuard?.file.size ?? 0;
  return renderBackdropGuard(host, apply, close, hass, undefined, size <= MAX_PLAN_BYTES, MAX_PLAN_BYTES);
}
