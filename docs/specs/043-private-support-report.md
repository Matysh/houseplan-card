# ТЗ #43 — Помощь и обратная связь с обезличенным support package

- Issue: https://github.com/Matysh/houseplan-card/issues/43
- Приоритет: P2, feature
- Ревизия: 2 (2026-09-01), полная переработка после финального решения владельца
- Трек: полный — новый View UX, frontend + backend + внешний relay,
  privacy/security contract и обязательная touch-поддержка

## 1. Сценарий

Домашний администратор видит проблему на плане или хочет предложить улучшение.
Сейчас ему приходится отдельно искать чат/репозиторий, выяснять версии, вручную
экспортировать план и гадать, какие данные можно безопасно показывать. В результате
репорт часто нельзя воспроизвести либо пользователь пересылает лишние сведения о
доме и устройствах.

В обычной шапке House Plan администратор открывает «Помощь и обратная связь»,
читает версию и документацию, пишет сообщение и при желании осознанно прикладывает
подготовленный House Plan обезличенный диагностический пакет. До отправки он видит
состав, размер и точные байты вложения. После успешной отправки получает номер
репорта, по которому можно продолжить разговор в Telegram или GitHub.

Персона: **Home admin** из `docs/SCOPE.md`. Основная поверхность — View в desktop,
phone/tablet и HA Companion. Диалог, открытый поверх View, полностью поддерживается
на touch по `docs/TOUCH-SUPPORT.md`; редакторы остаются desktop-first, но тот же
диалог в них не деградирует.

## 2. Что человек увидит до и после

**До:** блок «О карточке» спрятан в конце общих настроек; отдельной ссылки на
USER-GUIDE нет; формы обратной связи и безопасного общего диагностического
вложения нет. HA diagnostics и обычный backup требуют ручных действий и содержат
данные, которые нельзя автоматически отправлять третьей стороне.

**После:** сразу после кнопки общих настроек находится круглая кнопка помощи. Она
открывает единый диалог с версией, GitHub, Telegram, языковой ссылкой на USER-GUIDE
и формой «Отправить репорт/предложение». Сообщение обязательно, контакт
необязателен. Чекбокс диагностического пакета по умолчанию выключен. При включении
пользователь предупреждён о точной геометрии дома, может проверить или скачать
ровно отправляемый JSON и только затем нажать «Отправить». Успех показывает номер
репорта; отказ ничего не стирает и предлагает повторить либо забрать пакет вручную.

## 3. Проблема и подтверждённое текущее состояние

### 3.1 UI

- Header-кнопка общих настроек живёт в `src/houseplan-card.ts` и рендерится при
  `_norm && _canEdit`; kiosk скрывает всю шапку.
- «О карточке» находится в `src/houseplan-editor-runtime.ts` внутри диалога общих
  настроек: версия, GitHub и Telegram.
- Editor runtime уже загружается лениво при открытии общих настроек. Новый диалог
  использует ту же lazy boundary: обычный холодный View не должен платить размером
  формы поддержки и её логики.

### 3.2 Диагностика и backup

- `houseplanDiagnostics()` отдаёт только узкую frontend-сводку registry/bindings.
- #295 добавила копируемую runtime-диагностику geometry preflight, но только для
  одного класса отказов.
- `custom_components/houseplan/diagnostics.py` предназначен для HA Download
  diagnostics. Его redaction не является allowlist: marker/settings payload и
  внутренние ids нельзя пересылать автоматически.
- `create_export()` строит согласованный переносимый backup до 8 MiB, однако
  обычный backup содержит имена, ссылки, ids, свободный текст и точную геометрию.
  Он служит источником структуры и snapshot-механики, но **не** готовым support
  attachment.

### 3.3 Transport

В репозитории нет feedback endpoint. Публичный GitHub issue раскрывает вложение;
Telegram share и `mailto:` не умеют без ручного шага приложить большой JSON;
секрет почты/GitHub нельзя вшивать ни в card bundle, ни в Python integration.
Поэтому direct submit требует отдельного доверенного relay с секретами только на
его стороне.

## 4. Решения владельца

1. В шапке после общих настроек появляется отдельная кнопка с иконкой вопроса в
   кружке.
