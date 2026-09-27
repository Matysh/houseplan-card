# ТЗ #32 — единое подтверждение опасных действий

- Issue: https://github.com/Matysh/houseplan-card/issues/32
- Приоритет: P1
- Статус ТЗ: draft for S4 review
- Трек: полный — меняется общий UX-контракт на нескольких View/editor/onboarding
  поверхностях, включая touch и четыре локали
- Основа: `src/hp-dialog.ts`, `docs/ARCHITECTURE.md` § One modal contract,
  `docs/TOUCH-SUPPORT.md` § Safety floor

## 1. Сценарий, персона и момент

**Персона:** администратор дома. Для unlock — также член семьи, которому доступна
карточка проёма в View.

**Поверхности:** View, Plan editor, Device editor, диалог пространства и
первичное onboarding-состояние без редакторского runtime.

**Момент:** пользователь уже явно нажал опасное действие — удалить объект/файл
либо открыть замок — и должен понять точный объект и последствия до выполнения.

## 2. До и после

**До:** шесть сценариев используют восемь browser `confirm()`: системный вид
зависит от браузера, объект и последствия помещены в одну строку, начальный
фокус не контролируется, а вложенный диалог ведёт себя иначе, чем остальные
модальные окна House Plan.

**После:** каждый из этих сценариев показывает один локализованный диалог House
Plan с явным заголовком, последствиями, безопасным начальным фокусом и
одинаковым поведением мыши, клавиатуры и touch; отмена гарантированно ничего не
меняет.

## 3. Проблема и цель

Native `confirm()` не входит в общий `hp-dialog`-контракт, поэтому не наследует
проверенное восстановление фокуса, перенос длинного footer и согласованную
семантику destructive/warning. Кроме визуальной разнородности, синхронный API
маскирует race: объект, диалог или revision могли измениться, пока пользователь
решал.

Цель — удалить все прямые runtime-вызовы browser `confirm()` и дать опасным
действиям один доступный, локализованный, touch-safe и race-safe контракт без
изменения самих операций и формата данных.

## 4. Scope

### 4.1 В scope

1. Общий presentation-компонент `hp-confirm` поверх `hp-dialog`.
2. Один promise-controller в корневом `houseplan-card`, доступный eager View,
   editor runtime и onboarding runtime через host port.
3. Перевод восьми текущих call sites:

| Класс | Runtime / текущий call site | Семантика |
|---|---|---|
| Незавершённый контур целиком | `houseplan-editor-runtime::_deleteDraftWhole` | destructive |
| Сегмент незавершённого контура | `houseplan-editor-runtime::_deleteDraftSegment` | destructive |
| Устройство/маркер с плана | `houseplan-editor-runtime::_deleteMarker` | destructive |
| Файл плана | editor `_deleteServerPlan` | destructive |
| Файл плана | onboarding `_deleteServerPlan` | destructive |
| Пространство | editor `_deleteSpace` | destructive |
| Пространство | onboarding `_deleteSpace` | destructive |
| Открытие замка из карточки проёма | `houseplan-card::_lockAction(..., 'unlock')` | warning |

4. Revalidation объекта и права на действие после `await` подтверждения и до
   первой mutation/service call.
5. Отмена pending-подтверждения при смене пространства/режима, уходе с route,
   disconnect и замене новым request.
6. Локализация новых заголовков и body во всех поддерживаемых словарях:
   English, Russian, German, French.
7. Целевой browser smoke и unit/contract-тесты.
8. Актуализация `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.ru.md` и обоих
   changelog.

### 4.2 Вне scope

- Семантика удаления, серверные endpoints, revision-модель, Undo/Redo и формат
  config/layout.
- Добавление подтверждений действиям, которые сейчас выполняются без них.
- Замена специализированных диалогов: удаление комнаты, удаление стены с
  проёмами, стирание декора, backup/optimize, Tap confirmation. Они содержат
  дополнительные варианты или данные и уже используют `hp-dialog`.
