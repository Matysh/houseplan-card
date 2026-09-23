export interface ConfigConflictEditorRuntime {
  _cancelPath(): void;
}

/**
 * Drop an editor-only draft when one exists, then refresh the authoritative
 * config. View deliberately has no editor runtime, but it can still own
 * background config writes and therefore must recover from their conflicts.
 */
export function recoverConfigWriteConflict(
  editorRuntime: ConfigConflictEditorRuntime | null,
  reload: () => void | Promise<void>,
): void {
  editorRuntime?._cancelPath();
  void reload();
}
