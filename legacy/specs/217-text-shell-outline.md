# Issue #217 — внешняя рамка Text-маркера должна быть капсулой

- **Issue:** https://github.com/Matysh/houseplan-card/issues/217
- **Связанные завершённые задачи:** #179, #211, #213
- **Нормативный дизайн:** `demo/srv/reference/device-icons/Light/Text Default.svg`
  и `demo/srv/reference/device-icons/Dark/Text Default.svg` из пакета #179
- **Тип:** bug / polish, обычный трек
- **Приоритет:** P1
- **Пользовательское изменение:** да

## 1. Сценарий и персона

**Персона:** домочадец или гость, который читает текстовое состояние устройства
в View/kiosk, и администратор, который проверяет тот же маркер в редакторе.

**Сценарий:** пользователь видит Text-маркер с широким значением, например
`498 ppm`, и ожидает, что внешний shell повторяет капсульную форму внутреннего
белого core. После #213 core остаётся капсулой, но внешняя рамка стала эллипсом:
вместо прямого среднего участка верхняя и нижняя границы изгибаются по всей
ширине.

## 2. Что человек увидит до и после

До исправления широкий Text-маркер окружён овальной рамкой, которая визуально
не совпадает ни с core, ни с дизайн-пакетом #179. После исправления внешняя
рамка имеет форму stadium: торцы являются полуокружностями, а между ними идут
прямые горизонтальные участки. Размер, положение и интерактивная область
маркера не меняются.

## 3. Подтверждённая причина

`src/styles.ts` задаёт правильный общий fallback
`border-radius: 9999px` для `.device-shell-frame`, но затем правило
`.device-shell:not(.with-values) .device-shell-frame` заменяет его на `50%`.
Text-маркер имеет класс `.text-shell`, но не `.with-values`, поэтому для широкой
рамки `50%` вычисляется отдельно по ширине и высоте и даёт эллипс.

Регрессия появилась в реализации #213. Проверки её не поймали, потому что:

1. smoke `textCoreIsStadium` проверяет только внутренний core;
2. capsule smoke проверяет hover/action, а не форму внешней рамки;
3. существующий golden показывает Text-маркер слишком мелко, поэтому неверная
   кривизна не была заметна при визуальном review.

## 4. Нормативные источники и приоритет

При расхождении применяются:

1. решения владельца в #217;
2. это ТЗ после зелёного SPEC-REVIEW;
3. Light/Dark `Text Default.svg` из принятого пакета #179;
4. контракты #213 для размеров, inset, соосности и полной hover/action-области;
5. текущая реализация как compatibility baseline для поведения, которое это ТЗ
   явно не меняет.

Reference SVG задаёт stadium как для core, так и для внешней рамки Text.

## 5. Цели

1. Вернуть внешней рамке Text-маркера форму stadium во всех поверхностях.
2. Не изменить размеры, inset, anchor, цвета и поведение маркера.
3. Добавить автоматическую проверку именно внешней рамки, падающую при `50%`.
4. Сделать дефект заметным в Light/Dark golden review.

## 6. Scope

В задачу входят:

- общий Text device face в full View, kiosk, Device editor/preview и
  `houseplan-space-card`;
- Light/Dark и цветной фон плана;
- короткие и длинные Text-значения на поддерживаемой матрице размеров;
- CSS-правило формы внешнего `.device-shell-frame`;
- source/unit contract, targeted browser smoke и крупный golden-сценарий;
- оба changelog и testing-документация.

## 7. Не входит в задачу

- изменение ширины, высоты, inset, stroke, shadow, цвета или opacity;
- изменение сохранённой координаты, `icon_size`, marker `size` или badge side;
- изменение core, MDI-глифа, LQI, pulse, availability или virtual-state;
- изменение Icon-only, Double/value/legacy capsule и opening Lock/Unlock;
- изменение hover/action target, tooltip, z-index, keyboard или touch поведения;
- новые настройки, строки, schema или миграция данных;
- откат остальных изменений #213;
- принятие golden baseline на Windows или выпуск без команды владельца.

## 8. Визуальный контракт

### 8.1. Text

Для `.device-shell.text-shell .device-shell-frame`:

- внешний shell имеет stadium-форму при любой ширине больше высоты;
- радиус каждого внешнего угла визуально равен половине итоговой высоты рамки с
  допуском browser layout/raster quantum;
- верхняя и нижняя границы между торцами имеют прямой горизонтальный участок;
- рамка окружает core с существующим `--device-shell-inset`;
- core и shell сохраняют текущие размеры, центр и относительное положение;
- CSS `border-radius: 50%` не применяется к широкой Text-рамке.

Нормативный CSS-подход может использовать saturating radius (`9999px`) либо
эквивалентное height-derived значение. Запрещены фиксированные pixel-компенсации
по размеру, viewport или DPR.

### 8.2. Неизменяемые варианты

- Icon-only shell остаётся окружностью;
- внутренний Text core остаётся stadium;
- Double/value/legacy shell сохраняет существующую capsule geometry;
- opening Lock/Unlock остаётся круглым;
- внешний footprint и hit area всех вариантов не меняются.

### 8.3. Матрица

Контракт проверяется минимум на:

- длинном значении (`498 ppm` либо более длинной локализованной строке);
- effective base 24, 32, 56, 96 и 112 CSS px;
- DPR 1, 1.25, 1.5 и 2;
- Light и Dark;
- full, preview и static/space-card parity surfaces.

## 9. UX, accessibility и touch

Вся внешняя Text-капсула по-прежнему является одной hover- и action-областью,
как принято в #213. Минимальная интерактивная область остаётся не меньше 44×44
CSS px. Focus-visible, tooltip, accessible name, tab order, confirmation и
действие не меняются. Touch/pen не получают новый hover; unavailable сохраняет
текущее поведение.