2. «О карточке» целиком переезжает из общих настроек в новый диалог.
3. В диалоге есть ссылка на `docs/USER-GUIDE.ru.md` только для русского языка;
   любой другой язык ведёт на английский `docs/USER-GUIDE.md`.
4. Форма содержит необязательный контакт, обязательное сообщение и opt-in
   диагностическое вложение.
5. Q1–Q4 приняты по defaults из issue: project-controlled HTTPS relay, точная
   геометрия в support snapshot, preview точных байтов, доступ только `can_write`,
   отсутствие кнопки в kiosk.
6. Подпись контактного поля на русском фиксирована владельцем:
   **«Контакт для связи (email/tg/WhatsApp), необязательно.»**

## 5. Скоуп

### 5.1 Входит

- Help/Feedback-кнопка в текущей шапке и отдельный `hp-dialog`;
- перенос существующего блока «О карточке» без потери ссылок;
- языковая ссылка на USER-GUIDE;
- форма и её состояния validation/building/sending/success/error;
- backend allowlist-проекция и псевдонимизация текущего согласованного snapshot;
- preview-token, гарантирующий «просмотренные байты = отправленные байты»;
- backend submit в фиксированный project-controlled relay;
- минимальный deployable relay, который валидирует payload, ограничивает abuse и
  доставляет обращение мейнтейнеру в закрытый канал и хранит его на узле
  проекта;
- privacy notice, rate limit, retention и документированный ручной recovery;
- RU/EN/DE/FR i18n, unit/backend/receiver/smoke/golden/touch/security tests;
- обновление пользовательской и архитектурной документации.

### 5.2 Не входит

- автоматическая telemetry, фоновые или периодические отчёты;
- создание публичного GitHub issue либо отправка в публичный Telegram-чат;
- двусторонний встроенный support-chat, история обращений и статус тикета;
- произвольные пользовательские вложения;
- исходные plan/backdrop images, PDF, manuals и другие бинарные файлы;
- сохранённый optimizer/import undo-backup и история версий плана;
- настройка пользователем собственного endpoint;
- доступ household/guest-пользователей без `can_write`;
- kiosk-кнопка;
- изменение остальных backup/export/HA diagnostics flows;
- сбор HA state values, журналов, stack traces или exception messages.

## 6. UX-контракт

### 6.1 Кнопка

- Иконка: `mdi:help-circle-outline` в существующей круглой `.btn`-оболочке.
- Порядок справа: zoom controls → General Settings → Help/Feedback.
- Условие видимости **то же, что у General Settings**: `_norm && _canEdit`;
  kiosk не рендерит интерактивную поверхность.
- Кнопка видна в View, Plan, Devices и Backdrop editor. Открытие диалога не меняет
  mode, zoom, selection, черновик или unsaved form другого редактора.
- Доступное имя: локализованное «Помощь и обратная связь».

### 6.2 Диалог

Заголовок: «Помощь и обратная связь», icon `mdi:help-circle-outline`, wide
`hp-dialog`, `dismiss-on-scrim`. Порядок блоков:

1. **О карточке** — текущая версия card, GitHub и Telegram, без изменения URL.
2. **Документация** — ссылка «Руководство пользователя»:
   - effective language `ru` →
     `https://github.com/Matysh/houseplan-card/blob/main/docs/USER-GUIDE.ru.md`;
   - `en`, `de`, `fr`, неизвестный/пустой язык → английский `USER-GUIDE.md`.
   Ссылка открывается в новой вкладке с `rel="noopener noreferrer"`.
3. **Отправить репорт/предложение** — форма ниже.

Из General Settings удаляются только label/version/GitHub/Telegram строки. Все
настройки, backup и plan maintenance остаются на месте; высвободившийся блок не
заменяется дублирующей ссылкой.

### 6.3 Поля формы

1. Однострочный `<input>`:
   «Контакт для связи (email/tg/WhatsApp), необязательно.»
   - optional;
   - trim по краям;
   - максимум 320 Unicode code points;
   - формат не валидируется как email/phone: допустим username или пояснение;
   - автозаполнение отключено (`autocomplete="off"`), значение не сохраняется.
2. Многострочный `<textarea>` «Сообщение»:
   - required после trim;
   - 1…10 000 Unicode code points;
   - line breaks сохраняются;
   - HTML/Markdown не интерпретируются ни в карточке, ни в relay-mail.