- Подтверждение **закрытия** замка: это безопасное действие и остаётся без
  дополнительного шага.
- Полная поддержка редакторов на touch. Здесь действует только обязательный
  safety floor: диалог доступен, не обрезан и не допускает случайного accept.

## 5. Компонент и API

### 5.1 Публичные типы

`src/hp-confirm.ts` экспортирует presentation-типы:

```ts
export type HpConfirmKind = 'destructive' | 'warning';

export interface HpConfirmRequest {
  key: string;              // стабильный класс операции для диагностики/tests
  kind: HpConfirmKind;
  title: string;
  message: string;
  objectName?: string;
  confirmLabel: string;
  cancelLabel: string;
  icon?: string;
}
```

`objectName`, если задан, выводится отдельным текстовым блоком, а не
конкатенируется компонентом с body. Строки уже локализованы владельцем request;
`hp-confirm` не обращается к глобальной локали.

Корневой host предоставляет runtime один метод:

```ts
_confirmDanger(request: HpConfirmRequest): Promise<boolean>;
```

Внутренний token генерирует controller. Caller не может переиспользованием
`key` подтвердить старый request. `true` означает единственный явный accept;
close, scrim, Escape, replacement и lifecycle cancellation возвращают `false`.

### 5.2 Владение состоянием

- В `houseplan-card` существует не более одного active request.
- `hp-confirm` только отображает immutable request и отправляет `hp-confirm`
  / `hp-cancel`; mutation callback внутрь компонента не передаётся.
- Новый request атомарно завершает предыдущий как `false`, затем становится
  active. Два диалога подтверждения не сосуществуют.
- Resolve сначала очищает active state, затем ровно один раз завершает promise.
  Повторный click/event со старым token игнорируется.
- На disconnect или уходе с карточки все pending promises завершаются `false`.
- Controller находится в eager root, поэтому onboarding не тянет editor chunk,
  а View unlock не загружает его.
- Это осознанный прирост initial View graph: Lit и `hp-dialog` уже находятся в
  eager-графе, поэтому новый presentation/controller должен добавить не более
  **3 KiB gzip** к baseline 284055 B и оставить весь initial View ниже
  действующего бюджета **300000 B gzip** (headroom до задачи: 15945 B).

## 6. UX-контракт

### 6.1 Общий вид

- `hp-confirm` всегда рендерит `hp-dialog`, не собственный modal shell.
- Заголовок называет действие; object name и body объясняют точный объект и
  последствие. Технические id не показываются вместо доступного friendly name.
- Destructive: `mdi:alert-outline`, последняя кнопка использует существующий
  danger-стиль и label «Удалить».
- Warning unlock: `mdi:lock-open-alert-outline`, action использует warning/on
  акцент и label «Открыть замок»; тексты удаления не переиспользуются.
- Cancel находится перед action в DOM, имеет `autofocus` и является начальным
  фокусом. Кнопка опасного действия никогда не получает autofocus.
- `Escape`, close X и click по scrim равны Cancel.
- `Enter` на начальном фокусе отменяет; подтвердить Enter/Space можно только
  после явного перевода фокуса на action button.
- Tab/focus trap и restore focus наследуются от `hp-dialog`. После вложенного
  подтверждения фокус возвращается в исходный родительский диалог; если тот
  закрыт самой операцией — к первоначальному внешнему trigger.

### 6.2 Footer и touch

- Footer содержит только Cancel и action, выровненные вправо.
- Ряд допускает перенос; каждая кнопка сохраняет доступную touch-target высоту.
- При 320 CSS px, максимальном системном масштабе шрифта из существующего
  smoke-набора и длинных German/French labels отсутствуют horizontal scroll и
  обрезание action.
- Tap по scrim/Cancel никогда не пробрасывается в план или родительский dialog.

### 6.3 Тексты сценариев

