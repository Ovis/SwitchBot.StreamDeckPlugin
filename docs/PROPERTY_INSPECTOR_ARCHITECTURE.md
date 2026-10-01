# Property Inspector Architecture — v1.1

## 1. Purpose

v1.0.1 is the baseline release before this refactoring. Starting with v1.1.0, Property Inspectors use a documented common architecture so action-specific UI differences do not create different persistence and lifecycle rules.

This document defines the target architecture and migration plan. It does not require every action to share the same UI.

## 2. Problem statement

During v1.0.x development, Property Inspectors evolved independently. In particular, action settings could be written through both:

1. SDPI Components `setting="..."` automatic persistence; and
2. explicit `getSettings() -> mutate -> setSettings()` code.

Because `setSettings()` replaces the action settings snapshot rather than applying an atomic field patch, independent writers can produce lost updates.

The Infrared Remote operation-loss defect demonstrated this failure mode: the explicitly saved operation was later overwritten by automatic saves from SDPI Components using an older settings snapshot.

A Promise queue only serializes writers that pass through that queue. It cannot serialize SDPI Components' internal automatic persistence.

## 3. Architecture principles

### 3.1 One persistence mode per Property Inspector

Every PI MUST declare one of two persistence modes.

#### Simple mode

Use when the PI is a conventional form without cross-field atomic updates.

- SDPI Components `setting=` is the settings writer.
- Direct `setSettings()` is prohibited.
- The managed Settings Store is prohibited.
- Programmatic changes to a `setting=` component intentionally use the SDPI Components persistence lifecycle.

API Request is the initial Simple-mode PI.

#### Managed mode

Use when settings have dependent fields, dynamic controls, normalization, migrations, or atomic multi-field updates.

- A common Property Inspector Settings Store is the only action-settings writer.
- `setting=` and `label-setting=` are prohibited in the PI HTML.
- Direct `streamDeckClient.setSettings()` calls outside the store are prohibited.
- Programmatic UI updates never imply persistence.
- Event handlers persist through the store, then render from the resulting state.

Physical Control, Infrared Remote, and Get Status are the target Managed-mode PIs.

### 3.2 UI state and persisted state are separate

Assigning `.value` is a rendering operation in Managed mode. It MUST NOT be relied on to persist settings.

Persistence is explicit:

```ts
await settings.update(current => {
  current.operationId = selectedOperation;
});
```

Rendering is separate:

```ts
operation.value = state.operationId;
```

### 3.3 Action-specific controllers remain action-specific

The common architecture does not abstract domain behavior that differs naturally between actions.

Examples retained in action-specific controllers:

- Physical Control: Device -> Operation -> Parameters.
- Infrared Remote: Remote -> Operation -> Custom/Channel/AC -> Override.
- Get Status: Device -> Status -> Observed Fields -> Template.
- API Request: Endpoint -> Device/Scene -> Request Body.

The shared layer standardizes state ownership, persistence, initialization, and communication boundaries.

## 4. Managed Settings Store

v1.1 introduces a common Property Inspector Settings Store to replace `createSettingsPatchQueue()` as the primary managed-settings abstraction.

Target responsibilities:

- load the current action settings;
- unwrap SDK/test `{ settings: ... }` envelopes consistently;
- normalize settings through an action-provided normalizer;
- serialize all managed writes;
- expose a current normalized state after initialization;
- perform explicit updates through one writer;
- support an explicit reload when external/plugin-side changes must be observed;
- isolate direct `getSettings()/setSettings()` calls from action controllers.

Illustrative API:

```ts
const settings = createPropertyInspectorSettingsStore(
  streamDeckClient,
  normalizeSettings
);

await settings.initialize();

const current = settings.current;

await settings.update(state => {
  state.operationId = "turnOn";
});

await settings.reload();
```

The exact API may be adjusted during implementation, but the single-writer invariant is mandatory.

## 5. Initialization lifecycle

Managed PIs should converge on the following lifecycle:

```text
DOMContentLoaded
  -> initialize Settings Store
  -> load/normalize persisted settings
  -> initialize action-specific catalog/data
  -> render persisted state
  -> attach/enable user-driven updates
```

