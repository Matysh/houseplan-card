// Фактические границы рисунка пути (#584).
//
// Контракт мебели говорит о ВИДИМОМ габарите: «ширина × глубина» из каталога
// обязаны совпасть с тем, что человек видит на плане. Проверять это по
// `viewBox` нельзя — именно расхождение между `viewBox` и рисунком внутри него
// и было дефектом: у всех 44 дизайнерских символов рисунок занимал около 88 %
// стороны, а legacy-примитивы заполняли бокс целиком, поэтому два предмета
// 60 × 60 выглядели разными.
//
// Границы считаются по осевой линии контура (решение владельца по Q1): обводка
// выступает наружу на половину толщины и в габарит не входит. Иначе смена
// толщины линии пересчитывала бы геометрию.
//
// Почему здесь свой разбор, а не `parseSvgPath` из `src/pdf/svg-path.ts`:
// генератор — `.mjs` и обязан работать без сборки TypeScript. Чтобы две
// реализации не разъехались молча, тест
// `test/furniture-visual-bounds.test.mjs` сверяет их на всей библиотеке: та же
// математика кубик, те же числа.

const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Дуга → кубики: та же формула, что у продакшен-экспорта в PDF. */
function arcToCubics(x0, y0, rx, ry, rotation, largeArc, sweep, x, y) {
  if (!rx || !ry) return [[x0, y0, x, y, x, y]];
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const dx = (x0 - x) / 2, dy = (y0 - y) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  let radiusX = Math.abs(rx), radiusY = Math.abs(ry);
  const lambda = (x1 * x1) / (radiusX * radiusX) + (y1 * y1) / (radiusY * radiusY);
  if (lambda > 1) { const s = Math.sqrt(lambda); radiusX *= s; radiusY *= s; }
  const sign = largeArc === sweep ? -1 : 1;
  const numerator = radiusX * radiusX * radiusY * radiusY
    - radiusX * radiusX * y1 * y1 - radiusY * radiusY * x1 * x1;
  const denominator = radiusX * radiusX * y1 * y1 + radiusY * radiusY * x1 * x1;
  const factor = sign * Math.sqrt(Math.max(0, numerator / (denominator || 1)));
  const cx1 = (factor * radiusX * y1) / radiusY;
  const cy1 = (-factor * radiusY * x1) / radiusX;
  const cx = cos * cx1 - sin * cy1 + (x0 + x) / 2;
  const cy = sin * cx1 + cos * cy1 + (y0 + y) / 2;
  const angle = (ux, uy, vx, vy) => {
    const norm = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
    const cosine = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / norm));
    return (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos(cosine);
  };
  const start = angle(1, 0, (x1 - cx1) / radiusX, (y1 - cy1) / radiusY);
  let sweepAngle = angle((x1 - cx1) / radiusX, (y1 - cy1) / radiusY,
    (-x1 - cx1) / radiusX, (-y1 - cy1) / radiusY);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  const steps = Math.max(1, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2)));
  const delta = sweepAngle / steps;
  const alpha = (4 / 3) * Math.tan(delta / 4);
  const out = [];
  let theta = start;
  let px = x0, py = y0;
  for (let index = 0; index < steps; index++) {
    const next = theta + delta;
    const point = (t) => {
      const ex = cos * radiusX * Math.cos(t) - sin * radiusY * Math.sin(t) + cx;
      const ey = sin * radiusX * Math.cos(t) + cos * radiusY * Math.sin(t) + cy;
      return [ex, ey];
    };
    const derivative = (t) => {
      const ex = -cos * radiusX * Math.sin(t) - sin * radiusY * Math.cos(t);
      const ey = -sin * radiusX * Math.sin(t) + cos * radiusY * Math.cos(t);
      return [ex, ey];
    };
    const [ex, ey] = point(next);
    const [dx1, dy1] = derivative(theta);
    const [dx2, dy2] = derivative(next);
    out.push([px + alpha * dx1, py + alpha * dy1, ex - alpha * dx2, ey - alpha * dy2, ex, ey]);
    px = ex; py = ey; theta = next;
  }
  return out;
}

/** Экстремумы кубики по одной оси: концы плюс корни производной. */
function cubicExtrema(p0, p1, p2, p3) {
  const values = [p0, p3];
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const at = (t) => {
    if (!(t > 0 && t < 1)) return;
    const u = 1 - t;
    values.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3);
  };
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) at(-c / b); }
  else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      at((-root - b) / (2 * a));
      at((root - b) / (2 * a));
    }
  }
  return values;
}

