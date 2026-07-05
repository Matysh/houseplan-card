import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lqiColor, snapToGrid, segKey, samePoint, pointInPolygon, markerIdForBinding, averageLqi,
  fitView, declump,
} from '../test-build/logic.js';
import { iconFor } from '../test-build/rules.js';

test('lqiColor: границы и середина', () => {
  assert.equal(lqiColor(40), 'hsl(0, 85%, 55%)');
  assert.equal(lqiColor(180), 'hsl(120, 85%, 55%)');
  assert.equal(lqiColor(110), 'hsl(60, 85%, 55%)');
  assert.equal(lqiColor(0), 'hsl(0, 85%, 55%)');
  assert.equal(lqiColor(255), 'hsl(120, 85%, 55%)');
});

test('snapToGrid', () => {
  assert.equal(snapToGrid(0, 10), 0);
  assert.equal(snapToGrid(14, 10), 10);
  assert.equal(snapToGrid(16, 10), 20);
});

test('segKey: направление не влияет', () => {
  assert.equal(segKey([0, 0], [10, 5]), segKey([10, 5], [0, 0]));
  assert.notEqual(segKey([0, 0], [10, 5]), segKey([0, 0], [10, 6]));
});

test('samePoint с допуском', () => {
  assert.ok(samePoint([1, 1], [1.0005, 0.9995]));
  assert.ok(!samePoint([1, 1], [1.5, 1]));
});

test('pointInPolygon: квадрат', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.ok(pointInPolygon([5, 5], sq));
  assert.ok(!pointInPolygon([15, 5], sq));
  assert.ok(!pointInPolygon([-1, -1], sq));
});

test('pointInPolygon: L-образный полигон', () => {
  const L = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]];
  assert.ok(pointInPolygon([1, 5], L));
  assert.ok(pointInPolygon([5, 1], L));
  assert.ok(!pointInPolygon([5, 5], L));
});

test('markerIdForBinding', () => {
  let n = 0; const nid = () => 'v_new' + n++;
  assert.equal(markerIdForBinding('device:abc', undefined, nid), 'abc');
  assert.equal(markerIdForBinding('entity:light.x', undefined, nid), 'lg_light.x');
  assert.equal(markerIdForBinding('virtual', 'v_existing', nid), 'v_existing');
  assert.equal(markerIdForBinding('virtual', undefined, nid), 'v_new0');
  assert.equal(markerIdForBinding('virtual', 'abc', nid), 'v_new1');
});

test('averageLqi', () => {
  assert.equal(averageLqi([]), null);
  assert.equal(averageLqi([100]), 100);
  assert.equal(averageLqi([100, 200]), 150);
  assert.equal(averageLqi([1, 2, 2]), 2);
});

test('iconFor: ключевые правила', () => {
  assert.equal(iconFor('Датчик протечки кухня', 'HOBEIAN'), 'mdi:water-alert');
  assert.equal(iconFor('Замок Терраса', 'TTLock'), 'mdi:lock');
  assert.equal(iconFor('Настенная лампа 1', 'Yandex Bulb'), 'mdi:lightbulb');
  assert.equal(iconFor('Ворота', 'Tuya Garage'), 'mdi:garage-variant');
  assert.equal(iconFor('Термоголовка', 'Aqara'), 'mdi:radiator');
  assert.equal(iconFor('Неизвестное', 'XYZ'), 'mdi:chip');
});

test('fitView: портретный план в широкой сцене — по бокам поля, весь план внутри', () => {
  // vb 100x200 (аспект 0.5), сцена аспект 2 → view шире плана, высота = 200
  const v = fitView([0, 0, 100, 200], 2);
  assert.equal(v.h, 200);
  assert.equal(v.w, 400); // 200*2
  assert.equal(v.x, -150); // (100-400)/2 центрирование
  assert.equal(v.y, 0);
  // весь план внутри view
  assert.ok(v.x <= 0 && v.x + v.w >= 100 && v.y <= 0 && v.y + v.h >= 200);
});

test('fitView: аспект сцены совпадает с планом — view == vb', () => {
  const v = fitView([10, 20, 300, 150], 2); // планA = 2 == аспект
  assert.equal(v.x, 10); assert.equal(v.y, 20); assert.equal(v.w, 300); assert.equal(v.h, 150);
});

test('declump: близкие точки расходятся не ближе minDist и остаются в границах', () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  const pts = [ { x: 50, y: 50 }, { x: 51, y: 50 }, { x: 50, y: 51 } ];
  declump(pts, b, 20, 5);
  // все пары не ближе ~minDist (с допуском на кламп к границам)
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      assert.ok(d > 12, `пара ${i},${j} слишком близко: ${d}`);
    }
  // в границах [5..95]
  for (const q of pts) {
    assert.ok(q.x >= 5 && q.x <= 95 && q.y >= 5 && q.y <= 95);
  }
});

test('declump: одна точка не двигается', () => {
  const pts = [{ x: 30, y: 40 }];
  declump(pts, { x: 0, y: 0, w: 100, h: 100 }, 20, 5);
  assert.deepEqual(pts, [{ x: 30, y: 40 }]);
});

test('averageLqi: пусто → null, иначе округлённое среднее', () => {
  assert.equal(averageLqi([]), null);
  assert.equal(averageLqi([100, 200]), 150);
  assert.equal(averageLqi([1, 2, 2]), 2);
});