3. Чекбокс «Прикрепить обезличенную информацию из вашего плана»:
   - default `false` на каждое новое открытие;
   - не сохраняется в config/localStorage;
   - рядом всегда краткий allowlist/exclusion текст;
   - при `true` отдельное предупреждение: пакет не содержит имён и HA ids, но
     содержит **точную геометрию и размеры дома**.

Footer: Cancel/Close и primary «Отправить». Отправка недоступна при пустом
сообщении, во время package build/submit или при невалидном/просроченном preview.
Enter в однострочном поле не отправляет форму; `Ctrl+Enter`/`Cmd+Enter` в message
может отправить только при выполненных тех же validation guards.

### 6.4 Preview диагностического вложения

При включении чекбокса frontend вызывает backend preview и показывает:

- состояние «Подготавливаем обезличенные данные…»;
- после успеха: тип/версию пакета, число пространств, размер в KiB, SHA-256;
- `<details>` «Показать данные» с лениво созданным read-only `<textarea>` и exact
  UTF-8 JSON text; многомегабайтный JSON не раскладывается в тысячи DOM nodes;
- кнопку «Скачать JSON», создающую файл из тех же bytes;
- кнопку «Обновить снимок».

Preview описывает **последнее принятое backend состояние**. Открытие Help не
завершает editor gesture, не сохраняет незакрытый dialog/draft и не форсирует
debounced write; backend `write_lock` даёт целую пару config/layout до либо после
конкурирующей записи, но никогда смесь двух ревизий.

Raw preview не содержит contact/message: это поля обращения, а не диагностический
пакет. Снятие чекбокса немедленно скрывает raw preview и удаляет token на backend.
Повторное включение строит новый snapshot, а не оживляет скрытый старый.

Если config/layout изменились после preview, пакет остаётся честным snapshot на
момент preview. UI показывает «Снимок подготовлен N минут назад»; автоматической
подмены байтов нет. После 10 минут token истекает, primary action блокируется и
предлагает обновить snapshot.

### 6.5 Submit и результат

- Checkbox off: отправляются только `message`, optional `contact`, card/integration
  versions и safe locale; никаких plan/config/layout данных.
- Checkbox on: к тому же обращению relay получает exact preview bytes и SHA-256.
- Один клик создаёт один idempotency key. Повтор после timeout с тем же draft не
  создаёт второй тикет, если первый дошёл.
- Успех закрывает busy state, не закрывает диалог автоматически и показывает:
  «Репорт отправлен: {id}. Сохраните номер для связи с поддержкой» плюс Copy ID.
- Только после явного Close успешная форма очищается. При ошибке contact/message,
  checkbox и валидный preview сохраняются.
- Ошибка не обещает доставку. Показывается stable localized reason и Retry. При
  relay/network/timeout также доступны Copy message и, если есть package,
  Download JSON + ссылки Telegram/GitHub для ручного продолжения.
- Отказ package build **не** отправляет сообщение молча без вложения. Пользователь
  либо повторяет, либо явно снимает checkbox.

## 7. Support package v1

### 7.1 Envelope

Canonical UTF-8 JSON, stable key order, trailing newline:

```json
{
  "format": "houseplan-support-package",
  "version": 1,
  "versions": {
    "card": "1.70.0",
    "integration": "1.70.0",
    "home_assistant": "2026.8.0",
    "model": 9,
    "export_schema": 1
  },
  "runtime": {
    "browser_family": "chromium",
    "browser_major": 140,
    "language": "ru",
    "coarse_pointer": false,
    "hover_capable": true,
    "registry_access": "full"
  },
  "revisions": { "config": 17, "layout": 24 },
  "summary": {},
  "validation": {},
  "repairs": [],
  "plan_backup": { "config": {}, "layout": {} }
}
```

No exact creation timestamp lives inside the attachment; receiver time belongs to
the transport receipt. `card` and runtime flags come from a strict frontend input
schema. Arbitrary client strings are rejected or mapped to `unknown`, never copied.

### 7.2 Safe runtime and summary

Allowlist:

- semantic card/integration/HA/model/export versions;
- browser family enum `chromium|firefox|webkit|unknown` and bounded major number,
  never full User-Agent;
