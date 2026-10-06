/**
 * #778: what the Long Task of the interaction profile's resize part is made of.
 *
 * `longTask.editorSeries.maxSingleMs` judges one number per sample. Its resize
 * part is, in every recorded CI sample, the single task of the first accepted
 * pointer move of a Safe Resize drag. This function splits that task into the
 * phases the runner timed inside it, so a failed run explains itself without a
 * new investigation.
 *
 * Input (all times are `performance.now()` milliseconds of one page):
 * - `longTasks`: the entries of the very Long Task window the gate judges
 *   (`{ startTime, duration }`), or `null` when the browser has no Long Tasks;
 * - `spans`: `{ name, startMs, endMs }` recorded by the runner's wrappers —
 *   `move` (ResizeController.move), its callbacks `project`, `publish` and
 *   `labels` (`measure`), `preflight` (`_checkSpacePhysicalGeometry`, nested
 *   in `project` on the live path) and `update` (Lit `performUpdate`);
 * - `frames`: Long Animation Frame entries reduced to `{ startTime, duration,
 *   renderStart, scripts: [{ startTime, duration, forcedStyleAndLayoutDuration }] }`,
 *   or `null` when the browser has no LoAF.
 *
 * The longest task of the window is the one the gate judged. Only spans that
 * lie inside it are attributed to it; a task that holds no resize move reports
 * `geometryMoves: 0` and all of its time as `otherMs` instead of borrowing the
 * move's phases from a neighbouring task. `otherMs` is the task minus every
 * timed phase: the harness's synthetic event dispatch, scheduling and any
 * garbage collection outside the timed calls (a collection that interrupts a
 * timed call stays inside that call's phase). Chromium reports Long Task
 * durations in whole milliseconds, so the parts sum to `longTaskMs` within
 * about one millisecond and `otherMs` may be slightly negative.
 *
 * Self-contained on purpose: the runner injects it with `toString()`.
 */
export function attributeResizeLongTask({ longTasks, spans, frames = null }) {
  const tolerance = 1;
  const round = (value) => Number(value.toFixed(1));
  if (!Array.isArray(longTasks)) return { supported: false, reason: 'no Long Task entries' };
  if (!Array.isArray(spans)) return { supported: false, reason: 'no resize phase spans' };
  const task = longTasks.reduce(
    (longest, entry) => (!longest || entry.duration > longest.duration ? entry : longest), null,
  );
  const empty = {
    supported: true, longTaskMs: 0, geometryMoves: 0,
    preflightMs: null, projectOtherMs: null, publishMs: null, labelsMs: null,
    moveOtherMs: null, updateMs: null, otherMs: null,
    frameRenderMs: null, forcedStyleLayoutMs: null,
  };
  if (!task) return empty;
  const taskEnd = task.startTime + task.duration;
  const inTask = (span) => span.startMs >= task.startTime - tolerance
    && span.endMs <= taskEnd + tolerance;
  const contains = (outer, inner) => inner.startMs >= outer.startMs && inner.endMs <= outer.endMs;
  const own = spans.filter(inTask);
  const named = (name) => own.filter((span) => span.name === name);
  const total = (list) => list.reduce((sum, span) => sum + span.endMs - span.startMs, 0);
  const moves = named('move');
  const projects = named('project');
  const insideMove = (span) => moves.some((move) => contains(move, span));
  const preflights = named('preflight');
  const projectPreflights = preflights.filter((span) => projects.some((project) => contains(project, span)));
  const moveMs = total(moves);
  const projectMs = total(projects);
  const publishMs = total(named('publish'));
  const labelsMs = total(named('labels'));
  // A Lit update is its own microtask after the move; one nested in a move
  // (none today) is already part of that move's time.
  const updateMs = total(named('update').filter((span) => !insideMove(span)));
  // Preflight outside a projection (a commit-time validation) still belongs to
  // the task, but is not double counted with a move that contains it.
  const loosePreflightMs = total(preflights.filter((span) => !insideMove(span)));
  const frame = Array.isArray(frames)
    ? frames.find((entry) => entry.startTime <= task.startTime + tolerance
      && entry.startTime + entry.duration >= taskEnd - tolerance)
    : null;
  const forced = frame
    ? frame.scripts
      .filter((script) => script.startTime >= task.startTime - tolerance
        && script.startTime + script.duration <= taskEnd + tolerance)
      .reduce((sum, script) => sum + (script.forcedStyleAndLayoutDuration || 0), 0)
    : null;
  return {
    ...empty,
    longTaskMs: task.duration,
    geometryMoves: projects.length,
    preflightMs: round(total(projectPreflights) + loosePreflightMs),
    projectOtherMs: round(projectMs - total(projectPreflights)),
    publishMs: round(publishMs),
    labelsMs: round(labelsMs),
    moveOtherMs: round(moveMs - projectMs - publishMs - labelsMs),
    updateMs: round(updateMs),
    otherMs: round(task.duration - moveMs - updateMs - loosePreflightMs),
    frameRenderMs: frame
      ? round(frame.renderStart > 0 ? frame.startTime + frame.duration - frame.renderStart : 0)
      : null,
    forcedStyleLayoutMs: forced == null ? null : round(forced),
  };
}
