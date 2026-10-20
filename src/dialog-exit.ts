export interface DialogExitRun {
  readonly finished: Promise<void>;
  complete(): void;
}
type Schedule = (callback: () => void, delay: number) => () => void;

/** One finite accepted exit. Late animation/timer completions own only their run. */
export class DialogExitController {
  current: DialogExitRun | null = null;
  constructor(private readonly schedule: Schedule = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  }) {}

  begin(deadline: number): DialogExitRun {
    if (this.current) return this.current;
    let resolve!: () => void;
    let cancelTimer = () => {};
    const run: DialogExitRun = {
      finished: new Promise<void>(done => { resolve = done; }),
      complete: () => {
        if (this.current !== run) return;
        this.current = null;
        cancelTimer();
        resolve();
      },
    };
    this.current = run;
    if (deadline <= 0) run.complete();
    else cancelTimer = this.schedule(run.complete, deadline);
    return run;
  }

  cancel(): void { this.current?.complete(); }
}