Asynchronous catalog responses may update available options, but they must not silently replace persisted selections with fallback values.

Programmatic rendering that triggers SDPI `valuechange` events must be guarded so initialization does not become a user settings write.

## 6. Plugin communication

The plugin-side stale-response protection introduced before v1.1 remains the baseline:

- source action instance is identified through the SDK event's `ev.action.id`;
- a PI response is sent only while that action is the current PI;
- asynchronous responses for an old action are discarded.

Catalog/message abstractions may be added later, but v1.1 Settings Store work should not require a large catalog-protocol rewrite.

## 7. Current PI classification

| Property Inspector | v1.1 mode | Notes |
| --- | --- | --- |
| API Request | Simple | Already predominantly uses SDPI Components automatic persistence. No explicit action `setSettings()` writer. |
| Physical Control | Managed | Device, Operation and Parameters are already explicitly managed. `skipUnlockConfirmation` remains to migrate. |
| Infrared Remote | Managed | v1.0.1 fixed the Operation/Override lost-update race by removing automatic persistence from that coupled settings region. Remaining automatic fields should migrate to the common store. |
| Get Status | Managed | Currently mixes automatic `output.*` persistence with explicit `output.statusTemplate` updates and is the highest remaining mixed-writer risk. |

Authentication is excluded from this classification because credentials are plugin-global settings and writes already flow through the plugin's `GlobalSettingsStore`.

## 8. Guardrails

v1.1 should add CI/static checks for the architecture.

At minimum:

1. Managed PI HTML MUST NOT contain `setting=` or `label-setting=`.
2. Managed PI controller code MUST NOT call `streamDeckClient.setSettings()` directly.
3. Simple PI controller code MUST NOT create/use the Managed Settings Store.
4. Temporary diagnostic logging MUST NOT ship.
5. Direct action-settings writers should be confined to the common Settings Store.

These checks are architecture guards, not substitutes for runtime tests.

## 9. Testing strategy

### Settings Store unit tests

Cover:

- initialization and envelope unwrapping;
- normalization;
- serialized concurrent updates;
- updates based on the latest committed state;
- failed write recovery without permanently blocking the queue;
- reload behavior;
- no mutation leakage between caller and stored state where applicable.

### PI architecture tests

Statically verify Simple/Managed mode restrictions.

### Manual acceptance

For each migrated Managed PI:

- create a new action;
- configure dependent fields;
- switch to another action and return;
- confirm settings restore;
- restart Stream Deck and confirm restore;
- change parent fields and verify dependent-field reset behavior;
- exercise the real key action.

## 10. v1.1 migration plan

### PR 1 — Common Settings Store and architecture guards

- add this architecture contract;
- implement the common Settings Store;
- add unit tests;
- add Simple/Managed architecture checks;
- document the stronger limitations of the legacy `createSettingsPatchQueue()`.

No action should be broadly refactored in this PR.

### PR 2 — Physical Control migration

- migrate `skipUnlockConfirmation` to the Managed writer;
- use the common Settings Store for existing Device/Operation/Parameter updates;
- remove all action-settings `setting=` usage from Physical Control;
- run regression/manual tests across shared Physical Control categories.

### PR 3 — Infrared Remote migration

- migrate remaining action-setting automatic fields to the common store;
- preserve the v1.0.1 Operation/Override race fix;
- make all Infrared Remote action settings single-writer.

### PR 4 — Get Status migration

- migrate all action settings, including `output.*`, to the common store;
- preserve custom template/caret behavior;
- remove mixed automatic/explicit persistence.

### PR 5 — API Request evaluation

- keep Simple mode if no explicit managed writes are required;
- add only guard/test changes needed to enforce Simple mode;
- do not refactor it merely for visual symmetry.

## 11. Release scope

v1.0.1 is the released baseline containing the Infrared Remote race fix and the preceding stability fixes.

The architecture work described here targets **v1.1.0** because it intentionally changes the internal Property Inspector state-management architecture across multiple actions.

The migration should remain behavior-preserving from a user's perspective except where it fixes settings persistence races or initialization inconsistencies.