- effective supported language enum, pointer/hover booleans;
- registry authority enum and coarse age bucket, never registry records;
- config/layout revision integers;
- counts by stable structural kind: spaces, rooms, drafts, walls, partitions,
  columns, openings by type, decor by kind, markers by lifecycle/binding kind;
- validation/preflight stable codes and counts;
- active House Plan Repair **family** + count. Current `broken_plan_<spaceId>`
  becomes `{ "code": "broken_plan", "count": N }`; raw issue id and placeholders
  do not leave HA.

No exception message, stack, raw validation path or display name is permitted.

### 7.3 Exact plan snapshot and pseudonyms

Backend reads config and layout under the same `write_lock`, deep-copies once and
builds a new allowlist object. Redaction after serializing the original is forbidden.

Within one package all referential ids are mapped consistently to namespaced
sequential pseudonyms. The random namespace changes for every new preview, so a
pseudonym cannot correlate the same object between two reports:

- `space-k7m2-1`, `room-k7m2-1`, `wall-k7m2-1`, `opening-k7m2-1`,
  `partition-k7m2-1`, `column-k7m2-1`, `decor-k7m2-1`, `marker-k7m2-1`;
- mappings are generated from current document order and a cryptographically
  random per-package namespace; the raw mapping is never returned/stored;
- every cross-reference (`space`, `room_id`, host ids, wall ids, marker controls,
  layout keys) is either remapped or omitted fail-closed;
- unknown object keys are dropped at every depth.

Included plan data:

- exact numeric geometry/coordinates, wall thickness, openings and transforms;
- structural/display enums, booleans and bounded numeric settings needed to render;
- decor geometry/style; decor text is replaced with a neutral placeholder;
- marker geometry/layout and safe display configuration; bindings/controls are
  represented only by pseudonyms and stable domain/kind enums;
- space/room display names become localized-neutral `Space 1`/`Room 1` tokens;
- plan aspect and presence flags without file identity.

Excluded at source:

- all original ids and keys, HA area/floor/device/entity/config-entry ids;
- space/room/device/entity names and friendly names;
- marker description, link, PDFs, free-text templates, decor text and user notes;
- plan/background/file URLs, filenames, paths, MIME metadata and content manifests;
- uploaded image/PDF/manual bytes;
- entity states/attributes, live values, service data, vacuum trail/coordinates;
- HA installation id, IP/host, external/internal URLs, timezone and exact location;
- original `source_fingerprint`, raw checksums of user data and exact event times;
- undo/import optimizer snapshots and local browser storage.

Exact relative geometry is deliberately included by owner decision. Privacy text
must not call the whole attachment «anonymous» without qualification; it says
«обезличено, но содержит точную планировку».

### 7.4 Privacy invariant

Adversarial fixture заполняет **каждое** запрещённое поле уникальным sentinel,
включая unknown nested fields, Unicode, URL, path, HTML, email, entity id и
base64-looking text. В package bytes, preview, relay request metadata, logs and
error strings не встречается:

- sentinel verbatim;
- URL-encoded, JSON-escaped и base64 representation;
- raw ids from config/layout/Repair issue ids.

Тест не заменяет allowlist inspection: сериализатор строит typed projection и
имеет fail-closed tests на новые неизвестные поля схемы.

### 7.5 Limits

- attachment ≤ 8 MiB UTF-8, общий request ≤ 8.5 MiB;
- максимум три preview одновременно на пользователя и на integration instance;
- preview TTL 10 минут;
- message ≤ 10 000 code points, contact ≤ 320;
- package build не удерживает больше одной raw store copy и одной projection copy;
- превышение даёт `support_package_too_large`, ничего не отправляет.

## 8. Backend API

### 8.1 `houseplan/support/preview`

Input: strict frontend facts (`card_version`, browser enum/major, language,
pointer flags, registry enum/age bucket) and a random per-dialog `draft_id`.

Authorization: `_check_write()` / `may_write`; unauthorized fail-closed.

Output:

```json
{
  "token": "opaque-random",
  "expires_in": 600,
  "size": 123456,
  "sha256": "hex",
  "spaces": 3,
  "text": "{...}\n"
}
```

The in-memory record is bound to HA user id, integration entry and `draft_id`. It
stores only the already-sanitized bytes, hash, expiry and idempotency seed — never
raw config. Creating a replacement invalidates only the previous token of that
same draft; other card instances keep independent previews within the limit.

