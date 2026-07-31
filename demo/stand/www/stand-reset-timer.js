// Демо-стенд House Plan: таймер до ближайшего сброса — пишет ТОЛЬКО в консоль
// DevTools, никакого UI. Стенд сбрасывается systemd-таймером hp-reset.timer
// ежечасно в :00 (RandomizedDelaySec=0; сам перезапуск занимает ~15 секунд,
// отсюда «~» в сообщении).
(() => {
  "use strict";
  const INFO = "background:#03589c;color:#fff;padding:2px 6px;border-radius:3px";
  const WARN = "background:#b71c1c;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold";

  const tick = () => {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(60, 0, 0); // ближайший :00
    const left = Math.max(1, Math.ceil((next - now) / 60000));
    if (left <= 5) {
      console.warn(
        `%c[демо-стенд] до сброса ~${left} мин — несохранённые эксперименты пропадут (сброс ежечасно в :00)`,
        WARN
      );
    } else {
      console.info(`%c[демо-стенд] до сброса ~${left} мин (сброс ежечасно в :00)`, INFO);
    }
  };

  tick();
  // выравниваемся по границе минуты, дальше — раз в минуту
  setTimeout(() => {
    tick();
    setInterval(tick, 60000);
  }, (60 - new Date().getSeconds()) * 1000);
})();
