# SwitchBot Stream Deck Plugin — Current Implementation Specification

## 1. Scope

The plugin is an advanced-user Stream Deck client for SwitchBot OpenAPI v1.1. It calls only the fixed origin `https://api.switch-bot.com`.

The current plugin exposes ten actions:

1. **Bot**
2. **Power**
3. **Lighting**
4. **Climate**
5. **Security**
6. **Curtains & Blinds**
7. **Cleaning**
8. **Infrared Remote**
9. **Get Status**
10. **API Request**

The first seven actions share the Physical Control architecture. Device and scene discovery remain supporting catalog operations exposed through Property Inspector selectors rather than separate Stream Deck actions.

## 2. Platform

- TypeScript
- Node.js 24
- `@elgato/streamdeck` 3.x
- Stream Deck 7.1+
- SwitchBot OpenAPI v1.1
- npm
- Vitest
- Zod
- MIT

## 3. Authentication and global settings

Token and Secret are stored only in Stream Deck plugin-global settings. Action settings never contain credentials.

All plugin-side global-setting mutations MUST pass through one `GlobalSettingsStore`. Its read-modify-write operations are serialized so concurrent credential, device-catalog, and scene-catalog updates do not overwrite unrelated fields.

Property Inspectors may read global settings to populate password controls, but credential writes are sent to the plugin and persisted through `GlobalSettingsStore`.

Test Connection persists the supplied credentials and executes `GET /v1.1/devices` through the normal request stack.

## 4. Request architecture

```text
Action
  -> RequestExecutor
  -> SwitchBotClient
  -> SwitchBot OpenAPI
  -> ExecutionResult
  -> OutputProcessor
```

Actions MUST NOT implement HTTP transport or signing directly.

`SwitchBotAuth` creates the v1.1 authentication headers using timestamp, nonce, and HMAC-SHA256.

`SwitchBotClient`:
- accepts only validated paths on the fixed SwitchBot origin;
- replaces any caller-supplied authentication headers;
- uses a 10-second timeout;
- parses JSON when possible while retaining the raw body.

`RequestExecutor` classifies configuration, authentication, network, HTTP, SwitchBot-level, response, and internal failures.

A request succeeds only for HTTP success plus a valid SwitchBot envelope with `statusCode === 100`.

## 5. Catalogs

Device and scene catalogs are cached in global settings.

Each entry records `lastSeenAt` and `deleted`. Refresh performs logical deletion:
- present entries become active and receive the latest timestamp;
- missing entries remain in the catalog with `deleted: true`;
- reappearing entries become active again.

Selectors normally hide deleted entries but retain a deleted entry when it is the action's current selection.

An explicit refresh failure MUST be reported to the Property Inspector. The previously saved catalog may still be displayed, but it must not be presented as a successful refresh. HTTP 429 is reported as an API usage limit instead of the generic refresh failure.

## 6. Physical Control

Bot, Power, Lighting, Climate, Security, Curtains & Blinds, and Cleaning use one shared Physical Control implementation.

The Physical Device Catalog is the canonical source for supported `deviceType` values, operations, localized labels, parameter constraints, confirmation requirements, and command wire shapes. Category action classes contain only their UUID/action identity and do not duplicate model-specific command logic.

The API Request Control Commands capability list is derived from the same Physical Device Catalog. Devices intentionally kept outside Physical Control, such as passcode/special-purpose command devices, are maintained only as an explicit API Request-only supplement.

Physical Control:
- filters the cached device catalog by action category and exact documented `deviceType`;
- fails closed for unknown, deleted, mismatched, or unsupported devices and operations;
- preserves invalid saved values until the user explicitly corrects them rather than silently selecting another command;
- validates number, RGB, and select parameters before request construction;
- preserves JSON object parameters as objects on the HTTP wire;
- uses the same command builder for Property Inspector preview and actual execution;
- persists Property Inspector settings through the shared Managed Settings Store so stale updates cannot overwrite newer user input;
- queues key presses per action instance with a bounded FIFO;
- requires a second key press for operations marked as requiring confirmation.

Only the normal `unlock` operation may opt out of the second-press confirmation. Other sensitive operations such as deadbolt/latch and garage-door opening retain mandatory confirmation.

## 7. Infrared Remote

Infrared Remote selects virtual infrared devices from the cached catalog and maps their supported operations to documented SwitchBot infrared command bodies. Advanced overrides remain available for commands that require manual control.

## 8. Get Status

Settings:
- selected device ID;
- plugin-owned button name;
- show result on button, default ON;
- copy response JSON, default OFF;
- pretty print, default ON.

