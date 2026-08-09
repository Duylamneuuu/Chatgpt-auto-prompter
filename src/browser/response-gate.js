export const DEFAULT_RESPONSE_GATE_CONFIG = Object.freeze({
  terminalConfirmCycles: 3,
  minStableMs: 1_200,
});

/**
 * Pure response-completion classifier.
 *
 * The browser driver owns DOM/CDP observation and converts it into a small
 * sample. This classifier owns only the invariant: never call a response done
 * because it was merely quiet for a moment.
 */
export function createResponseGateState(now = Date.now()) {
  return {
    seen: false,
    lastContentKey: "",
    lastChangeAt: now,
    terminalStableCycles: 0,
  };
}

/**
 * @param {ReturnType<typeof createResponseGateState>} state
 * @param {{
 *   now: number,
 *   textLength: number,
 *   contentKey: string,
 *   stopVisible: boolean,
 *   terminalActionVisible: boolean,
 *   strongActivityVisible: boolean
 * }} sample
 * @param {{terminalConfirmCycles?: number, minStableMs?: number}} config
 */
export function classifyResponseTerminal(
  state,
  sample,
  config = DEFAULT_RESPONSE_GATE_CONFIG,
) {
  const terminalConfirmCycles =
    config.terminalConfirmCycles ?? DEFAULT_RESPONSE_GATE_CONFIG.terminalConfirmCycles;
  const minStableMs = config.minStableMs ?? DEFAULT_RESPONSE_GATE_CONFIG.minStableMs;

  const changed = !state.seen || sample.contentKey !== state.lastContentKey;
  const lastChangeAt = changed ? sample.now : state.lastChangeAt;

  // A transient completion bar can appear while the answer is still changing.
  // Reset confirmation on any content rewrite or strong live-work signal.
  const terminalStableCycles =
    sample.terminalActionVisible &&
    !sample.stopVisible &&
    !sample.strongActivityVisible &&
    !changed
      ? state.terminalStableCycles + 1
      : 0;

  const nextState = {
    seen: true,
    lastContentKey: sample.contentKey,
    lastChangeAt,
    terminalStableCycles,
  };

  const stableMs = sample.now - lastChangeAt;
  const terminal =
    sample.textLength > 0 &&
    !sample.stopVisible &&
    !sample.strongActivityVisible &&
    sample.terminalActionVisible &&
    terminalStableCycles >= terminalConfirmCycles &&
    stableMs >= minStableMs;

  return {
    state: nextState,
    terminal,
    evidence: {
      changed,
      stableMs,
      terminalStableCycles,
    },
  };
}
