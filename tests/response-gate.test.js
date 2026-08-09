import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyResponseTerminal,
  createResponseGateState,
} from "../src/browser/response-gate.js";

const config = { terminalConfirmCycles: 2, minStableMs: 100 };

function sample(overrides = {}) {
  return {
    now: 0,
    textLength: 10,
    contentKey: "answer-a",
    stopVisible: false,
    terminalActionVisible: true,
    strongActivityVisible: false,
    ...overrides,
  };
}

test("quiet text alone is never terminal without positive terminal evidence", () => {
  let state = createResponseGateState(0);
  ({ state } = classifyResponseTerminal(state, sample({ now: 0, terminalActionVisible: false }), config));
  const result = classifyResponseTerminal(
    state,
    sample({ now: 500, terminalActionVisible: false }),
    config,
  );
  assert.equal(result.terminal, false);
});

test("transient terminal controls do not finalize changing content", () => {
  let state = createResponseGateState(0);
  ({ state } = classifyResponseTerminal(state, sample({ now: 0, contentKey: "a" }), config));
  ({ state } = classifyResponseTerminal(state, sample({ now: 150, contentKey: "b" }), config));
  const result = classifyResponseTerminal(state, sample({ now: 300, contentKey: "c" }), config);
  assert.equal(result.terminal, false);
  assert.equal(result.evidence.terminalStableCycles, 0);
});

test("equal-length rewrites reset stability because the content key changed", () => {
  let state = createResponseGateState(0);
  ({ state } = classifyResponseTerminal(
    state,
    sample({ now: 0, contentKey: "same-length-A", textLength: 20 }),
    config,
  ));
  const result = classifyResponseTerminal(
    state,
    sample({ now: 200, contentKey: "same-length-B", textLength: 20 }),
    config,
  );
  assert.equal(result.terminal, false);
  assert.equal(result.evidence.changed, true);
});

test("strong live activity vetoes terminal state and resets confirmation", () => {
  let state = createResponseGateState(0);
  ({ state } = classifyResponseTerminal(state, sample({ now: 0 }), config));
  ({ state } = classifyResponseTerminal(state, sample({ now: 120 }), config));
  const result = classifyResponseTerminal(
    state,
    sample({ now: 240, strongActivityVisible: true }),
    config,
  );
  assert.equal(result.terminal, false);
  assert.equal(result.evidence.terminalStableCycles, 0);
});

test("stable content with repeated positive terminal evidence becomes terminal", () => {
  let state = createResponseGateState(0);
  ({ state } = classifyResponseTerminal(state, sample({ now: 0 }), config));
  ({ state } = classifyResponseTerminal(state, sample({ now: 120 }), config));
  const result = classifyResponseTerminal(state, sample({ now: 240 }), config);
  assert.equal(result.terminal, true);
  assert.equal(result.evidence.terminalStableCycles, 2);
  assert.equal(result.evidence.stableMs, 240);
});