Каждый request имеет отдельные title/body keys. Существующие однофразовые ключи
могут быть сохранены только как compatibility/dead-free alias, если они ещё
используются вне этих call sites; новые диалоги их не склеивают.

| Сценарий | Что обязан сообщить body |
|---|---|
| Контур целиком | Незавершённый контур будет удалён; отмена безопасна |
| Сегмент контура | Сегмент будет удалён, остаток может разделиться на два |
| Устройство | Маркер исчезнет с плана и перестанет влиять на данные; его можно добавить заново |
| Файл плана | Удаляется серверный файл, действие необратимо |
| Пространство | Удаляются пространство, комнаты и разметка; существующая blocker-проверка остаётся раньше confirm |
| Unlock | Будет отправлена команда открытия названному замку |

## 7. Race safety и эффекты

До accept ни один caller не меняет config/layout, не создаёт history/undo point,
не ставит `busy`, не пишет store и не вызывает HA service/WS mutation.

После `await` caller заново проверяет актуальную модель, не используя ссылку на
mutable object, захваченную перед диалогом:

- draft whole: тот же id всё ещё существует в текущем space;
- draft segment: тот же draft и индекс сегмента существуют; лимит разбиения
  проверяется на актуальном массиве;
- marker: диалог относится к тому же marker, он не busy и marker/binding ещё
  существуют;
- plan file: запись ещё есть в текущем server list и не стала используемой;
- space: dialog/space id совпадают, space существует, dependencies и
  last-space исключение пересчитаны; WS получает текущие revisions;
- unlock: карточка/привязка ещё доступны, сущность существует и всё ещё в
  состоянии, допускающем unlock. Иначе service call отсутствует.

Если revalidation не проходит, операция завершается тихо либо существующим
toast/blocker-сообщением; stale request никогда не действует на «первый
подходящий» объект.

Double click по исходной кнопке создаёт максимум один исполнимый request: новый
заменяет старый, старый `await` получает `false`. Double click по action после
первого resolve не создаёт второй mutation.

## 8. Данные, совместимость и миграция

- Persisted schema не меняется; миграция отсутствует.
- Серверные команды и payload остаются прежними.
- Командные стеки получают те же записи, что до задачи, только после accept.
- Browser/native-dialog feature detection не нужен: fallback уже принадлежит
  `hp-dialog` (`ha-dialog` в HA, native `<dialog>` в demo).
- Старые локализованные ключи можно удалить только если source/test search
  доказывает отсутствие потребителей.

## 9. Acceptance criteria и доказательство

| AC | Критерий | Доказательство |
|---|---|---|
| AC-1 | В `src/**` нет прямого runtime-вызова browser `confirm()` | source-contract test + `rg` без комментариев/тестовых строк |
| AC-2 | Все 8 call sites из §4.1 вызывают общий host promise API | unit/source-contract + review diff |
| AC-3 | Cancel, X, scrim и Escape не создают mutation/undo/service call во всех 6 классах операций | `demo/smoke_danger_confirmation.mjs` |
| AC-4 | Accept выполняет ровно прежнюю операцию один раз во всех 6 классах, включая оба lazy runtime для plan/space | тот же browser smoke + точные WS/service counters |
| AC-5 | Replacement/disconnect/stale token завершаются cancel; double accept исполняется один раз | unit controller test |
| AC-6 | После смены объекта/revision между open и accept stale mutation не выполняется | unit/browser race cases |
| AC-7 | Начальный фокус — Cancel; Tab trap, Escape и restore focus работают во fallback и HA branch | browser smoke на базе `hp-dialog` |
| AC-8 | На viewport 320 px и длинных ru/de/fr строках footer и body не имеют horizontal overflow, обе кнопки доступны | browser responsive matrix |
| AC-9 | Unlock остаётся единственной разрешённой lock actuation surface и никогда не вызывает `lock.unlock` после cancel/stale state | browser smoke + существующий lock invariant test |
| AC-10 | Открытие first-space/onboarding не загружает editor chunk только ради confirm | lazy chunk smoke/manifest assertion |
| AC-11 | Все четыре словаря имеют одинаковый набор новых ключей | `test/i18n.test.mjs` |
| AC-12 | Специализированные room/partition/decor/Tap dialogs сохраняют прежнее поведение | существующие targeted smokes/unit |
| AC-13 | Initial View остаётся ≤300000 B gzip, а прирост к baseline 284055 B — ≤3 KiB gzip | `npm run bundle:budget` + сравнение manifest initial graph |

