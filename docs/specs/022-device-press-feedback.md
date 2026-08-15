# Issue #22 — мгновенный отклик actionable-маркера на нажатие

- **Issue:** https://github.com/Matysh/houseplan-card/issues/22
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P3
- **Тип:** feature/polish, обычный трек
- **Пользовательское изменение:** да

## 1. Сценарий

Домочадец или администратор нажимает в View либо kiosk на маркер, настроенный на
безопасное действие. Мост или устройство отвечает не сразу, поэтому до прихода
нового HA state человеку нужен немедленный, но не вводящий в заблуждение сигнал,
что нажатие принято.

## 2. Что человек увидит до и после

До изменения маркер может визуально не отвечать до обновления сущности; после
изменения реально исполняемое нажатие кратко уменьшает маркер до 94% и возвращает
его, не подменяя фактическое состояние устройства.

## 3. Проблема

Задержка bridge/service round-trip создаёт ощущение пропущенного tap и провоцирует
повторные команды. Существующие working/alarm/open/unavailable цвета и pulses
показывают состояние, но не подтверждают сам input. Нужен отдельный transient
pressed feedback с ясной границей ownership.

## 4. Scope

В задачу входят:

- View и kiosk, desktop mouse, touch/coarse pointer и существующая keyboard
  activation маркера;
- маркеры, чей resolved primary action отправит хотя бы один разрешённый HA
  service call либо выполнит явно настроенный runnable action;
- touch/pointer/keyboard lifecycle, отмена жеста и reduced motion;
- совместимость с icon rotation/size, semantic state, activity pulse, badges,
  Glow и hover;
- unit, browser smoke, golden и performance-защита.

## 5. Не входит в задачу

- optimistic смена состояния, цвета или иконки сущности;
- ожидание HA state перед возвратом маркера;
- feedback для открытия House Plan card, HA more-info, settings или ссылки;
- feedback для no-op, unavailable, missing, secure или неподдерживаемой цели;
- отдельная пользовательская настройка эффекта;
- haptics, звук, toast и повтор service call;
- изменение контракта подтверждения #103 либо touch hover #154.

## 6. Какие действия получают feedback

Источник истины — уже вычисленный результат канонического action resolver, а не
домен, icon либо наличие `tap_action` в config.

Feedback разрешён, когда тот же activation path после всех guards:

- переключает одну или несколько доступных целей;
- отправляет cover open/close/stop;
- запускает разрешённые script/scene/automation actions;
- выполняет другое существующее безопасное marker action с HA service call.

Feedback отсутствует, если outcome:

- открывает внутреннюю карточку или more-info;
- показывает confirmation, но команда ещё не подтверждена;
- является secure no-op для lock/alarm/защитного cover;
- не имеет доступных targets либо отказан permissions/state guard;
- отменён как pan, pinch, drag, long press, context click или второй pointer.

Для действия с confirmation эффект запускается после положительного подтверждения
одновременно с фактическим dispatch, а не при открытии диалога. Для partial group
достаточно одного реально исполняемого target; список пропущенных целей и сервисный
контракт не меняются.

## 7. Визуальный контракт

Обычный вариант:

1. accepted activation переводит только визуальное тело маркера в transient
   `press-feedback`;
2. тело равномерно масштабируется относительно текущего центра до `0.94`;
3. затем возвращается к исходному масштабу коротким ease-out;
4. весь цикл не зависит от времени ответа HA и не повторяется на state update.

Эффект не меняет fill, semantic background, shadow ownership, opacity, z-index,
badge, activity waves или Glow. Он композируется с пользовательским размером и
поворотом: итоговый transform не может перезаписать существующие transform
components. Для этого visual press применяется к отдельной внутренней оболочке
либо через независимое typed transform property.

Один accepted action создаёт один цикл. Повторный отдельный tap может безопасно
перезапустить цикл от реально отображённого значения, но не создаёт очередь.

## 8. Pointer и keyboard lifecycle

- На `pointerdown` допустимо показать обычное active/pressed состояние только
  для потенциально actionable target.
- Если sequence превышает click threshold, становится pan/pinch/long press,
  получает `pointercancel`/lost capture либо меняет owner, transient состояние
  очищается без dispatch feedback.
- На accepted click/tap запускается канонический цикл из §7.
- Compatibility mouse event после touch не запускает второй цикл.
- Right click/context action feedback не получает.
- `Enter`/`Space` на существующем focus target запускают тот же feedback ровно
  один раз, если действие исполнено.

Touch cleanup из #154 очищает hover, но не semantic press animation текущего
accepted action. После terminal frame не остаётся ни hover, ни pressed class.

## 9. Reduced motion

При `prefers-reduced-motion: reduce` transform-анимация отсутствует. Accepted
action показывает мгновенный outline/opacity accent минимум на один painted frame
и затем возвращает исходный вид. Accent использует theme token и не меняет
semantic state-цвет; только opacity всего маркера также не применяется, чтобы не
имитировать unavailable.

Режим определяется действующим media-query contract и реагирует на его смену без
reload. Отдельной настройки House Plan нет.

## 10. UX и accessibility