## 10. Данные, migration и i18n

Config, layout, localStorage, backend schema и сериализация не меняются.
Миграция не нужна; Open → Save не материализует новые поля. Новых
пользовательских строк и i18n-ключей нет.

## 11. Архитектура и зоны изменений

Исправление должно оставаться в общем device face и применяться ко всем
поверхностям без второго renderer:

```text
device presentation
  → shared renderDeviceFace classes
  → common device styles
  → Text-only stadium shell / Icon-only circle
```

Ожидаемые зоны изменений:

- `src/styles.ts` — сузить circular override так, чтобы он не захватывал Text;
- `test/device-marker-polish-contract.test.mjs` — source regression contract;
- `demo/smoke_device_icon_design.mjs` — computed-style/geometry matrix внешней
  Text-рамки и неизменённой круглой Icon-рамки;
- golden/reference matrix — крупный Text marker в Light/Dark;
- `docs/TESTING.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 12. Performance и security

Исправление является CSS-only geometry change. Нельзя добавлять per-frame JS,
ResizeObserver, media listener, отдельный DOM-слой, backdrop-filter или новую
анимацию. Число paint/compositor layers не увеличивается. Action и security
paths не меняются.

## 13. Acceptance criteria

1. **AC1 — stadium shell.** Длинный Text-маркер имеет внешнюю stadium-рамку с
   прямым средним участком в Light/Dark. **Доказательство:** browser smoke и
   reviewed крупный golden.
2. **AC2 — защита от `50%`.** Regression test проверяет внешнюю рамку и краснеет
   на documented mutant, возвращающем `border-radius: 50%` для Text.
   **Доказательство:** source/computed-style smoke + mutant result.
3. **AC3 — матрица размеров.** Контракт Text shell выполняется на §8.3 без
   per-size/DPR исключений. **Доказательство:** browser matrix.
4. **AC4 — геометрическая совместимость.** До/после совпадают outer rect, inset,
   core rect и anchor с допуском одного browser layout quantum; меняется только
   corner shape. **Доказательство:** browser rect assertions.
5. **AC5 — соседние варианты.** Icon-only остаётся кругом, внутренний Text core
   и Double/value/legacy capsule не меняются. **Доказательство:** targeted smoke
   и existing device-face tests.
6. **AC6 — interaction parity.** Hover и действие по всей Text-капсуле,
   44×44 minimum target, mouse/touch modality и unavailable остаются как в
   #213. **Доказательство:** existing capsule hover/action smoke.
7. **AC7 — surface/theme parity.** Full View/kiosk, preview и static/space-card
   показывают одинаковую форму в Light/Dark. **Доказательство:** parity smoke и
   golden.
8. **AC8 — data/i18n/security/performance.** Нет schema, storage, i18n, action,
   observer, animation или compositor changes. **Доказательство:** unit/source
   review и fast performance sanity.
9. **AC9 — release artifacts.** Оба changelog, testing docs, smoke/golden
   fixtures и visual fingerprints актуальны. **Доказательство:** docs diff,
   `check-docs` и release review.

## 14. План автотестов

### 14.1. Цикл реализации

```bash
npm run typecheck
npm test
npm run build
node scripts/check-docs.mjs --external
```

Source/unit guard должен явно различать Text и Icon-only selector contract.
Browser smoke получает внешнюю рамку через `.device-shell-frame`, проверяет
Text saturating radius и круглую Icon-рамку, сравнивает rect/inset до и после
смены размеров и фиксирует documented mutant `50%` как failing case.

### 14.2. Targeted smoke перед S7

- `node demo/smoke_device_icon_design.mjs`;
- `node demo/smoke_device_preview_parity.mjs`;
- `node demo/smoke_static_icon.mjs`;
- capsule hover/action smoke из #213;
- Light/Dark reference/golden capture с крупным длинным Text-маркером.

Golden на Windows используется только диагностически. Канонический baseline
принимается из reviewed Linux CI artifact перед beta.

## 15. Риски и меры

| Риск | Мера |
| --- | --- |
| Слишком широкое правило перестанет округлять Icon-only | Явная Icon-vs-Text source/browser проверка |
| Исправление изменит footprint или anchor | До/после rect/inset assertions |
| Double/value capsule получит новый радиус | Отдельный unchanged regression check |
| Дефект снова потеряется на мелком golden | Выделенный крупный long-Text сценарий в Light/Dark |
| Появится surface-specific CSS | Проверка shared face parity без второго renderer |

## 16. Откат

Откат одного implementation commit возвращает прежний selector и visual
fixtures. Данных и миграций нет. Golden baseline возвращается только через
нормативный Linux artifact, а не ручным принятием локального Windows capture.

## 17. Release-артефакты

В user-visible implementation commit одновременно обновляются:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #217;
- `docs/TESTING.md` с новым Text-shell regression contract;
- browser smoke и крупный Light/Dark golden/reference сценарий;
- screenshot/golden fingerprints, если их источник изменён.

Release note: внешняя рамка текстовых маркеров снова соответствует капсульной
форме дизайн-пакета вместо овала. Сначала beta; stable — только по отдельной
команде владельца.

## 18. Принятые предположения

1. Дизайн-пакет #179 однозначно задаёт stadium для внешней рамки Text, поэтому
   дополнительного продуктового вопроса не требуется.
2. Исправляется только форма внешней Text-рамки; её размеры, inset и цвета
   остаются текущими.
3. Icon-only остаётся кругом, Double/value/legacy и opening lock не меняются.
4. Новых настроек, строк и миграций нет.
5. Для визуального review используется отдельный крупный длинный Text marker,
   а не только существующий общий мелкий golden.
