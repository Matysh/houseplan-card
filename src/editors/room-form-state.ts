/**
 * #600 К10 для «Настроек комнаты»: снимок при открытии, dirty, валидация.
 *
 * Черновик комнаты живёт не объектом, а полями хоста (`_nameSel`, `_roomFill`,
 * …) — снимок собирает их в один отпечаток. Поля хоста не получают новых
 * ключей.
 */
import { roomTempThresholdDraft } from '../space-dialog';
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import { dialogDirty, forgetDialogBaseline, rememberDialogBaseline, stableKey } from './dialog-baseline';

type RoomDraftHost = Pick<HouseplanEditorHostPort,
  '_nameSel' | '_areaSel' | '_roomFill' | '_roomCustomFill' | '_roomTempMin' | '_roomTempMax'
  | '_roomTempSrc' | '_roomHumSrc' | '_roomNameScale' | '_roomLabelScale' | '_roomEditId'>;

export function roomDraftKey(h: RoomDraftHost): string {
  return stableKey({
    name: h._nameSel, area: h._areaSel, fill: h._roomFill, customFill: h._roomCustomFill,
    tempMin: h._roomTempMin, tempMax: h._roomTempMax, tempSrc: h._roomTempSrc, humSrc: h._roomHumSrc,
    nameScale: h._roomNameScale, labelScale: h._roomLabelScale,
  });
}

export function rememberRoomBaseline(host: object & RoomDraftHost): void {
  rememberDialogBaseline(host, 'room', roomDraftKey(host));
}

export function forgetRoomBaseline(host: object): void {
  forgetDialogBaseline(host, 'room');
}

export function roomDirty(host: object & RoomDraftHost): boolean {
  return dialogDirty(host, 'room', roomDraftKey(host));
}

export interface RoomProblem {
  field: string;
  message: 'room.error_name' | 'room.error_temp_range';
}

/**
 * Ошибки черновика (§6.2): в edit имя обязательно; в create — имя или зона;
 * границы комфорта — числа либо пусто (наследование).
 */
export function roomProblems(h: RoomDraftHost): RoomProblem[] {
  const problems: RoomProblem[] = [];
  const edit = !!h._roomEditId;
  if (edit ? !h._nameSel.trim() : !(h._areaSel || h._nameSel.trim())) {
    problems.push({ field: 'room-name', message: 'room.error_name' });
  }
  if (!roomTempThresholdDraft(h._roomTempMin, h._roomTempMax).valid) {
    problems.push({ field: 'room-temp-min', message: 'room.error_temp_range' });
  }
  return problems;
}
