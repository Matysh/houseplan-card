# ТЗ #38 — Конструктор правил иконок

- Issue: https://github.com/Matysh/houseplan-card/issues/38
- Приоритет: P2
- Статус ТЗ: draft, data-model proposal требует утверждения

## Цель

Обычный пользователь создаёт правило без regex, видит порядок и объяснение
первого совпадения; существующие regex остаются lossless advanced rules.

## Модель v2

```ts
type IconRule =
  | { kind: 'simple'; domains?: string[]; device_classes?: string[];
      name_words?: string[]; model_words?: string[]; icon: string }
  | { kind: 'regex'; pattern: string; icon: string };
```

Внутри одного simple rule непустые группы соединяются AND, значения группы —
OR. `name_words/model_words` — case-insensitive literal tokens, не regex.
Пустое условие невалидно. Порядок массива — приоритет, первое совпадение
побеждает. Default built-in rules идут после custom.

Legacy `{pattern,icon}` читается как `kind:'regex'` и не переписывается до
явного Save/Optimize. Backend принимает оба shapes на окно совместимости.

## UX

- Список sortable keyboard/pointer, номер и summary каждого правила.
- Simple editor: domain multiselect, device_class multiselect, words chips для
  имени/модели, HA icon picker.
- «Расширенный режим» показывает regex, live validation и предупреждение, что
  правило проверяется раньше нижележащих.
- Test device picker использует registry projection и показывает: итоговую
  icon, rule number/kind и human-readable reason по каждому matched field.
- Draft reorder/edit не влияет на plan до Save; Cancel lossless.

## Compiler

`compileIconRules()` нормализует оба shapes в predicates и diagnostics.
Invalid regex отключает только правило с объяснением, но Save блокируется.
Limits: max rules/words/string length, regex length; no flags кроме `i`.
Runtime evaluation остаётся bounded; catastrophic regex mitigated длиной и
опциональным safe-regex check, а не async worker в v1.

## Проверки и приёмка

- simple AND/OR semantics, case/whitespace, order, fallback;
- legacy regex byte-preserving roundtrip;
- invalid/overlong regex and limits backend/frontend parity;
- test device explanation совпадает с реальным `resolveIcon`;
- reorder keyboard, unsaved Cancel, narrow dialog;
- существующий config даёт те же icons до явного редактирования.