/**
 * Границы рисунка пути: `{ minX, minY, maxX, maxY }`.
 *
 * Точки управления в габарит НЕ входят: считаются настоящие экстремумы кривых,
 * иначе контракт «рисунок заполняет бокс» проверялся бы по выпуклой оболочке и
 * пропускал бы поля.
 */
export function svgPathBounds(d) {
  const tokens = String(d).match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const noteX = (value) => { minX = Math.min(minX, value); maxX = Math.max(maxX, value); };
  const noteY = (value) => { minY = Math.min(minY, value); maxY = Math.max(maxY, value); };
  const note = (x, y) => { noteX(x); noteY(y); };
  let x = 0, y = 0, startX = 0, startY = 0;
  let prevControl = null, prevQuadratic = null, command = '';
  let index = 0;
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) { command = tokens[index]; index++; }
    else if (!command) throw new Error('путь начинается не с команды');
    else if (command === 'M') command = 'L';
    else if (command === 'm') command = 'l';
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const arity = ARITY[upper];
    if (arity === undefined) throw new Error(`неизвестная команда ${command}`);
    const args = tokens.slice(index, index + arity).map(Number);
    if (args.length < arity) break;
    index += arity;
    const px = relative ? x : 0, py = relative ? y : 0;
    const cubic = (x1, y1, x2, y2, ex, ey) => {
      for (const value of cubicExtrema(x, x1, x2, ex)) noteX(value);
      for (const value of cubicExtrema(y, y1, y2, ey)) noteY(value);
      x = ex; y = ey;
    };
    if (upper === 'M') { x = px + args[0]; y = py + args[1]; startX = x; startY = y; note(x, y); prevControl = prevQuadratic = null; }
    else if (upper === 'L') { x = px + args[0]; y = py + args[1]; note(x, y); prevControl = prevQuadratic = null; }
    else if (upper === 'H') { x = px + args[0]; note(x, y); prevControl = prevQuadratic = null; }
    else if (upper === 'V') { y = py + args[0]; note(x, y); prevControl = prevQuadratic = null; }
    else if (upper === 'C') {
      const x1 = px + args[0], y1 = py + args[1], x2 = px + args[2], y2 = py + args[3];
      const ex = px + args[4], ey = py + args[5];
      cubic(x1, y1, x2, y2, ex, ey); prevControl = [x2, y2]; prevQuadratic = null;
    } else if (upper === 'S') {
      const x1 = prevControl ? 2 * x - prevControl[0] : x;
      const y1 = prevControl ? 2 * y - prevControl[1] : y;
      const x2 = px + args[0], y2 = py + args[1], ex = px + args[2], ey = py + args[3];
      cubic(x1, y1, x2, y2, ex, ey); prevControl = [x2, y2]; prevQuadratic = null;
    } else if (upper === 'Q' || upper === 'T') {
      const qx = upper === 'Q' ? px + args[0] : (prevQuadratic ? 2 * x - prevQuadratic[0] : x);
      const qy = upper === 'Q' ? py + args[1] : (prevQuadratic ? 2 * y - prevQuadratic[1] : y);
      const ex = upper === 'Q' ? px + args[2] : px + args[0];
      const ey = upper === 'Q' ? py + args[3] : py + args[1];
      cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y),
        ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
      prevQuadratic = [qx, qy]; prevControl = null;
    } else if (upper === 'A') {
      const ex = px + args[5], ey = py + args[6];
      for (const segment of arcToCubics(x, y, args[0], args[1], args[2], !!args[3], !!args[4], ex, ey)) {
        cubic(segment[0], segment[1], segment[2], segment[3], segment[4], segment[5]);
      }
      prevControl = prevQuadratic = null;
    } else if (upper === 'Z') { x = startX; y = startY; prevControl = prevQuadratic = null; }
  }
  if (!Number.isFinite(minX)) throw new Error('путь не содержит точек');
  return { minX, minY, maxX, maxY };
}

/** Насколько рисунок НЕ дотягивается до своего бокса (или вылезает из него). */
export function boxFillDeviation(d, width, height) {
  const bounds = svgPathBounds(d);
  return Math.max(
    Math.abs(bounds.minX), Math.abs(bounds.minY),
    Math.abs(width - bounds.maxX), Math.abs(height - bounds.maxY),
  );
}
