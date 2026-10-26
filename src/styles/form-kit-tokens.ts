import { css } from 'lit';

/**
 * Токены темы для диалогов карточки: у панели свои, у карточки — эти.
 *
 * Канва без темы — на 10 % ближе к тексту, чем карточка: светлая тема даёт
 * серый, тёмная — чуть светлее карточки. HA всегда задаёт свою переменную.
 * (Комментарий здесь, а не в CSS: строка листа уезжает в бандл как есть, #526.)
 */
export const cardDialogFormKitTokens = `  ${css`hp-dialog .hpf-form {
    --hpf-surface: var(--card-background-color, #fff);
    --hpf-line: var(--hp-line, var(--divider-color, #dce5e7));
    --hpf-accent: var(--hp-accent, var(--primary-color));
    --hpf-canvas: var(--secondary-background-color, color-mix(in srgb, var(--hpf-surface) 90%, var(--primary-text-color, #000)));
    --hpf-muted: var(--secondary-text-color, #777);
    --hpf-tint: color-mix(in srgb, var(--hpf-accent) 10%, var(--hpf-surface));
    --hpf-tint-line: color-mix(in srgb, var(--hpf-accent) 38%, var(--hpf-surface));
    --hpf-danger: var(--error-color, #db543d);
  }`.cssText}
`;