### 8.2 `houseplan/support/preview/discard`

Idempotently removes a token owned by the caller. Close dialog, checkbox off and
successful submit use this cleanup; disconnect/remount relies on TTL as the final
guard because one HA WebSocket connection may be shared by several card instances.

### 8.3 `houseplan/support/submit`

Input: `message`, optional `contact`, optional `preview_token`, `idempotency_key`.
The backend validates lengths again, resolves only a caller-owned non-expired token
and sends multipart to the compile-time allowlisted relay URL:

- part `request`: JSON with schema version, message, contact, safe versions,
  attachment size/hash and idempotency key;
- optional part `attachment`: exact cached bytes, filename
  `houseplan-support-{short-id}.json`, type `application/json`.

Requirements:

- HA shared aiohttp session; connect/total timeout 5/20 s;
- HTTPS only, fixed host, redirects disabled, no endpoint from user/config/message;
- no proxying of relay response text; map status to stable local codes;
- no body/contact/message/package in HA logs, traces or exception strings;
- token is consumed only on confirmed success; retry reuses exact bytes/key;
- response returns bounded `report_id`, never remote debug detail.

New stable errors are added to backend error registry and all locales:
`support_invalid_message`, `support_preview_expired`,
`support_package_too_large`, `support_rate_limited`, `support_unavailable`,
`support_rejected`.

Old backend without these commands leaves About/Guide usable and shows localized
«Обновите House Plan, чтобы отправлять репорты»; it does not offer a fake submit.

## 9. Project-controlled relay

### 9.1 Minimal architecture