- Feedback подтверждает input, а не успешное изменение HA state.
- Доступное имя, роль, focus и `aria-pressed` не меняются transient эффектом.
- Screen reader announcement либо live region не добавляются: они дублировали бы
  команду и могли бы объявить успех до ответа HA.
- `:focus-visible` остаётся различимым во время и после эффекта.
- Touch target и hit geometry не уменьшаются вместе с visual body.
- При двух быстрых активациях service-call policy остаётся прежней; анимация не
  является debounce и не блокирует второй допустимый action.

## 11. Модель данных, migration и i18n

Новых config/layout/localStorage полей нет. Эффект всегда включён для реально
исполняемых marker actions. Миграция и compatibility fields не нужны.

Новых пользовательских строк и i18n-ключей нет. Если реализация обнаружит
необходимость настройки или текста, это расширение visible scope и отдельное
решение владельца, а не часть #22.

## 12. Acceptance criteria

1. **AC1 — instant action feedback.** Каждый реально dispatch-нутый marker action
   создаёт один цикл `1 → 0.94 → 1`, начинающийся в том же interaction turn и не
   ожидающий HA state. **Доказательство:** unit clock test + browser smoke.
2. **AC2 — точный action gate.** Dialog/more-info, secure/no-target/unavailable
   no-op, отменённый gesture и неподтверждённая confirmation не получают цикл.
   **Доказательство:** resolver unit matrix + browser smoke.
3. **AC3 — visual composition.** Пользовательский size/rotation, badges, semantic
   colors, activity pulse, Glow и hit target не меняются. **Доказательство:** unit
   style contract + reviewed golden.
4. **AC4 — touch ownership.** Tap даёт один цикл; pan, pinch, long press, cancel и
   compatibility mouse не дают ложного/двойного feedback. **Доказательство:**
   real-touch browser smoke.
5. **AC5 — reduced motion.** При reduce нет transform tween, но accepted action
   виден через мгновенный outline/opacity минимум один frame. **Доказательство:**
   media-query smoke + golden.
6. **AC6 — keyboard/focus.** Enter/Space дают тот же цикл, focus-visible и DOM
   focus сохраняются. **Доказательство:** keyboard smoke.
7. **AC7 — bounded lifecycle.** Быстрые повторные actions retarget эффект без
   очереди; mode/space/visibility/disconnect очищают transient state.
   **Доказательство:** fake-clock unit + lifecycle smoke.
8. **AC8 — no model change.** Config/layout/storage и service-call payload не
   меняются. **Доказательство:** serialization unit + code review.

## 13. План автотестов

### Unit

- action outcome → feedback eligibility matrix;
- one cycle per dispatch, partial group, confirmation before/after accept;
- fake-clock lifecycle, retarget, cancel и disconnect;
- transform composition with marker scale/rotation;
- reduced-motion branch and no storage mutation.

### Browser smoke

- desktop click, touch tap и keyboard activation на light/cover/script;
- slow fake HA response: marker returns before state update;
- no-op secure target, unavailable target, more-info и cancelled confirmation;
- pan/pinch/long press/pointercancel и touch compatibility mouse;
- rapid double activation without animation queue;
- mode/space/visibility transition during feedback.

### Golden

- normal press frame, reduced-motion accent, light/dark theme;
- active semantic marker with badge/pulse demonstrates unchanged state layers;
- golden capture uses deterministic paused animation time.

### Performance

- feedback changes only selected marker visual state;
- no full geometry rebuild or layout read;
- pointer move does not create Lit updates;
- canonical device interaction smoke has no new long task.

## 14. Затронутые поверхности

- marker action dispatch and pointer/keyboard routing in `src/houseplan-card.ts`;
- marker styles in `src/styles.ts` and, if needed, a small pure feedback helper;
- action resolver tests and targeted browser/golden fixtures;
- `docs/USER-GUIDE.ru.md`, `docs/CANVAS.md`, `docs/TESTING.md`.

Конкретная раскладка helper выбирается реализацией; второй action resolver
создавать нельзя.

## 15. Риски и откат

| Риск | Мера |
| --- | --- |
| Feedback обещает успех вместо принятого input | semantic state не меняется |
| Transform ломает rotation/pulse | отдельная visual оболочка/composition test |
| Touch генерирует два цикла | pointer ownership + compatibility guard |
| No-op выглядит исполненным | eligibility из final resolver outcome |
| Анимации копятся | single retargetable transient state |

Откат удаляет visual feedback path и возвращает прежнее action поведение. Данных,
миграции и backend rollback нет.

## 16. Release-артефакты

Implementation commit имеет `User-Visible: yes` и одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — feedback безопасных marker actions;
- `docs/CANVAS.md` — separation press/hover/semantic state;
- `docs/TESTING.md` — pointer, keyboard и reduced-motion smoke.

Нужны reviewed normal/reduced-motion golden artifacts и targeted browser smoke
report. Новых i18n строк нет.

## 17. Принятые технические предположения

- feedback запускается по final action outcome, а не по домену;
- transition живёт на внутреннем visual body и не меняет hit geometry;
- цикл короткий и retargetable; точные easing/duration выбираются в реализации и
  фиксируются visual test, не становясь config surface;
- #154 очищает hover независимо от press-feedback;
- confirmation запускает feedback только после согласия и dispatch.
