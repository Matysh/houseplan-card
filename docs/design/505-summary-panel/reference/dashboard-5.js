(() => {
  const panel = document.querySelector("#dashboard3-panel");
  const blocksContainer = document.querySelector("#dashboard3-blocks");
  const settingsToggle = document.querySelector(".dashboard3-settings-toggle");
  const globalToggle = document.querySelector(".dashboard3-global-toggle");
  const panelTitleHeading = document.querySelector("#dashboard5-panel-title");
  const dashboardBody = document.querySelector(".dashboard-body");
  const spaceTabs = [...document.querySelectorAll(".dashboard3-space-tab")];
  const settingsDialog = document.querySelector("#dashboard3-settings-dialog");
  const settingsForm = settingsDialog?.querySelector(".dashboard3-settings-dialog__window");
  const settingsClose = settingsDialog?.querySelector(".dashboard3-settings-dialog__close");
  const settingsCancel = settingsDialog?.querySelector(".dashboard3-settings-cancel");
  const settingsSave = settingsDialog?.querySelector(".dashboard3-settings-save");
  const settingsStatus = document.querySelector("#dashboard3-settings-status");
  const panelTitleInput = document.querySelector("#dashboard3-panel-title");
  const panelTitleError = panelTitleInput?.parentElement.querySelector(".dashboard3-field__error");
  const showMobileInput = document.querySelector("#dashboard3-show-mobile");
  const showPanelInput = document.querySelector("#dashboard5-show-panel");
  const editorList = document.querySelector("#dashboard3-block-editor-list");
  const blockCount = document.querySelector("#dashboard3-block-count");
  const addBlockButton = document.querySelector(".dashboard3-add-block");
  const entityPicker = document.querySelector("#dashboard3-entity-picker");
  const entitySearch = document.querySelector("#dashboard3-entity-search");
  const entityList = document.querySelector("#dashboard3-entity-list");
  const sizeToggle = document.querySelector(".dashboard4-size-toggle");
  const themeToggle = document.querySelector(".dashboard4-theme-toggle");
  const kioskToggle = document.querySelector(".dashboard4-kiosk-toggle");
  const sizeDialog = document.querySelector("#dashboard4-size-dialog");
  const sizeForm = sizeDialog?.querySelector(".dashboard4-size-dialog__window");
  const sizeClose = sizeDialog?.querySelector(".dashboard4-size-close");
  const sizeReset = sizeDialog?.querySelector(".dashboard4-size-reset");
  const iconSizeInput = document.querySelector("#dashboard4-icon-size");
  const textSizeInput = document.querySelector("#dashboard4-text-size");
  const iconSizeOutput = document.querySelector("#dashboard4-icon-size-output");
  const textSizeOutput = document.querySelector("#dashboard4-text-size-output");

  if (!panel || !blocksContainer || !settingsToggle || !globalToggle || !panelTitleHeading || !dashboardBody || !spaceTabs.length || !settingsDialog || !settingsForm || !settingsClose || !settingsCancel || !settingsSave || !settingsStatus || !panelTitleInput || !panelTitleError || !showMobileInput || !showPanelInput || !editorList || !blockCount || !addBlockButton || !entityPicker || !entitySearch || !entityList || !sizeToggle || !themeToggle || !kioskToggle || !sizeDialog || !sizeForm || !sizeClose || !sizeReset || !iconSizeInput || !textSizeInput || !iconSizeOutput || !textSizeOutput) return;

  const limits = { blocks: 10, values: 20 };
  const storageKeys = {
    config: "houseplan-dashboard5-config",
    enabled: "houseplan-dashboard5-enabled",
    theme: "houseplan-dashboard5-theme",
    kiosk: "houseplan-dashboard5-kiosk",
    sizes: "houseplan-dashboard5-local-sizes"
  };
  const spaces = [
    { id: "ground-floor", name: "Ground Floor" },
    { id: "first-floor", name: "First Floor" },
    { id: "yard", name: "Yard" }
  ];
  const entities = [
    { entityId: "sensor.kitchen_temperature", name: "Kitchen temperature", state: "20,6 °C" },
    { entityId: "sensor.living_room_humidity", name: "Living room humidity", state: "42 %" },
    { entityId: "light.wall_lamp_3", name: "Wall Lamp 3", state: "Выключено" },
    { entityId: "light.terrace_lights", name: "Terrace lights", state: "Включено" },
    { entityId: "climate.ground_floor", name: "Ground floor climate", state: "Нагрев · 21 °C" },
    { entityId: "sensor.ground_floor_average_temperature", name: "Средняя температура первого этажа", state: "20,9 °C", template: true },
    { entityId: "sensor.outdoor_temperature", name: "Outdoor temperature", state: "12,4 °C" },
    { entityId: "sensor.outdoor_humidity", name: "Outdoor humidity", state: "Загрузка…", status: "loading" },
    { entityId: "binary_sensor.front_door", name: "Front door", state: "Закрыто" },
    { entityId: "binary_sensor.smoke_kitchen", name: "Kitchen smoke detector", state: "Норма" },
    { entityId: "switch.sauna_heater", name: "Sauna heater", state: "Выключено" },
    { entityId: "sensor.sauna_temperature", name: "Sauna temperature", state: "24,1 °C" },
    { entityId: "sensor.boiler_temperature", name: "Boiler temperature", state: "54,0 °C" },
    { entityId: "binary_sensor.boiler_water_leak", name: "Boiler water leak", state: "Норма" },
    { entityId: "sensor.washing_machine_progress", name: "Washing machine progress", state: "66 %" },
    { entityId: "sensor.washing_machine_state", name: "Washing machine state", state: "Rinsing" },
    { entityId: "media_player.kitchen_display", name: "Kitchen display", state: "Ожидание" },
    { entityId: "camera.entrance", name: "Entrance camera", state: "Недоступно", status: "unavailable" },
    { entityId: "fan.kitchen_hood", name: "Kitchen hood", state: "Выключено" },
    { entityId: "cover.guest_bedroom_blinds", name: "Guest bedroom blinds", state: "Открыто" },
    { entityId: "sensor.house_energy_today", name: "House energy today", state: "8,7 kWh" },
    { entityId: "vacuum.ground_floor", name: "Ground floor vacuum", state: "На базе" },
    { entityId: "person.demo", name: "Demo", state: "Дома" },
    { entityId: "weather.home", name: "Home weather", state: "Облачно · 13 °C", status: "stale" }
  ];

  let blockSequence = 1;
  let valueSequence = 3;
  let activeSpaceId = "ground-floor";
  let globalEnabled = false;
  let config = {
    title: "Сводная информация",
    showOnMobile: true,
    blocks: [
      {
        id: "block-1",
        title: "Общее",
        visible: true,
        scope: { type: "all", spaceId: null },
        values: [
          { id: "value-1", label: "Количество устройств", source: { type: "system", key: "device_count", name: "Количество устройств" } },
          { id: "value-2", label: "Общая площадь комнат", source: { type: "system", key: "room_area", name: "Общая площадь комнат" } },
          { id: "value-3", label: "Текущие дата и время", source: { type: "system", key: "date_time", name: "Текущие дата и время" } }
        ]
      }
    ]
  };
  let draft = null;
  let baseline = null;
  let draftEnabled = false;
  let baselineEnabled = false;
  let dragContext = null;
  let pickerContext = null;
  let currentTheme = "light";
  let kioskEnabled = false;
  let localSizes = { icons: 100, text: 100 };

  try {
    const storedConfig = window.localStorage.getItem(storageKeys.config);
    if (storedConfig) config = JSON.parse(storedConfig);
    globalEnabled = window.localStorage.getItem(storageKeys.enabled) === "true";
    currentTheme = window.localStorage.getItem(storageKeys.theme) || "light";
    kioskEnabled = window.localStorage.getItem(storageKeys.kiosk) === "true";
    const storedSizes = window.localStorage.getItem(storageKeys.sizes);
    if (storedSizes) localSizes = { ...localSizes, ...JSON.parse(storedSizes) };
  } catch (error) {
    console.warn("Dashboard 5: сохранённая конфигурация недоступна", error);
  }
  blockSequence = Math.max(1, config.blocks.length);
  valueSequence = Math.max(3, ...config.blocks.flatMap((block) => block.values.map((value) => Number(String(value.id).match(/\d+/)?.[0]) || 0)));

  const persist = (key, value) => {
    try {
      window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch (error) {
      console.warn("Dashboard 5: не удалось сохранить настройку", error);
    }
  };

  const applyTheme = () => {
    document.documentElement.dataset.theme = currentTheme;
    themeToggle.setAttribute("aria-label", currentTheme === "dark" ? "Включить светлую тему" : "Включить тёмную тему");
  };

  const applyKiosk = () => {
    document.body.classList.toggle("dashboard5-kiosk", kioskEnabled);
    kioskToggle.setAttribute("aria-pressed", String(kioskEnabled));
    kioskToggle.textContent = kioskEnabled ? "Выйти" : "Киоск";
  };

  const applyLocalSizes = () => {
    document.documentElement.style.setProperty("--dashboard4-device-scale", String(localSizes.icons / 100));
    document.documentElement.style.setProperty("--dashboard4-room-text-scale", String(localSizes.text / 100));
    iconSizeInput.value = String(localSizes.icons);
    textSizeInput.value = String(localSizes.text);
    iconSizeOutput.textContent = `${localSizes.icons}%`;
    textSizeOutput.textContent = `${localSizes.text}%`;
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fingerprint = (value) => JSON.stringify(value);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const currentSpace = () => spaces.find((space) => space.id === activeSpaceId) || spaces[0];
  const findDraftBlock = (blockId) => draft?.blocks.find((block) => block.id === blockId);
  const findDraftValue = (blockId, valueId) => findDraftBlock(blockId)?.values.find((value) => value.id === valueId);

  const isNarrowViewport = () => {
    if (typeof window.hass?.narrow === "boolean") return window.hass.narrow;
    return document.documentElement.dataset.haNarrow === "true";
  };

  const formatDateTime = () => new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date()).replace(".", "");

  const entitySnapshot = (entityId) => {
    const hassState = window.hass?.states?.[entityId];
    if (hassState) {
      const rawState = hassState.state;
      const status = rawState === "unavailable" || rawState === "unknown" ? "unavailable" : hassState.attributes?.restored ? "stale" : "ready";
      let text;
      try {
        text = typeof window.hass.formatEntityState === "function" ? window.hass.formatEntityState(hassState) : rawState;
      } catch {
        text = rawState;
      }
      return { text: text || "Нет данных", status };
    }
    const demoEntity = entities.find((item) => item.entityId === entityId);
    if (!demoEntity) return { text: "Недоступно", status: "unavailable" };
    return { text: demoEntity.state || "Нет данных", status: demoEntity.status || "ready" };
  };

  const resolveValue = (value) => {
    if (value.source.type === "system") {
      if (value.source.key === "device_count") return { text: "50", status: "ready" };
      if (value.source.key === "room_area") return { text: "156 м²", status: "ready" };
      if (value.source.key === "date_time") return { text: formatDateTime(), status: "ready" };
    }
    return entitySnapshot(value.source.entityId);
  };

  const sourcePresentation = (source) => {
    if (!source) return { name: "Выберите сущность", detail: "Поиск по всем сущностям HA" };
    if (source.type === "system") return { name: source.name, detail: "Системное значение" };
    const entity = entities.find((item) => item.entityId === source.entityId);
    if (!entity) return { name: "Недоступная сущность", detail: `${source.entityId || "Не выбрано"} · Требует внимания` };
    const status = entity.status === "unavailable" ? " · Недоступно" : entity.status === "stale" ? " · Данные устарели" : entity.status === "loading" ? " · Загрузка" : "";
    return { name: entity.name, detail: `${entity.entityId}${status}` };
  };

  const blockMatchesSpace = (block) => block.scope.type === "all" || block.scope.spaceId === activeSpaceId;

  const positionPanel = () => {
    const bottom = window.matchMedia("(orientation: portrait)").matches;
    panel.classList.toggle("dashboard5-panel-bottom", bottom);
    panel.dataset.position = bottom ? "bottom" : "right";
  };

  const renderGlobalState = () => {
    const hiddenByMobile = isNarrowViewport() && !config.showOnMobile;
    const visible = globalEnabled && !hiddenByMobile;
    panel.hidden = false;
    panel.classList.toggle("is-visible", visible);
    panel.setAttribute("aria-hidden", String(!visible));
    globalToggle.setAttribute("aria-pressed", String(globalEnabled));
    globalToggle.title = globalEnabled ? "Скрыть информационную панель" : "Показать информационную панель";
    globalToggle.setAttribute("aria-label", globalToggle.title);
  };

  const renderPanel = () => {
    const title = config.title.trim() || "Сводная информация";
    panelTitleHeading.textContent = title;
    panel.setAttribute("aria-label", title);
    positionPanel();
    renderGlobalState();

    blocksContainer.replaceChildren();
    const displayedBlocks = config.blocks.filter((block) => block.visible && blockMatchesSpace(block));
    if (!displayedBlocks.length) {
      const empty = document.createElement("div");
      empty.className = "dashboard3-empty";
      empty.textContent = `Для пространства «${currentSpace().name}» нет настроенных блоков.`;
      blocksContainer.append(empty);
      return;
    }

    displayedBlocks.forEach((block) => {
      const valuesHtml = block.values.map((value) => {
        const resolved = resolveValue(value);
        const statusLabel = resolved.status === "loading" ? "Загрузка" : resolved.status === "stale" ? "Данные устарели" : resolved.status === "unavailable" ? "Источник недоступен" : "";
        return `
          <div class="dashboard3-value dashboard4-value--${resolved.status}">
            <dt>${escapeHtml(value.label)}</dt>
            <dd>${escapeHtml(resolved.text)}${statusLabel ? `<small>${escapeHtml(statusLabel)}</small>` : ""}</dd>
          </div>`;
      }).join("");
      const card = document.createElement("section");
      card.className = "dashboard3-block";
      card.innerHTML = `
        <header class="dashboard3-block__header">
          <h3>${escapeHtml(block.title)}</h3>
        </header>
        <dl class="dashboard3-block__values">${valuesHtml || '<div class="dashboard3-empty">В блоке пока нет значений.</div>'}</dl>`;
      blocksContainer.append(card);
    });
  };

  const validateDraft = () => {
    const errors = [];
    if (!draft?.title.trim()) errors.push({ type: "panel-title" });
    draft?.blocks.forEach((block) => {
      if (!block.title.trim()) errors.push({ type: "block-title", blockId: block.id });
      if (block.scope.type === "space" && !block.scope.spaceId) errors.push({ type: "space", blockId: block.id });
      block.values.forEach((value) => {
        const missing = [];
        if (!value.label.trim()) missing.push("название");
        if (!value.source) missing.push("сущность");
        if (missing.length) errors.push({ type: "value", blockId: block.id, valueId: value.id, missing });
      });
    });
    return errors;
  };

  const updateDialogState = () => {
    if (!draft || !baseline) return;
    const errors = validateDraft();
    const dirty = fingerprint(draft) !== fingerprint(baseline) || draftEnabled !== baselineEnabled;
    settingsSave.hidden = !dirty;
    settingsSave.disabled = errors.length > 0;
    panelTitleInput.classList.toggle("is-invalid", !draft.title.trim());
    panelTitleError.textContent = draft.title.trim() ? "" : "Введите название панели";

    editorList.querySelectorAll(".dashboard3-editor-block").forEach((element) => {
      const blockId = element.dataset.blockId;
      const block = findDraftBlock(blockId);
      if (!block) return;
      element.querySelector(".dashboard3-block-title").classList.toggle("is-invalid", !block.title.trim());
      const scopeSelect = element.querySelector(".dashboard4-space-select");
      const invalidScope = block.scope.type === "space" && !block.scope.spaceId;
      if (scopeSelect) scopeSelect.classList.toggle("is-invalid", invalidScope);
      element.querySelectorAll(".dashboard3-editor-value").forEach((rowElement) => {
        const value = findDraftValue(blockId, rowElement.dataset.valueId);
        if (!value) return;
        const missing = [];
        if (!value.label.trim()) missing.push("название");
        if (!value.source) missing.push("сущность");
        rowElement.classList.toggle("has-error", missing.length > 0);
        rowElement.querySelector(".dashboard3-value-label").classList.toggle("is-invalid", !value.label.trim());
        rowElement.querySelector(".dashboard3-entity-trigger").classList.toggle("is-invalid", !value.source);
        rowElement.querySelector(".dashboard3-editor-value__error").textContent = missing.length ? `Заполните: ${missing.join(" и ")}` : "";
      });
    });

    settingsStatus.textContent = errors.length
      ? `Нельзя сохранить: незаполненных полей — ${errors.length}`
      : dirty ? "Есть несохранённые изменения" : "";
    settingsStatus.classList.toggle("is-ready", dirty && !errors.length);
  };

  const moveItemByOffset = (items, itemId, offset) => {
    const sourceIndex = items.findIndex((item) => item.id === itemId);
    const targetIndex = sourceIndex + offset;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return false;
    [items[sourceIndex], items[targetIndex]] = [items[targetIndex], items[sourceIndex]];
    return true;
  };

  const moveItem = (items, sourceId, targetId, placeAfter) => {
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    if (sourceIndex < 0) return;
    const [moved] = items.splice(sourceIndex, 1);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (targetIndex < 0) items.push(moved);
    else items.splice(targetIndex + (placeAfter ? 1 : 0), 0, moved);
  };

  const restoreOrderFocus = (selector) => {
    window.requestAnimationFrame(() => editorList.querySelector(selector)?.focus());
  };

  const renderEditor = () => {
    editorList.replaceChildren();
    blockCount.textContent = `${draft.blocks.length} из ${limits.blocks}`;
    addBlockButton.disabled = draft.blocks.length >= limits.blocks;
    addBlockButton.title = addBlockButton.disabled ? `Можно добавить не более ${limits.blocks} блоков` : "Добавить блок";

    if (!draft.blocks.length) {
      const empty = document.createElement("div");
      empty.className = "dashboard3-empty";
      empty.textContent = "Блоков пока нет. Добавьте блок, чтобы вывести данные в панели.";
      editorList.append(empty);
    }

    draft.blocks.forEach((block, blockIndex) => {
      const article = document.createElement("article");
      article.className = "dashboard3-editor-block";
      article.dataset.blockId = block.id;
      const knownSpace = spaces.some((space) => space.id === block.scope.spaceId);
      const spaceOptions = [
        '<option value="">Выберите пространство</option>',
        block.scope.spaceId && !knownSpace ? `<option value="${escapeHtml(block.scope.spaceId)}" selected>Недоступно · ${escapeHtml(block.scope.spaceId)}</option>` : "",
        ...spaces.map((space) => `<option value="${space.id}"${block.scope.spaceId === space.id ? " selected" : ""}>${escapeHtml(space.name)}</option>`)
      ].join("");
      const valuesHtml = block.values.map((value, index) => {
        const source = sourcePresentation(value.source);
        return `
          <div class="dashboard3-editor-value" data-value-id="${value.id}">
            <span class="dashboard4-drag-handle dashboard4-value-drag" draggable="true" title="Перетащить значение" aria-label="Перетащить значение">⠿</span>
            <span class="dashboard3-order-buttons" role="group" aria-label="Изменить порядок значения ${index + 1}">
              <button class="dashboard3-order-button dashboard3-value-up" type="button" aria-label="Переместить значение ${index + 1} выше" title="Выше"${index === 0 ? " disabled" : ""}>↑</button>
              <button class="dashboard3-order-button dashboard3-value-down" type="button" aria-label="Переместить значение ${index + 1} ниже" title="Ниже"${index === block.values.length - 1 ? " disabled" : ""}>↓</button>
            </span>
            <input class="dashboard3-value-label" type="text" value="${escapeHtml(value.label)}" maxlength="64" placeholder="Название" aria-label="Название значения ${index + 1}">
            <button class="dashboard3-entity-trigger" type="button" aria-label="Выбрать сущность для значения ${index + 1}">
              <span class="dashboard3-entity-trigger__text"><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.detail)}</small></span><b>⌄</b>
            </button>
            <button class="dashboard3-editor-value__remove" type="button" aria-label="Удалить значение ${index + 1}" title="Удалить значение">×</button>
            <small class="dashboard3-editor-value__error" aria-live="polite"></small>
          </div>`;
      }).join("");
      article.innerHTML = `
        <header class="dashboard3-editor-block__header">
          <span class="dashboard4-drag-handle dashboard4-block-drag" draggable="true" title="Перетащить блок" aria-label="Перетащить блок">⠿</span>
          <span class="dashboard3-order-buttons" role="group" aria-label="Изменить порядок блока ${escapeHtml(block.title || blockIndex + 1)}">
            <button class="dashboard3-order-button dashboard3-block-up" type="button" aria-label="Переместить блок выше" title="Выше"${blockIndex === 0 ? " disabled" : ""}>↑</button>
            <button class="dashboard3-order-button dashboard3-block-down" type="button" aria-label="Переместить блок ниже" title="Ниже"${blockIndex === draft.blocks.length - 1 ? " disabled" : ""}>↓</button>
          </span>
          <input class="dashboard3-block-title" type="text" value="${escapeHtml(block.title)}" maxlength="48" placeholder="Название блока" aria-label="Название блока">
          <span class="dashboard4-scope-controls">
            <select class="dashboard3-scope-select dashboard4-scope-type" aria-label="Область отображения блока"><option value="all"${block.scope.type === "all" ? " selected" : ""}>Все пространства</option><option value="space"${block.scope.type === "space" ? " selected" : ""}>Определённое пространство</option></select>
            <select class="dashboard3-scope-select dashboard4-space-select" aria-label="Выберите пространство"${block.scope.type === "all" ? " hidden" : ""}>${spaceOptions}</select>
          </span>
          <button class="dashboard3-visibility${block.visible ? "" : " is-off"}" type="button" aria-pressed="${block.visible}" aria-label="${block.visible ? "Скрыть блок" : "Показать блок"}" title="${block.visible ? "Скрыть блок" : "Показать блок"}"><img src="./svg/${block.visible ? "eye.svg" : "eye-off.svg"}" alt="" aria-hidden="true"></button>
        </header>
        <div class="dashboard3-editor-block__body">
          ${block.scope.type === "space" && block.scope.spaceId && !knownSpace ? '<p class="dashboard4-scope-warning" role="status">Выбранное пространство недоступно. Привязка сохранена и требует внимания.</p>' : ""}
          <div class="dashboard3-editor-values">${valuesHtml || '<div class="dashboard3-empty">В блоке пока нет значений.</div>'}</div>
          <button class="dashboard3-add-value" type="button"${block.values.length >= limits.values ? " disabled" : ""}><img src="./svg/plus.svg" alt="" aria-hidden="true">Добавить значение</button>
          <footer class="dashboard3-editor-block__footer"><button class="dashboard3-delete-block" type="button">Удалить блок</button></footer>
        </div>`;

      const blockTitle = article.querySelector(".dashboard3-block-title");
      const blockDrag = article.querySelector(".dashboard4-block-drag");
      const blockMoveUp = article.querySelector(".dashboard3-block-up");
      const blockMoveDown = article.querySelector(".dashboard3-block-down");
      const visibility = article.querySelector(".dashboard3-visibility");
      const deleteBlock = article.querySelector(".dashboard3-delete-block");
      const scopeSelect = article.querySelector(".dashboard4-scope-type");
      const spaceSelect = article.querySelector(".dashboard4-space-select");
      const addValue = article.querySelector(".dashboard3-add-value");

      blockTitle.addEventListener("input", (event) => {
        block.title = event.target.value;
        updateDialogState();
      });
      blockMoveUp.addEventListener("click", () => {
        if (!moveItemByOffset(draft.blocks, block.id, -1)) return;
        renderEditor();
        restoreOrderFocus(`[data-block-id="${block.id}"] .dashboard3-block-up`);
      });
      blockMoveDown.addEventListener("click", () => {
        if (!moveItemByOffset(draft.blocks, block.id, 1)) return;
        renderEditor();
        restoreOrderFocus(`[data-block-id="${block.id}"] .dashboard3-block-down`);
      });
      visibility.addEventListener("click", () => {
        block.visible = !block.visible;
        renderEditor();
      });
      deleteBlock.addEventListener("click", () => {
        if (block.values.length && !window.confirm(`Удалить блок «${block.title || "Без названия"}» и все его значения?`)) return;
        draft.blocks = draft.blocks.filter((item) => item.id !== block.id);
        closeEntityPicker();
        renderEditor();
      });
      scopeSelect.addEventListener("change", (event) => {
        block.scope.type = event.target.value;
        if (block.scope.type === "all") block.scope.spaceId = null;
        else block.scope.spaceId = null;
        renderEditor();
      });
      spaceSelect.addEventListener("change", (event) => {
        block.scope.spaceId = event.target.value || null;
        renderEditor();
      });
      addValue.addEventListener("click", () => {
        if (block.values.length >= limits.values) return;
        block.values.push({ id: `value-${++valueSequence}`, label: "", source: null });
        renderEditor();
        article.ownerDocument.querySelector(`[data-block-id="${block.id}"] .dashboard3-editor-value:last-of-type .dashboard3-value-label`)?.focus();
      });

      blockDrag.addEventListener("dragstart", (event) => {
        dragContext = { type: "block", id: block.id };
        article.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
      });
      article.addEventListener("dragover", (event) => {
        if (dragContext?.type !== "block" || dragContext.id === block.id) return;
        event.preventDefault();
        article.classList.add("is-drop-target");
      });
      article.addEventListener("dragleave", () => article.classList.remove("is-drop-target"));
      article.addEventListener("drop", (event) => {
        if (dragContext?.type !== "block" || dragContext.id === block.id) return;
        event.preventDefault();
        const rect = article.getBoundingClientRect();
        moveItem(draft.blocks, dragContext.id, block.id, event.clientY > rect.top + rect.height / 2);
        dragContext = null;
        renderEditor();
      });
      blockDrag.addEventListener("dragend", () => {
        dragContext = null;
        editorList.querySelectorAll(".is-dragging, .is-drop-target").forEach((element) => element.classList.remove("is-dragging", "is-drop-target"));
      });

      article.querySelectorAll(".dashboard3-editor-value").forEach((rowElement) => {
        const value = block.values.find((item) => item.id === rowElement.dataset.valueId);
        if (!value) return;
        const labelInput = rowElement.querySelector(".dashboard3-value-label");
        const entityTrigger = rowElement.querySelector(".dashboard3-entity-trigger");
        const removeValue = rowElement.querySelector(".dashboard3-editor-value__remove");
        const valueMoveUp = rowElement.querySelector(".dashboard3-value-up");
        const valueMoveDown = rowElement.querySelector(".dashboard3-value-down");
        const valueDrag = rowElement.querySelector(".dashboard4-value-drag");
        labelInput.addEventListener("input", (event) => {
          value.label = event.target.value;
          updateDialogState();
        });
        entityTrigger.addEventListener("click", () => openEntityPicker(block.id, value.id, entityTrigger));
        valueMoveUp.addEventListener("click", () => {
          if (!moveItemByOffset(block.values, value.id, -1)) return;
          renderEditor();
          restoreOrderFocus(`[data-block-id="${block.id}"] [data-value-id="${value.id}"] .dashboard3-value-up`);
        });
        valueMoveDown.addEventListener("click", () => {
          if (!moveItemByOffset(block.values, value.id, 1)) return;
          renderEditor();
          restoreOrderFocus(`[data-block-id="${block.id}"] [data-value-id="${value.id}"] .dashboard3-value-down`);
        });
        removeValue.addEventListener("click", () => {
          block.values = block.values.filter((item) => item.id !== value.id);
          closeEntityPicker();
          renderEditor();
        });
        valueDrag.addEventListener("dragstart", (event) => {
          dragContext = { type: "value", id: value.id, blockId: block.id };
          rowElement.classList.add("is-dragging");
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
        });
        rowElement.addEventListener("dragover", (event) => {
          if (dragContext?.type !== "value" || dragContext.blockId !== block.id || dragContext.id === value.id) return;
          event.preventDefault();
          event.stopPropagation();
          rowElement.classList.add("is-drop-target");
        });
        rowElement.addEventListener("drop", (event) => {
          if (dragContext?.type !== "value" || dragContext.blockId !== block.id || dragContext.id === value.id) return;
          event.preventDefault();
          event.stopPropagation();
          const rect = rowElement.getBoundingClientRect();
          moveItem(block.values, dragContext.id, value.id, event.clientY > rect.top + rect.height / 2);
          dragContext = null;
          renderEditor();
        });
        valueDrag.addEventListener("dragend", (event) => {
          event.stopPropagation();
          dragContext = null;
          editorList.querySelectorAll(".is-dragging, .is-drop-target").forEach((element) => element.classList.remove("is-dragging", "is-drop-target"));
        });
      });

      editorList.append(article);
    });
    updateDialogState();
  };

  const renderEntityOptions = () => {
    const query = entitySearch.value.trim().toLocaleLowerCase("ru-RU");
    const filtered = entities.filter((entity) => `${entity.name} ${entity.entityId}`.toLocaleLowerCase("ru-RU").includes(query));
    entityList.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "dashboard3-entity-picker__empty";
      empty.textContent = "Сущности не найдены";
      entityList.append(empty);
      return;
    }
    const selected = pickerContext ? findDraftValue(pickerContext.blockId, pickerContext.valueId)?.source?.entityId : null;
    filtered.forEach((entity) => {
      const statusLabel = entity.status === "loading" ? "Загрузка" : entity.status === "stale" ? "Устарело" : entity.status === "unavailable" ? "Недоступно" : "";
      const option = document.createElement("button");
      option.className = `dashboard3-entity-option dashboard4-entity--${entity.status || "ready"}${selected === entity.entityId ? " is-selected" : ""}`;
      option.type = "button";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(selected === entity.entityId));
      option.innerHTML = `<span class="dashboard3-entity-option__name"><strong>${escapeHtml(entity.name)}${entity.template ? " · Template" : ""}</strong><small>${escapeHtml(entity.entityId)}</small></span><span class="dashboard3-entity-option__state">${escapeHtml(entity.state)}${statusLabel ? `<small>${escapeHtml(statusLabel)}</small>` : ""}</span>`;
      option.addEventListener("click", () => {
        if (!pickerContext) return;
        const value = findDraftValue(pickerContext.blockId, pickerContext.valueId);
        if (!value) return;
        value.source = { type: "entity", entityId: entity.entityId };
        closeEntityPicker();
        renderEditor();
      });
      entityList.append(option);
    });
  };

  const positionEntityPicker = (trigger) => {
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 24);
    const estimatedHeight = Math.min(430, window.innerHeight - 24);
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    const below = rect.bottom + 5;
    const top = below + estimatedHeight <= window.innerHeight - 12 ? below : Math.max(12, rect.top - estimatedHeight - 5);
    entityPicker.style.left = `${left}px`;
    entityPicker.style.top = `${top}px`;
  };

  const openEntityPicker = (blockId, valueId, trigger) => {
    pickerContext = { blockId, valueId, trigger };
    entitySearch.value = "";
    entityPicker.hidden = false;
    renderEntityOptions();
    positionEntityPicker(trigger);
    window.requestAnimationFrame(() => entitySearch.focus());
  };

  const closeEntityPicker = () => {
    entityPicker.hidden = true;
    pickerContext = null;
  };

  const openSettings = () => {
    baseline = clone(config);
    draft = clone(config);
    baselineEnabled = globalEnabled;
    draftEnabled = globalEnabled;
    panelTitleInput.value = draft.title;
    showPanelInput.checked = draftEnabled;
    showMobileInput.checked = draft.showOnMobile;
    settingsDialog.hidden = false;
    document.body.classList.add("dashboard3-dialog-open");
    renderEditor();
    window.requestAnimationFrame(() => panelTitleInput.focus());
  };

  const closeSettings = (restore = true) => {
    closeEntityPicker();
    settingsDialog.hidden = true;
    document.body.classList.remove("dashboard3-dialog-open");
    if (restore) {
      draft = null;
      baseline = null;
      draftEnabled = false;
      baselineEnabled = false;
    }
  };

  const saveSettings = () => {
    const errors = validateDraft();
    if (errors.length) {
      updateDialogState();
      editorList.querySelector(".is-invalid")?.focus();
      return;
    }
    config = clone(draft);
    globalEnabled = draftEnabled;
    persist(storageKeys.config, config);
    persist(storageKeys.enabled, String(globalEnabled));
    closeSettings(false);
    draft = null;
    baseline = null;
    draftEnabled = false;
    baselineEnabled = false;
    renderPanel();
  };

  globalToggle.addEventListener("click", () => {
    globalEnabled = !globalEnabled;
    persist(storageKeys.enabled, String(globalEnabled));
    renderGlobalState();
  });
  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    persist(storageKeys.theme, currentTheme);
    applyTheme();
  });
  kioskToggle.addEventListener("click", () => {
    kioskEnabled = !kioskEnabled;
    persist(storageKeys.kiosk, String(kioskEnabled));
    applyKiosk();
  });
  sizeToggle.addEventListener("click", () => {
    sizeDialog.hidden = false;
    document.body.classList.add("dashboard3-dialog-open");
    applyLocalSizes();
    iconSizeInput.focus();
  });
  sizeClose.addEventListener("click", () => {
    sizeDialog.hidden = true;
    document.body.classList.remove("dashboard3-dialog-open");
  });
  sizeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sizeDialog.hidden = true;
    document.body.classList.remove("dashboard3-dialog-open");
  });
  sizeReset.addEventListener("click", () => {
    localSizes = { icons: 100, text: 100 };
    persist(storageKeys.sizes, localSizes);
    applyLocalSizes();
  });
  iconSizeInput.addEventListener("input", (event) => {
    localSizes.icons = Number(event.target.value);
    persist(storageKeys.sizes, localSizes);
    applyLocalSizes();
  });
  textSizeInput.addEventListener("input", (event) => {
    localSizes.text = Number(event.target.value);
    persist(storageKeys.sizes, localSizes);
    applyLocalSizes();
  });
  settingsToggle.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", () => closeSettings());
  settingsCancel.addEventListener("click", () => closeSettings());
  settingsDialog.addEventListener("click", (event) => {
    if (event.target === settingsDialog) closeSettings();
  });
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings();
  });
  panelTitleInput.addEventListener("input", (event) => {
    draft.title = event.target.value;
    updateDialogState();
  });
  showPanelInput.addEventListener("change", (event) => {
    draftEnabled = event.target.checked;
    updateDialogState();
  });
  showMobileInput.addEventListener("change", (event) => {
    draft.showOnMobile = event.target.checked;
    updateDialogState();
  });
  addBlockButton.addEventListener("click", () => {
    if (draft.blocks.length >= limits.blocks) return;
    const usedNumbers = draft.blocks.map((block) => Number(block.title.match(/\d+/)?.[0]) || 0);
    const number = Math.max(0, ...usedNumbers, blockSequence) + 1;
    blockSequence = number;
    draft.blocks.push({
      id: `block-${Date.now()}-${number}`,
      title: `Блок ${number}`,
      visible: true,
      scope: { type: "all", spaceId: null },
      values: [{ id: `value-${++valueSequence}`, label: "", source: null }]
    });
    renderEditor();
    editorList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    editorList.lastElementChild?.querySelector(".dashboard3-block-title")?.focus();
  });
  entitySearch.addEventListener("input", renderEntityOptions);
  document.addEventListener("pointerdown", (event) => {
    if (entityPicker.hidden || entityPicker.contains(event.target) || event.target.closest(".dashboard3-entity-trigger")) return;
    closeEntityPicker();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!entityPicker.hidden) closeEntityPicker();
    else if (!sizeDialog.hidden) {
      sizeDialog.hidden = true;
      document.body.classList.remove("dashboard3-dialog-open");
    }
    else if (!settingsDialog.hidden) closeSettings();
  });
  window.addEventListener("resize", () => {
    if (!entityPicker.hidden && pickerContext?.trigger) positionEntityPicker(pickerContext.trigger);
    positionPanel();
    renderGlobalState();
  });
  spaceTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeSpaceId = tab.dataset.spaceId;
      spaceTabs.forEach((item) => item.classList.toggle("active", item === tab));
      renderPanel();
    });
  });

  applyTheme();
  applyKiosk();
  applyLocalSizes();
  renderPanel();
  positionPanel();
  if (typeof ResizeObserver === "function") new ResizeObserver(positionPanel).observe(dashboardBody);
  window.addEventListener("resize", positionPanel, { passive: true });
  window.setInterval(renderPanel, 60000);
})();