The repository gains a separately deployable service under
`scripts/support-relay/**`, excluded from the HACS artifact. Keeping the complete
service (runtime, manifest, tests and deployment README) in this subtree makes
every relay-only commit class B under `AGENTS.md` / `PROCESS.md`; a product commit
that also changes `src/**` remains A+B and follows the stricter class-A flow. The
service exposes only `POST /v1/reports` and `GET /health`. Secrets exist only in
its deployment environment. The production sink is a **private maintainer channel
in Telegram** (owner's decision, 2026-09-01): the summary message carries the
generated report id, safe versions and the escaped plain-text message/contact, and
the support JSON is attached as a document. Markup mode is never enabled, so the
user's text is displayed literally and cannot forge the surrounding message. The
report is written to the relay spool **before** delivery is attempted, so a failed
delivery costs a promise, not the user's request. No public issue is created and no
e-mail provider participates.

**Two delivery channels, chosen by deployment.** `telegram` posts to the Bot API
directly. `ha_webhook` posts the summary to a private webhook of the maintainer's
own Home Assistant, which performs the last mile. The second channel exists
because the project node runs at a Russian hosting provider where every
`api.telegram.org` address is unreachable — direct delivery failed with «Network
is unreachable», not with a provider error. On this channel the package stays in
the relay spool and the summary names its path: the webhook carries text only,
so the address (which is its own access key) stays cheap to rotate, and the
geometry of a stranger's home does not travel through a messenger. Either
channel keeps the same contract: nothing is promised to the user until delivery
is confirmed.

Production URL is an immutable backend constant supplied after relay deployment.
No placeholder, localhost URL or configurable arbitrary endpoint may pass release
gates. A staging relay and exact production URL are dependencies of S5/implementation;
if they are unavailable, #43 receives `blocked` without weakening the contract.

### 9.2 Validation and abuse controls

- strict multipart schema; unknown parts/fields rejected;
- max request 8.5 MiB before buffering; JSON content/type/hash verified;
- attachment parsed and checked for format/version and top-level allowlist;
- message/contact rendered as escaped plain text only;
- 5 attempts/hour and 20/day per source address plus a global circuit breaker;
- **the source address is the one supplied by the trusted proxy, never one the
  client can choose.** The relay reads the *last* element of `X-Forwarded-For`,
  because the first element is whatever the caller sent, and the reverse proxy in
  front of it is configured to overwrite the header outright rather than append
  to it. Both halves are required: without them a caller picks its own rate-limit
  bucket by changing one line of the request, and every other limit in this
  section becomes decorative;
- source IP is used only through a daily-keyed rate-limit hash with ≤24 h TTL;
  raw address is not written to app logs/storage/mail;
- idempotency key retained 24 h and returns the original report id;
- uniform public errors; internal provider responses are never reflected;
- mail/provider secrets are redacted by platform logging configuration.

Because open-source clients cannot hold a relay secret, the endpoint is intentionally
public and abuse protection is rate/size/schema based. This limitation is documented
and reviewed as a security trade-off; a hard-coded shared key is explicitly forbidden.

### 9.3 Retention and disclosure

- Relay stores the accepted report (message, contact, safe metadata and the
  attachment) in a spool readable only by its own system user, and a daily timer
  deletes everything older than **30 days**; maintainers may delete earlier. On
  the `ha_webhook` channel the attachment never leaves that spool.
  Storage is the price of the chosen channel: Telegram delivery leaves no archive
  the project controls, so the deletion rule has to live where the project can
  enforce and prove it.
- Idempotency record contains report id/status/hash only and expires after 24 h.
- UI privacy notice says: exact geometry and optional contact leave the user's HA,
  transit the project relay and the maintainer messenger, are visible to
  maintainers and are kept on the project node up to 30 days; network infrastructure necessarily sees the HA server address,
  but House Plan does not retain it raw.
- Sending remains explicit opt-in; opening the dialog or building preview never
  contacts the external relay.

## 10. State, compatibility and migration

- No House Plan config/layout schema changes and no migration.
- Form draft, checkbox, preview token and receipt are component-memory only.
- Remount, reload and card removal discard unsent draft; no silent persistence of
  contact/message.
- Existing HA diagnostics, portable backups and #295 diagnostics stay byte- and
  behaviour-compatible.
- Card/integration version mismatch follows fail-closed behaviour: no attachment
  built by an unknown backend contract.
- Multiple card instances have independent drafts. Backend preview limits are per
  HA user/entry and cannot expose one instance's token to another user.

## 11. Accessibility, touch and responsive layout

**Touch editor: supported.** The Help/Feedback dialog opened from View or any of
the three editors has the same complete touch contract; kiosk still hides it.

- Header button has 44×44 CSS px minimum touch target without changing adjacent
  visual icon size.
- Dialog remains usable at 320 CSS px width, phone portrait/landscape, tablet and
  HA Companion safe-area insets; footer actions wrap and body scrolls internally.
- Native label/input association, required/error text through `aria-describedby`,
  status changes through restrained `aria-live="polite"`.
- On validation failure focus moves to message; on package/send failure focus moves
  to error summary; success focuses receipt heading.
- Raw JSON `<pre>` is selectable and horizontally contained; it cannot widen or
  clip the dialog.
- Escape/scrim close requires confirmation only while build/send is actually in
  flight. A completed unsent text draft may be closed without persistence warning,
  matching other non-destructive settings drafts.
- Reduced motion adds no new animation dependency.

## 12. i18n

All visible strings and stable errors exist in RU/EN/DE/FR. Russian contact label
is exact per §4; semantic translations use the same examples. User Guide routing
depends only on effective language: RU gets RU, every other locale gets EN.

Do not localize schema keys, error codes, format/version, hashes or report ids.
Relay summary message uses English stable field labels so support tooling can
parse them; user message/contact remain verbatim plain text.

## 13. Acceptance criteria and evidence

| AC | Contract | Evidence |
|---|---|---|
| AC1 | Help button follows General Settings visibility, order and kiosk rules; opens without changing mode/selection/zoom. | Browser smoke in View + three editors + kiosk/unauthorized negatives. |
| AC2 | About moves exactly once; RU Guide routes to RU, every other locale to EN. | DOM/i18n unit + smoke link assertions. |
| AC3 | Contact optional, message required/trimmed/bounded; checkbox false and draft non-persistent on each fresh open. | Frontend unit + browser smoke. |
| AC4 | Checkbox warning explicitly names exact geometry; no external request occurs on open/preview. | Text assertion + network capture. |
| AC5 | Preview/download/attachment are byte-identical and SHA-256 matches. | Backend test + browser Blob capture + relay fixture. |
| AC6 | Allowed geometry and references survive exact, while every id is package-local pseudonym and cross-references remain valid. | Backend projection round-trip/invariant suite. |
| AC7 | Forbidden sentinel corpus is absent verbatim/escaped/encoded from package, WS errors, HA logs and relay request metadata. | Adversarial backend/relay security test. |
| AC8 | Unknown nested config fields fail closed (dropped), never appear because serializer copied the source object. | Schema mutation test adding unknown sentinels at every depth. |
| AC9 | Only `may_write` can preview/submit; token cannot be read, discarded or sent by another user/entry. | HA websocket authorization tests. |
| AC10 | Expired/replaced/discarded tokens fail; config changes after preview do not change cached bytes. | Fake-clock backend tests. |
| AC11 | Submit is HTTPS/fixed-host/no-redirect, bounded and idempotent; logs contain no message/contact/body. | Stub aiohttp server + caplog + SSRF/redirect tests. |
| AC12 | Relay enforces schema, size, hash, idempotency and rate limits; HTML remains inert plain text. | Receiver unit/integration suite with a recording fake provider. |
| AC12a | A caller cannot select its own rate-limit bucket: requests carrying different forged `X-Forwarded-For` values land in one source key, and the proxy configuration overwrites the header. | Receiver test plus the deployed proxy fragment under `scripts/support-relay/deploy/`. |
| AC13 | Success shows stable report id; timeout/error preserves form and exposes retry/manual recovery without claiming success. | Browser smoke across success/429/timeout/unknown command. |
| AC14 | Phone/tablet dialog, keyboard/focus and 44 px target satisfy View touch/accessibility contract. | Reviewed desktop + phone + tablet goldens and touch smoke. |
| AC15 | No existing backup/diagnostics/preflight behavior or payload changes. | Existing targeted frontend/backend suites unchanged. |
| AC16 | Relay production URL is real, health check green, secrets absent from HACS bundle/source and retention rule documented. | Release script + staging/prod probe + secret scan/deployment evidence. |
| AC17 | Maximum supported package builds without render/main-thread regression and refuses >8 MiB before outbound send. | Backend benchmark/limit test; View performance comparison. |

## 14. Test plan

### 14.1 Pure/backend

- deterministic package ordering and byte/hash fixture;
- full pseudonym/reference matrix across spaces, walls, openings, decor, markers
  and layout;
- sentinel fixture including `broken_plan_<spaceId>` Repair normalization;
- valid/invalid frontend facts, message/contact Unicode bounds;
- write-lock consistency under concurrent config/layout mutation;
- token ownership, TTL, replacement, discard and exact-snapshot semantics;
- outbound mock for success, timeout, DNS/TLS, 302, 400/413/429/500, malformed
  success and duplicate idempotency key;
- caplog assertions that no payload values escape.

### 14.2 Frontend/browser

- header visibility/order/kiosk/mode invariants;
- lazy runtime loading and dialog close/restore;
- form validation, checkbox lifecycle, preview refresh/expiry;
- exact download Blob bytes and Copy ID/manual fallback;
- unknown-old-backend degradation;
- mobile touch target, scroll, on-screen keyboard and orientation resize;
- golden scenes: desktop no attachment, desktop preview, phone validation error,
  phone success, relay error/manual recovery, light and dark themes.

### 14.3 Relay/security

- parser/size/content-type/hash/schema/idempotency/rate-limit suite;
- HTML/header injection and Unicode controls remain plain text;
- raw IP and provider secrets absent from logs;
- fake provider verifies exact attachment bytes and escaped body;
- deployment config test enforces 30-day spool retention and 24-hour
  idempotency/rate-key expiry.

### 14.4 Mutation requirements

Mutation gate must prove at least:

- checkbox default flips to true → frontend test red;
- package serializer copies one forbidden field → sentinel test red;
- pseudonym mapping leaves one raw host/layout id → reference/privacy test red;
- preview bytes are regenerated on submit → exact-byte test red;
- authorization guard removed → backend test red;
- redirect enabled/arbitrary URL accepted → SSRF test red;
- relay skips hash/rate/idempotency check → receiver tests red;
- relay trusts the client-supplied end of `X-Forwarded-For` (first element
  instead of last) → `test_client_cannot_pick_its_own_rate_bucket` red;
- success shown on timeout → browser smoke red.

## 15. Performance and reliability budgets

- Cold ordinary View receives no relay calls and no eager support runtime growth;
  bundle budget records lazy chunk delta separately.
- For the current maximum valid config, package projection + canonical JSON
  completes in ≤750 ms on CI reference hardware and peak additional memory is
  ≤24 MiB; operation is backend-side and never blocks browser render.
- Submit total timeout 20 s; UI remains cancellable except while the single WS
  request is in flight, and disconnect returns to retryable error.
- No queue/retry runs in background after dialog/card destruction. The user owns
  every retry.

## 16. Risks and mitigations

1. **Exact geometry is personal.** Explicit unchecked consent, honest warning,
   exact preview/download, 30-day retention, no binaries/names/ids.
2. **Allowlist drifts behind schema.** Unknown keys dropped and mutation/sentinel
   tests; no generic deep-redaction helper.
3. **Public relay attracts spam.** Strict small schema, size/rate/global limits,
   idempotency; no fake embedded secret.
4. **Endpoint becomes an SSRF proxy.** Immutable HTTPS URL, redirects off, bounded
   response, no user-configured host.
5. **Channel/provider leak.** Private channel, plain text, documented provider,
   limited retention, secret/log scans.
6. **Preview differs from sent data.** Backend caches sanitized bytes by owned TTL
   token; submit never rebuilds.
7. **Stale card/backend.** Unknown command disables submit honestly while Help and
   Guide remain available.
8. **Relay outage loses draft.** No auto-close; explicit retry and manual recovery.
9. **External infrastructure unavailable.** DoR/release gate blocks S5/S7 rather
   than shipping a dead button or silent clipboard substitute.

## 17. Dependencies and Definition of Ready

Before product implementation begins, the following external facts must be
available and recorded in #43:

1. project-controlled relay deployment target and production HTTPS hostname;
2. private maintainer channel and its delivery credentials stored only in the
   relay environment, as a path to a secret file rather than a value — for the
   `ha_webhook` channel the webhook address is that credential;
3. configured and running 30-day deletion of the relay spool;
4. staging endpoint usable by CI without production delivery;
5. named maintainer responsible for relay alerts/disable switch.

These are technical/operational dependencies of the accepted Q1 default. If they
are absent after green spec review, issue remains `S5-ready` + `blocked`; product
code must not invent a public fallback or embed credentials.

## 18. Documentation and release artifacts

- `docs/USER-GUIDE.md` and `.ru.md`: button, fields, geometry warning, preview,
  receipt/manual fallback;
- `docs/ARCHITECTURE.md`: package boundary, preview-token, outbound relay;
- new `docs/SUPPORT-PRIVACY.md`: exact allowlist/exclusions, delivery channel,
  spool retention, rate-limit network metadata and deletion/contact path;
- `docs/TESTING.md`: support package/relay/golden commands;
- `scripts/support-relay/README.md`: deployment/runbook, health/disable/secret
  rotation; relay runtime, manifest and tests remain inside this class-B subtree;
- process-gate regression fixture proves a relay-only implementation commit is
  classified as B and therefore requires the issue/trailer checks;
- both changelogs in implementation commit (`User-Visible: yes`);
- reviewed desktop/phone/tablet light/dark golden artifacts and receiver security
  report before beta.

## 19. Rollback

- Revert header/dialog/backend command changes: no persisted House Plan data or
  migration remains.
- Disable relay endpoint first; clients receive retryable `support_unavailable`
  and retain manual download path.
- Reports already delivered follow the disclosed 30-day deletion rule; rollback
  never silently extends retention.
- Relay can stay deployed but disabled while old card versions disappear. It must
  return uniform 503, not accept and drop reports.
- About links return to General Settings only if product rollback explicitly
  restores the old UI; no state conversion is required.

## 20. Принятые технические предположения

Эти решения не меняют согласованный пользовательский контракт и могут быть
скорректированы ревьюером без нового вопроса владельцу:

- transport sink — приватный канал мейнтейнера в Telegram через relay проекта,
  а не private issue и не почтовый ящик (решение владельца 2026-09-01);
- support runtime остаётся в существующем lazy editor chunk;
- preview bytes кешируются только в памяти backend;
- attachment — canonical uncompressed JSON, чтобы preview/download/send были
  буквально одинаковыми;
- package-local sequential pseudonyms, а не стабильный cross-report hash;
- отсутствие shared client secret компенсируется rate/size/schema limits;
- retention 30 days for the whole delivered report, 24 hours for rate/idempotency
  metadata.
