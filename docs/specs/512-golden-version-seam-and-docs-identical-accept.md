# #512 — Текст версии через seam вне golden-кадров; `docs:accept --identical` по попиксельной идентичности

- **Issue:** https://github.com/Matysh/houseplan-card/issues/512
- **Тип / приоритет:** infra, tech-debt / P2
- **Трек:** полный — две поверхности (продуктовый seam версии + golden-харнес; инструмент приёмки docs-скриншотов), критерий §5 «одна поверхность» не проходит
- **Оценка:** ценность для разработки 7/10; сложность 3/10; риск 2/10
- **Связано:** #246 (приёмка docs из артефакта), #401/#455 (среда съёмки, свидетели golden), #462 (version recovery), #479 (fingerprint gate), #506 (ручная fingerprint-only приёмка 11 кадров), ретроспектива 09.09 п. 4

## 1. Проблема

Golden-эталоны содержат текст версии карточки: «about» в общих настройках (`gs.about_version`), баннер version-mismatch (`renderVersionBanner`: frontend/backend), превью support-пакета (`card_version`/`integration_version` из ответа стенда) и превью экспорта. Каждая бета меняет `CARD_VERSION`, и beta.8 потребовала приёмки 20 эталонов из CI-артефакта, beta.7 — ещё круг, хотя кадры визуально не менялись. Docs-скриншоты: `sourceFingerprint` меняется от любого коммита в `src/**`; при отсутствии UX-изменений кадры попиксельно те же, но принять их можно только из CI-артефакта (dispatch → 10 минут → скачать → `docs:accept`), либо руками, как для #506 (PIL-сравнение, ручная правка манифеста).

## 1.1. Сценарий

Релиз-менеджер готовит бету: bump версии → golden без единого отличия; docs-скриншоты — `npm run docs:accept -- --identical` за минуту локально, без CI-цикла; отказ инструмента с перечнем кадров — единственный сигнал идти по штатному пути через артефакт.

## 1.2. Что человек увидит до и после

Пользователь — ничего: версия в продукте показывается как раньше. Разработчик: bump версии не трогает golden; идентичные docs-кадры принимаются локально.

## 2. Скоуп

1. `src/card-version.ts`: `displayVersion()` = `globalThis.__HP_VERSION_OVERRIDE__` (строка, если задана) иначе `CARD_VERSION`; все места, где версия попадает в DOM или в запросы стенда, читают seam (§4).
2. Golden-харнес ставит override `0.0.0-golden` до монтирования и подставляет ту же константу вместо `package.json`-версии там, где сам эмулирует бэкенд (§5).
3. `docs:accept --identical` (§6).
4. Одноразовая переприёмка golden-эталонов с версией из CI-артефакта (§7).

## 3. Не-скоуп