## 10. Тестовый план

### Unit / contract

1. Controller: accept, cancel, replacement, disconnect, stale token,
   double-resolve.
2. Source inventory: ровно ноль browser `confirm()` в runtime и восемь
   мигрированных consumers общего API.
3. i18n parity и непустые title/body/action labels в en/ru/de/fr.
4. Revalidation helpers/paths: объект исчез, dialog сменился, revision/blocked
   state изменились.

### Browser smoke

Добавить `demo/smoke_danger_confirmation.mjs` с таблицей сценариев:

- draft whole и draft segment;
- marker delete;
- stored plan delete в editor и onboarding runtime;
- space delete в editor и onboarding runtime;
- unlock в View.

Для каждого: открыть, проверить title/body/object, cancel без side effect,
открыть повторно, accept с одним side effect. Отдельно: replacement,
Escape/focus restore, 320 px footer и смена контекста до accept.

Перед S7 обязательны:

```text
npm run typecheck
npm test
npm run build
npm run bundle:sync
npm run bundle:budget
node demo/smoke_danger_confirmation.mjs
node demo/smoke_esc_dialogs.mjs
node demo/smoke_dialog_footer_width.mjs
node demo/smoke_toggle_confirmation.mjs
node scripts/no-new-any.mjs --base origin/dev --head HEAD
node scripts/check-docs.mjs
```

`npm run golden:verify` выполняется, если новый общий dialog входит в текущую
golden-матрицу либо diff показывает изменение существующего baseline.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Два nested modal нарушают focus restore | Использовать существующую root-scoped session `hp-dialog`, отдельный smoke parent → confirm → parent/outside |
| Promise остаётся pending после удаления DOM | Явный root lifecycle cancel и unit disconnect |
| Синхронный caller продолжит работу до решения | Все восемь handlers становятся/остаются `async`, mutation расположена только после `await true` |
| Lazy onboarding начнёт тянуть editor | Controller/component находятся в eager graph; manifest/lazy smoke |
| Новый request подтвердит старый callback | Host-generated token и resolve с проверкой token |
| Длинные локали обрежут footer | Общий wrapping footer + 320 px browser matrix |
| Revalidation изменит прежнюю команду | Revalidation только прекращает stale/невозможную операцию; валидный accept использует прежний endpoint/payload |

## 12. Rollback

Rollback — один revert продуктового коммита: schema и backend не меняются,
поэтому данные откатывать не нужно. Возврат к browser `confirm()` допустим
только как полный revert задачи, не как fallback внутри нового компонента.

## 13. Release artifacts / DoD

- `src/hp-confirm.ts` и root controller/API;
- миграция восьми call sites без прямого browser `confirm()`;
- unit/contract и browser smoke из §10;
- четыре синхронных словаря;
- обновлённые `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.ru.md`;
- пользовательская запись в `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в том же `User-Visible: yes` коммите;
- generated bundle синхронизирован через `npm run bundle:sync`;
- все AC подтверждены командами/результатами в issue перед S7.

## 14. Технические допущения (не продуктовые решения)

- Controller хранится в `houseplan-card`, а `hp-confirm` остаётся stateless
  presentation surface; reviewer может изменить разбиение без изменения UX.
- Один active request с replacement-семантикой предпочтительнее очереди:
  очередь позволила бы подтвердить уже невидимый контекст.
- Отдельный `key` нужен для диагностики и тестов, но безопасность строится на
  внутреннем token, не на строковом ключе.