Execution:
- requires a selected device;
- calls `GET /v1.1/devices/{deviceId}/status`;
- safely URL-encodes the device ID;
- optionally copies the response;
- optionally displays a compact localized status on the key for 15 seconds;
- restores the configured button name afterward;
- API/output failures produce Stream Deck failure feedback.

The temporary-title timer is cleared when settings change, the action disappears, or a new temporary title replaces it. Asynchronous title restoration failures are caught and sanitized.

## 9. API Request

API Request supports centrally defined presets plus Custom.

Preset definitions live only in `src/api/api-endpoints.ts`. The Property Inspector obtains labels and endpoint metadata from the plugin datasource; HTML MUST NOT duplicate the method/path preset table.

Current presets:
- Get device list
- Get device status
- Send device control command
- Get scene list
- Execute manual scene
- Configure webhook
- Query webhook configuration
- Update webhook configuration
- Delete webhook

Parameterized device/scene presets use the cached selectors. For `Send device control command`, the physical-device selector is filtered through the shared Control Commands capability catalog derived from Physical Control plus an explicit API Request-only supplement; read-only/non-command devices and unknown future types are excluded (fail closed). For `Send device control command`, selecting a known physical device type may populate an editable sample request body derived from the official SwitchBot control-command documentation. Unknown device types are not guessed. A user-edited body is not overwritten merely by changing the selected device.

Each preset defines its HTTP method, path, parameter requirement, body policy, localized labels, and optional default request body. Bodyless presets MUST NOT send a request body. Webhook templates follow the documented SwitchBot v1.1 request shapes.

Custom mode supports GET, POST, PUT, and DELETE. Only Custom exposes editable Method and Path. Paths must begin with `/` and cannot resolve away from `https://api.switch-bot.com`. GET/DELETE do not send a body.

Legacy API Request settings without an endpoint normalize to Custom.

## 10. Output and clipboard

`OutputProcessor` is responsible for success/failure feedback and optional clipboard output.

Clipboard writes are abstracted through `ClipboardService`. Windows uses PowerShell with explicit UTF-8 stdin decoding; macOS uses `pbcopy`. Child-process completion is guarded so competing error/close events cannot settle the operation more than once.

Get Status suppresses the normal success overlay when successful; its key title is the primary result display.

## 11. Property Inspector localization

English and Japanese are supported. The locale is taken from Stream Deck registration data. sdpi-components localization attributes are refreshed after the locale is applied.

Temporary diagnostic console logging MUST NOT be shipped in the release PI code.

Physical Control, Infrared Remote, and Get Status use the shared Managed Settings Store as their only Property Inspector-side Action settings writer. Opening or rendering one of these Property Inspectors loads and normalizes settings without saving them. Only explicit user operations call `setSettings`, and those updates are serialized against the latest confirmed Store state. Programmatic UI rendering is suppressed from persistence.

For `sdpi-select` elements that use `datasource`, option rendering and refresh state remain owned by SDPI Components. Managed Property Inspector code may restore the selected value, but MUST NOT mutate the element's light-DOM options because that mutation triggers another datasource refresh.

API Request remains in Simple Mode and uses only the SDPI Components `setting` lifecycle. A Property Inspector MUST NOT mix Simple Mode automatic persistence with Managed Settings Store persistence.

## 12. Security

- API origin is fixed.
- Credentials exist only in global settings.
- Authentication headers supplied through internal extension points cannot override generated auth.
- Token, Secret, Authorization, and signature values are not logged.
- Transport exception messages are sanitized.
- Source maps are not distributed.
- CI checks distributable contents for credential-like material and unsupported PI API usage.

## 13. Testing and CI

CI runs:
1. `npm ci`
2. TypeScript type check
3. Property Inspector JavaScript syntax checks
4. Vitest
5. release-version mapping tests
6. production build
7. distributable security inspection
8. Stream Deck validation
9. package dry-run

Unit coverage includes authentication, path validation, settings normalization, Managed Settings Store serialization and failure recovery, Property Inspector persistence architecture guards, request execution/error classification, catalogs, endpoint resolution/body policy, output, clipboard behavior, localization, security boundaries, global-settings update serialization, and catalog refresh success/failure behavior.

Real Stream Deck UI rendering, real SwitchBot credentials, OS clipboard integration, and hardware behavior remain manual acceptance tests.

## 14. Release readiness

Before removing Draft status:
- CI must pass on the latest PR head.
- Device and Scene selector refresh must be manually tested.
- Preset switching and Custom-only Method/Path visibility must be manually tested.
- Endpoint-specific request-body behavior must be manually tested.
- Japanese PI labels and clipboard output must be manually tested.
- No temporary diagnostics may remain.