- Изменение формата `screenshots.json`, `baselines-index.json`, политики приёмки golden (#401) — нет.
- Сравнение с допуском (anti-aliasing и т. п.) — нет: только 0 отличий; всё остальное — штатный путь.
- Смена версии в `hp_retry` cache-busting и в `console.info` при загрузке — остаётся `CARD_VERSION` (не кадры).

## 4. Seam версии

```ts
// src/card-version.ts
export const CARD_VERSION = '…';  // НЕ здесь: константы остаются в houseplan-card.ts и houseplan-editor-runtime.ts (контракт релиза)
export function displayVersion(fallback: string): string {
  const override = (globalThis as { __HP_VERSION_OVERRIDE__?: unknown }).__HP_VERSION_OVERRIDE__;
  return typeof override === 'string' && override ? override : fallback;
}
```

Вызовы `displayVersion(CARD_VERSION)` вместо `CARD_VERSION`: `houseplan-card.ts` — PDF-рендер (`version:`), `frontendVersion` для version recovery (баннер показывает frontend); `houseplan-editor-runtime.ts` — `gs.about_version`, `card_version` в `support/preview`, `card_version` в `export/create`, `cardVersion` в preflight-документе, `_preflightVersionsDiffer`. `release-contract.mjs` по-прежнему читает `CARD_VERSION = '…'` из обоих файлов — константы не переносятся.

Продуктовое поведение: override не задан → все значения равны `CARD_VERSION` (тест). Seam — тестовый; в `AGENTS.md`/`docs/TESTING.md` одна фраза: «`__HP_VERSION_OVERRIDE__` только для харнесов».

## 5. Golden-харнес

`demo/golden/harness.mjs`: константа `GOLDEN_VERSION = '0.0.0-golden'`; в `page.evaluate` перед `document.createElement('houseplan-card')` — `window.__HP_VERSION_OVERRIDE__ = GOLDEN_VERSION`; `card._haIntegrationVersion = cardVersion` (support-сценарии) → `GOLDEN_VERSION`; `cardVersion` из `package.json` больше не читается (кроме проверок, где нужна реальная версия — таких нет). Сценарии version-mismatch сохраняют `integrationVersion: '0.0.0-golden-backend'` — отношение frontend ≠ backend остаётся.

Отпечаток бандла в `baselines-index.json` уже нормализует строку версии (#481) — не меняется.

## 6. `docs:accept --identical`

`scripts/docs-accept.mjs`, новый режим (взаимоисключающий с `--from`): 

1. `assertCaptureEnvironment` не требуется: кадры не заменяются. `demo/docs/capture.mjs` **не меняется** (ревью ТЗ r1, H1: этот файл — сторож `captureScriptSha256` в `docs/images/screenshots.json`, и его правка сама по себе красит `check-docs`): инструмент копирует закоммиченные кадры и манифест во временную папку, запускает штатные `npm run -s build` и `node demo/docs/capture.mjs` (те пишут в `docs/images`, как всегда), сравнивает кандидата с копией и в любом исходе возвращает байты кадров на место; манифест переписывается только при успехе (п. 3), при отказе или ошибке восстанавливается из копии.
2. Сравнение: каждый кадр кандидата и закоммиченный декодируются в Chromium (Playwright, `page.evaluate` с `createImageBitmap` + `OffscreenCanvas.getImageData`), сравниваются размер и все байты RGBA; результат — число отличающихся пикселей на кадр. Реализация в `scripts/png-identical.mjs` (`compareDecodedPixels` — чистая функция над RGBA; `compareInPage` — декодирование и сравнение одной пары внутри страницы Playwright, чтобы не сериализовать мегабайтные RGBA-массивы через evaluate; `compareFramePairs`), чтобы unit-тест с синтетическими буферами не поднимал браузер для компаратора.
3. Все кадры идентичны → манифест: `sourceFingerprint`, `scenarios[*].sourceSha256` **и `captureScriptSha256`** берутся из кандидата (ревью ТЗ r1, H1: правка `capture.mjs` без визуальных изменений принимается этим же локальным прогоном, а не ждёт артефакта), остальное (`imageSha256`, `chromium`, `oxipng`, `acceptance`) — из закоммиченного, `acceptance.lastWriteWasFingerprintOnly: true` и `acceptance.identicalPixels: true`; байты PNG не трогаются; `check-docs --screenshots=strict` зелёный. Переприёмка docs-скриншотов в этом issue: первый локальный `--identical`-прогон в этой же ветке (11 кадров, seam не меняет docs-сцены) — его результат коммитится вместе с кодом.
4. Хотя бы одно отличие → код 1 и перечень «кадр: N пикселей» — дальше штатный путь через CI-артефакт и `--reviewed`.

## 7. Переприёмка golden

После слияния seam первый heavy-прогон (кандидат беты или dispatch `full=true`) покажет отличия только в кадрах с версией. Приёмка — штатно: артефакт → `npm run golden:accept -- --reviewed`, коммит с `Baseline-Reviewed: <run>`; в описании — «текст версии → `0.0.0-golden`, N кадров, остальные свидетели байт-в-байт».

## 8. Тесты и мутанты

- `test/card-version.test.mjs`: override не задан → fallback; задан строкой → override; пустая строка/не строка → fallback.
- `test/houseplan-card-version-seam.test.mjs` (source-text): в обоих файлах нет прямых `CARD_VERSION` в перечисленных местах рендера/запросов, кроме объявления, `hp_retry` и `console.info`.
- `test/png-identical.test.mjs`: два одинаковых буфера → 0; одно отличие → 1; разный размер → отказ.
- `test/docs-accept.test.mjs`: `--identical` с идентичными кадрами обновляет только fingerprint и `captureScriptSha256` (байты, `imageSha256`, `chromium` — прежние); с отличием — код 1, манифест и кадры нетронуты (через инъекцию съёмки и компаратора).
- Мутанты: `version-seam-ignores-override` (гард — `card-version.test`), `docs-identical-accepts-any-frame` (компаратор возвращает 0 всегда — гард `png-identical.test`).

## 9. Совместимость и откат

Продукт не меняется; откат — revert, golden-эталоны вернутся к предыдущему коммиту вместе с ним.

## 10. Критерии приёмки

- AC1. При заданном override golden-кадры с версией не зависят от `CARD_VERSION`: после bump версии в следующем кандидате golden даёт 0 отличий (доказательство — первый релиз-кандидат после слияния; до него — тест seam + переприёмка §7).
- AC2. Без override `displayVersion(CARD_VERSION) === CARD_VERSION` во всех точках (тест seam); `release-contract` читает константы обоих файлов без изменений.
- AC3. `docs:accept --identical`: идентичные кадры → только fingerprint и `captureScriptSha256` в манифесте, `check-docs --screenshots=strict` зелёный; ≥1 отличающийся пиксель → код 1, манифест нетронут (unit + прогон на реальных кадрах текущего дерева).
- AC4. Golden-эталоны с версией переприняты один раз с `Baseline-Reviewed:`; `docs/TESTING.md`, `demo/golden/README.md`, `docs/DEVELOPMENT.md` описывают seam и `--identical`.
- AC5. Оба мутанта §8 пойманы штатным раннером.
- AC6. UX/i18n/модель данных/перф не затронуты (`User-Visible: no`); i18n-ключ `gs.about_version` и его текст не меняются.

## 10.1. Риски и меры

- Playwright в `docs:accept --identical` — уже зависимость проекта; без Chromium режим падает с понятным сообщением, штатный путь остаётся.
- oxipng в CI может менять цветовую модель PNG (палитра, glубина) — сравнение идёт по декодированным RGBA, а не по байтам, поэтому это не влияет.
- Кто-то задаст override в проде — только через глобальную переменную страницы; документация называет её тестовой.

## 11. Затронутые файлы

`src/card-version.ts` (новый), `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, `demo/golden/harness.mjs`, `scripts/docs-accept.mjs`, `docs/images/screenshots.json` (fingerprint-only, через `--identical`), `scripts/png-identical.mjs` (новый), тесты, `demo/golden/baselines/**` (переприёмка), `docs/TESTING.md`, `docs/DEVELOPMENT.md`, `demo/golden/README.md`, `docs/specs/README.md`.

## 12. Принятые предположения

- Значение `0.0.0-golden` — синтаксически версия (semver-подобная), чтобы валидаторы экспорта/импорта харнеса её принимали.
- Компаратор строгий (0 отличий): любое отличие — к людям через артефакт; допуски не вводятся.
