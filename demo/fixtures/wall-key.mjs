/**
 * Ключ записи толщины стены — один на все фикстуры проекта.
 *
 * Копия формулы из `src/wall-thickness.ts`, и копия здесь неизбежна. Фикстуры
 * обязаны оставаться без внешних импортов: бэкенд-гейт запускает их как
 * `node --input-type=module --eval "import * as f from './demo/fixtures/…'"`
 * в job без `npm ci` и без `test-build/` (`.github/workflows/validate.yml`,
 * job `backend`), а `scripts/source-fingerprint.mjs` хеширует только `src/**`
 * и `.mjs` из `demo/fixtures` и `demo/golden` — код, втянутый из `scripts/`,
 * менял бы поведение фикстуры при неизменном отпечатке, на котором стоят и
 * валидность golden-эталонов, и переиспользование гейтов.
 *
 * Поэтому файл лежит ЗДЕСЬ, внутри `demo/fixtures`: так он попадает в
 * отпечаток, и так его видит одна привязка вместо трёх копий формулы.
 * `test/fixture-wall-key.test.mjs` сверяет его с продуктовым `wallKey`.
 *
 * Ловушка, из-за которой этот файл и появился (#260): точность зависит от шага.
 * При `pitch = 1/240` продукт печатает ШЕСТЬ знаков, а не четыре — фикстура с
 * четырьмя расходилась с продуктом на каждой записи и находилась только через
 * терпимый запас `lookupWall`. Метка вместо ключа (`perf-wall-0-3`) не
 * находилась вовсе: все сплошные рёбра оставались с нулевой толщиной.
 */

/** Шаг решётки редактора в нормализованных координатах (`GRID_N = 240`). */
export const WALL_KEY_PITCH = 1 / 240;

/** Направление стены по модулю 180°: стена одна и та же с любого конца. */
const direction = (a, b) => {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) return [1, 0];
  dx /= length; dy /= length;
  if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) return [-dx, -dy];
  return [dx, dy];
};

/**
 * Координата, отличающаяся от узла решётки не больше точности хранения, — это
 * тот же узел (#258). Канонизация опознания, а не снап геометрии: произвольная
 * точка вне решётки остаётся вне решётки. Без этого шага ничья округления на
 * стене нечётной длины в шагах разводила один и тот же ключ на два.
 */
const keyEpsilon = (pitch) => Math.max(Math.abs(pitch) * 1e-6, 1e-9);
const canonical = (value, pitch) => {
  if (!(pitch > 0) || !Number.isFinite(value)) return value;
  const snapped = Math.round(value / pitch) * pitch;
  return Math.abs(snapped - value) <= keyEpsilon(pitch) ? snapped : value;
};

export const fixtureWallKey = (a, b, pitch = WALL_KEY_PITCH) => {
  const quantise = (value) => (pitch > 0 && Number.isFinite(value)
    ? Math.round(value / pitch) * pitch : value);
  const ca = [canonical(a[0], pitch), canonical(a[1], pitch)];
  const cb = [canonical(b[0], pitch), canonical(b[1], pitch)];
  const mx = quantise((ca[0] + cb[0]) / 2);
  const my = quantise((ca[1] + cb[1]) / 2);
  const [dx, dy] = direction(ca, cb);
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI;
  const bucket = Math.round(angle * 1800) / 1800;
  const precision = pitch > 0 && pitch < 0.01 ? 6 : pitch < 1 ? 4 : 2;
  return `${mx.toFixed(precision)},${my.toFixed(precision)}@${bucket.toFixed(4)}`;
};
