// Классы изменений, PROCESS.md §1 — одна таблица на все гейты (#701).
//
// Вынесена из process-gate.mjs: её читает и `validate-commit-provenance.mjs`
// (хук commit-msg), которому process-gate сам импортирует — общий модуль
// снимает круговую зависимость.
// Порядок важен: D проверяется первым, иначе собранный бандл попадёт в A,
// а demo/golden/baselines — в B.
const CLASS_D = [
  /^dist\//,
  /^custom_components\/houseplan\/frontend\//,
  /^demo\/srv\/assets\/houseplan-card\.js$/,
  /^demo\/golden\/baselines\//,
];
const CLASS_A = [
  /^src\//,
  /^custom_components\/houseplan\/.*\.py$/,
  /^hacs\.json$/,
  /^custom_components\/.*\/manifest\.json$/,
  /^custom_components\/.*\/translations\//,
];
const CLASS_B = [
  /^test\//, /^tests_backend\//, /^demo\//, /^scripts\//,
  /^\.github\//, /^\.githooks\//, /^rollup\.config\.mjs$/, /^tsconfig.*\.json$/,
  /^package(-lock)?\.json$/, /^pytest\.ini$/, /^\.gitignore$/, /^\.gitattributes$/,
  // Пины toolchain — производные от validate.yml (#496), конфиг сборки.
  /^\.nvmrc$/, /^\.python-version$/,
];
const CLASS_C = [
  /^docs\//, /^README/, /^CHANGELOG/, /^AGENTS\.md$/, /^LICENSE$/,
  /^CONTRIBUTING\.md$/, /^PROCESS.*\.md$/, /^(CODE|SPEC)-REVIEW-.*\.md$/,
  // #682: архив выпущенного — документы ревью и ТЗ прошлых линий. Только
  // Markdown; исполняемого там нет (#678 вынес всё прочее из дерева).
  /^legacy\//,
];


export function classify(path) {
  if (CLASS_D.some((r) => r.test(path))) return 'D';
  if (CLASS_A.some((r) => r.test(path))) return 'A';
  if (CLASS_B.some((r) => r.test(path))) return 'B';
  if (CLASS_C.some((r) => r.test(path))) return 'C';
  return '?';
}
