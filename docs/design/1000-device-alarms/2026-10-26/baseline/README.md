# Исходное состояние перед визуальной итерацией

Зафиксировано локально 26.10.2026 в 14:09:56 (Europe/Moscow), до добавления интерфейса #1000.

- [screen.png](screen.png) — исходный экран.
- [fixture.json](fixture.json) — исходные синтетические данные стенда.
- [provenance.json](provenance.json) — версия продукта, коммит, fingerprint бандла и закреплённый HA frontend.
- [Исходники UI-lab на базовом коммите](https://github.com/Matysh/houseplan-card/tree/ebecea6db23aea0531de64d996b68a9b4c7df8ca/demo/ui-lab).
- [Зафиксированный продуктовый frontend](https://github.com/Matysh/houseplan-card/tree/ebecea6db23aea0531de64d996b68a9b4c7df8ca/custom_components/houseplan/frontend).

Начальные параметры: тёмная тема, русский язык, Ground floor, режим просмотра, экспериментальные стили включены, CSS overrides пустые. Экспорт браузерной сессии не снимался. Файл fixture — исходные данные, а не экспорт browser localStorage.

Исходники и продуктовый бандл доступны в репозитории по указанному неизменяемому коммиту; повторно копировать их в пакет не требуется. Команда `npm run bundle:sync` из инструкции основного README восстанавливает рабочий `dist/` из этого отслеживаемого frontend. Версии внешних зависимостей закреплены базовым коммитом и provenance; кеш HA frontend и `node_modules` подготавливаются на новом компьютере по инструкции.
