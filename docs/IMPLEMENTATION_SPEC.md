# SwitchBot Stream Deck Plugin — Current Implementation Specification

## 1. Scope

The plugin is an advanced-user Stream Deck client for SwitchBot OpenAPI v1.1. It calls only the fixed origin `https://api.switch-bot.com`.

The current plugin exposes two actions:

1. **Get Status**
2. **API Request**

Device and scene discovery are supporting catalog operations exposed through Property Inspector selectors rather than separate Stream Deck actions.

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

An explicit refresh failure MUST be reported to the Property Inspector. The previously saved catalog may still be displayed, but it must not be presented as a successful refresh.

## 6. Get Status

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

## 7. API Request

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

Parameterized device/scene presets use the cached selectors. For `Send device control command`, the physical-device selector is filtered through an explicit allow-list of `deviceType` values that the official SwitchBot API feature matrix documents as supporting Command; read-only/non-command devices and unknown future types are excluded (fail closed). For `Send device control command`, selecting a known physical device type may populate an editable sample request body derived from the official SwitchBot control-command documentation. Unknown device types are not guessed. A user-edited body is not overwritten merely by changing the selected device.

Each preset defines its HTTP method, path, parameter requirement, body policy, localized labels, and optional default request body. Bodyless presets MUST NOT send a request body. Webhook templates follow the documented SwitchBot v1.1 request shapes.

Custom mode supports GET, POST, PUT, and DELETE. Only Custom exposes editable Method and Path. Paths must begin with `/` and cannot resolve away from `https://api.switch-bot.com`. GET/DELETE do not send a body.

Legacy API Request settings without an endpoint normalize to Custom.

## 8. Output and clipboard

`OutputProcessor` is responsible for success/failure feedback and optional clipboard output.

Clipboard writes are abstracted through `ClipboardService`. Windows uses PowerShell with explicit UTF-8 stdin decoding; macOS uses `pbcopy`. Child-process completion is guarded so competing error/close events cannot settle the operation more than once.

Get Status suppresses the normal success overlay when successful; its key title is the primary result display.

## 9. Property Inspector localization

English and Japanese are supported. The locale is taken from Stream Deck registration data. sdpi-components localization attributes are refreshed after the locale is applied.

Temporary diagnostic console logging MUST NOT be shipped in the release PI code.

## 10. Security

- API origin is fixed.
- Credentials exist only in global settings.
- Authentication headers supplied through internal extension points cannot override generated auth.
- Token, Secret, Authorization, and signature values are not logged.
- Transport exception messages are sanitized.
- Source maps are not distributed.
- CI checks distributable contents for credential-like material and unsupported PI API usage.

## 11. Testing and CI

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

Unit coverage includes authentication, path validation, settings normalization, request execution/error classification, catalogs, endpoint resolution/body policy, output, clipboard behavior, localization, security boundaries, global-settings update serialization, and catalog refresh success/failure behavior.

Real Stream Deck UI rendering, real SwitchBot credentials, OS clipboard integration, and hardware behavior remain manual acceptance tests.

## 12. Release readiness

Before removing Draft status:
- CI must pass on the latest PR head.
- Device and Scene selector refresh must be manually tested.
- Preset switching and Custom-only Method/Path visibility must be manually tested.
- Endpoint-specific request-body behavior must be manually tested.
- Japanese PI labels and clipboard output must be manually tested.
- No temporary diagnostics may remain.
