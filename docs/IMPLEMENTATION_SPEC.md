# SwitchBot Stream Deck Plugin — Implementation Specification

## 1. Purpose

This document defines the implementation contract for the first version of `SwitchBot.StreamDeckPlugin`.

The plugin is an advanced-user-oriented Stream Deck client for SwitchBot OpenAPI v1.1. It calls the SwitchBot API directly and has no dependency on HomeDeviceGateway or any other gateway service.

The initial release intentionally provides a small generic API surface while keeping the architecture ready for future response binding, state binding, polling, request coalescing, and caching.

## 2. Platform and baseline

- TypeScript
- Node.js 24
- `@elgato/streamdeck` 3.x
- Stream Deck 7.1 or later
- SwitchBot OpenAPI v1.1
- SwitchBot API base URL is fixed to `https://api.switch-bot.com`
- Package manager: npm
- Unit test framework: Vitest
- Runtime settings validation: Zod
- License: MIT

The project SHALL follow the current Elgato Stream Deck Node.js plugin layout generated/recommended by the current Stream Deck tooling where practical.

## 3. Scope

### 3.1 v1 actions

The plugin SHALL expose three actions:

1. **Get Devices**
   - Calls `GET /v1.1/devices`.
   - Copies the complete API response JSON to the clipboard.
   - Pretty-prints JSON.
   - Requires no action-specific settings.

2. **Get Status**
   - Calls `GET /v1.1/devices/{deviceId}/status`.
   - Device ID is configured in the Property Inspector.
   - Copies the complete API response to the clipboard.
   - Pretty-printing is configurable and defaults to enabled.

3. **API Request**
   - Calls an arbitrary path on the fixed SwitchBot API host.
   - Supports `GET`, `POST`, `PUT`, and `DELETE`.
   - Path is manually entered.
   - Request body is manually entered as JSON for methods that support a body.
   - Response clipboard copying is optional and defaults to disabled.
   - Pretty-printing is configurable and defaults to enabled.

### 3.2 Explicitly out of scope for v1

- Device-specific command editors
- Device discovery dropdowns
- Response Binding
- State Binding
- Periodic polling
- Request coalescing
- Response cache
- Webhooks
- HomeDeviceGateway integration
- Arbitrary API hosts
- Arbitrary authentication headers

These are not prohibited future features. The architecture SHALL preserve extension points for them.

## 4. Architectural rules

The primary dependency flow SHALL be:

```text
Stream Deck Action
      |
      v
RequestExecutor
      |
      v
SwitchBotClient
      |
      v
SwitchBot OpenAPI
      |
      v
ExecutionResult
      |
      v
OutputProcessor
      +--> ClipboardOutput
      +--> StreamDeckFeedback
```

Rules:

1. Action classes MUST NOT call `fetch` directly.
2. Action classes MUST NOT implement SwitchBot signing.
3. `SwitchBotClient` MUST NOT depend on Stream Deck action/context APIs.
4. `SwitchBotAuth` MUST NOT perform HTTP I/O.
5. HTTP/API results MUST be normalized into `ExecutionResult` before output handling.
6. Clipboard handling MUST be abstracted behind a service.
7. Token, secret, Authorization header, and generated signature MUST NOT be logged.
8. User-supplied paths MUST NOT be allowed to select another host.
9. Persisted settings MUST be versioned and runtime-validated.
10. Future response processing MUST consume `ExecutionResult`; it MUST NOT be added to the HTTP client.

## 5. Suggested source layout

```text
src/
├── plugin.ts
├── actions/
│   ├── get-devices-action.ts
│   ├── get-status-action.ts
│   └── api-request-action.ts
├── api/
│   ├── switchbot-auth.ts
│   ├── switchbot-client.ts
│   ├── switchbot-request.ts
│   ├── switchbot-response.ts
│   └── switchbot-error.ts
├── execution/
│   ├── execution-request.ts
│   ├── execution-result.ts
│   └── request-executor.ts
├── output/
│   ├── output-processor.ts
│   ├── clipboard-output.ts
│   └── streamdeck-feedback.ts
├── settings/
│   ├── global-settings.ts
│   ├── api-request-settings.ts
│   ├── get-status-settings.ts
│   └── settings-migrator.ts
├── services/
│   └── clipboard-service.ts
└── utils/
    ├── json.ts
    ├── validation.ts
    └── logger.ts
```

The exact generated plugin-directory name may follow Elgato tooling conventions.

## 6. Core domain interfaces

### 6.1 Credentials

```ts
export interface SwitchBotCredentials {
  token: string;
  secret: string;
}
```

Both values are required to execute an authenticated request.

### 6.2 HTTP method

```ts
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
```

### 6.3 ExecutionRequest

```ts
export interface ExecutionRequest {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}
```

The `headers` member exists as an internal extension point. v1 Property Inspectors SHALL NOT expose arbitrary header editing.

### 6.4 ExecutionResult

```ts
export type ExecutionErrorCategory =
  | "configuration"
  | "authentication"
  | "network"
  | "http"
  | "switchbot"
  | "response"
  | "internal";

export interface ExecutionResult {
  success: boolean;
  request: {
    method: HttpMethod;
    path: string;
  };
  response?: {
    httpStatus: number;
    headers: Record<string, string>;
    body: unknown;
    rawBody: string;
    switchBot?: {
      statusCode?: number;
      message?: string;
    };
  };
  error?: {
    category: ExecutionErrorCategory;
    message: string;
  };
  executedAt: string;
}
```

Unknown SwitchBot status codes MUST remain representable. Do not model SwitchBot status codes as a closed enum.

## 7. Class responsibilities

### 7.1 `SwitchBotAuth`

**Responsibility**

Generate SwitchBot OpenAPI v1.1 authentication headers.

**Interface**

```ts
export interface SwitchBotAuthHeaders {
  Authorization: string;
  sign: string;
  t: string;
  nonce: string;
}

export class SwitchBotAuth {
  createHeaders(credentials: SwitchBotCredentials): SwitchBotAuthHeaders;
}
```

**Behavior**

For each request:

1. Generate current Unix time in milliseconds as a decimal string `t`.
2. Generate a unique nonce.
3. Build signing input as `token + t + nonce`.
4. Calculate HMAC-SHA256 using `secret` as key.
5. Base64-encode the digest.
6. Return the four required authentication headers.

Use Node.js built-in cryptographic APIs. Do not add a cryptography dependency solely for signing.

**Acceptance criteria**

- Signature output matches deterministic test vectors when timestamp and nonce are injected/fixed in tests.
- No credential is written to logs.
- A new nonce is generated for normal production calls.

### 7.2 `SwitchBotClient`

**Responsibility**

Perform HTTP requests against the fixed SwitchBot API origin.

**Conceptual interface**

```ts
export class SwitchBotClient {
  request(
    request: ExecutionRequest,
    credentials: SwitchBotCredentials,
  ): Promise<SwitchBotRawResponse>;
}
```

**Rules**

- Base URL is constant: `https://api.switch-bot.com`.
- Only validated relative API paths are accepted.
- Authentication headers are generated for every request.
- JSON request bodies use `Content-Type: application/json`.
- The client returns HTTP status, response headers, raw response body, and parsed JSON where possible.
- It does not call Stream Deck APIs.
- It does not copy data to the clipboard.

### 7.3 `RequestExecutor`

**Responsibility**

Validate configuration, invoke `SwitchBotClient`, classify errors, and normalize all outcomes into `ExecutionResult`.

**Conceptual interface**

```ts
export class RequestExecutor {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
```

Credentials SHALL be obtained through an injected settings/credential provider rather than copied into action settings.

**Success semantics**

A request is successful only when:

- network request completes;
- HTTP status is successful;
- response is parseable as expected for a SwitchBot JSON response; and
- SwitchBot `statusCode === 100`.

**Error categories**

- `configuration`: missing credentials, invalid method/path/body
- `authentication`: authentication rejection, including HTTP 401 where applicable
- `network`: DNS, connection, timeout, transport failure
- `http`: non-success HTTP response not classified as authentication
- `switchbot`: SwitchBot response with `statusCode !== 100`
- `response`: invalid/unexpected response representation
- `internal`: uncategorized programming/runtime error

### 7.4 `OutputProcessor`

**Responsibility**

Apply configured outputs to an `ExecutionResult`.

**Conceptual interface**

```ts
export interface OutputContext {
  action: {
    showOk(): Promise<void>;
    showAlert(): Promise<void>;
  };
}

export class OutputProcessor {
  process(
    result: ExecutionResult,
    options: OutputOptions,
    context: OutputContext,
  ): Promise<void>;
}
```

The implementation may adapt the exact Stream Deck SDK action types rather than introducing this literal interface, provided the architectural boundary remains intact.

Future `ResponseBindingOutput` and `StateBindingOutput` SHALL plug in after `ExecutionResult`.

### 7.5 `ClipboardService`

**Responsibility**

Write text to the operating-system clipboard without leaking platform-specific implementation into actions.

```ts
export interface ClipboardService {
  writeText(value: string): Promise<void>;
}
```

The implementation SHALL support the operating systems declared in the plugin manifest. Clipboard failures SHALL result in failure feedback and sanitized logging.

### 7.6 `ClipboardOutput`

**Responsibility**

Select raw vs pretty JSON representation and write it through `ClipboardService`.

Rules:

- If pretty-print is enabled and the body is valid JSON, use two-space JSON indentation.
- If parsing/serialization is not applicable, preserve `rawBody`.
- Get Devices always copies and pretty-prints.
- Get Status always copies; pretty-print is configurable.
- API Request copies only when configured.

### 7.7 `StreamDeckFeedback`

**Responsibility**

Provide transient key feedback.

- Successful action: `showOk()`
- Failed action: `showAlert()`

Detailed errors SHALL NOT be rendered into the key title in v1.

### 7.8 `SettingsMigrator`

**Responsibility**

Convert persisted settings from supported older schemas to the current schema and apply defaults.

All action code SHALL consume normalized current-version settings, not arbitrary raw persisted objects.

Initial migration is effectively normalization into version 1, but the abstraction SHALL exist from the initial implementation.

### 7.9 `SanitizedLogger`

A utility/wrapper SHALL ensure logs never contain:

- SwitchBot token
- SwitchBot secret
- `Authorization` value
- generated `sign`

Request bodies SHALL not be logged in full at normal production log levels.

Useful fields include method, path, HTTP status, SwitchBot status code, error category, and elapsed time.

## 8. Settings schemas

Runtime validation SHALL be performed with Zod or an equivalent schema validator. TypeScript types alone are insufficient for persisted external data.

### 8.1 Global settings v1

```ts
export interface GlobalSettingsV1 {
  version: 1;
  credentials?: {
    token?: string;
    secret?: string;
  };
}
```

Credentials SHALL exist only in plugin-global settings, never action settings.

The Property Inspector SHALL render token and secret using password-style inputs.

### 8.2 API Request settings v1

```ts
export interface ApiRequestSettingsV1 {
  version: 1;
  method: HttpMethod;
  path: string;
  body?: string;
  output: {
    copyResponseToClipboard: boolean;
    prettyPrint: boolean;
  };
}
```

Defaults:

- method: `POST`
- path: empty
- body:

```json
{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}
```

- copy response: false
- pretty print: true

### 8.3 Get Status settings v1

```ts
export interface GetStatusSettingsV1 {
  version: 1;
  deviceId: string;
  output: {
    prettyPrint: boolean;
  };
}
```

Defaults:

- deviceId: empty
- pretty print: true

Get Devices requires no persisted action-specific configuration.

## 9. Path and request validation

A path is valid only when:

- it begins with `/`;
- it is relative to the fixed SwitchBot host;
- it does not contain a URL scheme such as `http://` or `https://`;
- URL resolution cannot change the origin away from `https://api.switch-bot.com`.

Validation MUST be performed in the plugin immediately before execution even if the Property Inspector already validated the input.

For POST/PUT:

- empty body is permitted only if the requested API operation permits it;
- non-empty body MUST be valid JSON.

For GET/DELETE in v1:

- body input SHALL be disabled/hidden in the Property Inspector;
- execution SHALL not send a body.

## 10. Property Inspector specification

Use locally packaged Stream Deck Property Inspector components where appropriate; do not require a CDN at runtime.

### 10.1 Authentication UI

The plugin SHALL provide access to global authentication settings from relevant Property Inspectors.

Fields:

- Token — password input
- Secret — password input
- Test Connection button
- connection result/status area

Test Connection:

1. Property Inspector sends a plugin message.
2. Plugin performs `GET /v1.1/devices` through the normal executor/client stack.
3. Plugin returns a sanitized success/error result to the Property Inspector.
4. UI displays a concise result.
5. Credentials are never echoed back in result messages.

### 10.2 Get Devices PI

No action-specific fields are required. Authentication configuration/help may be shown.

### 10.3 Get Status PI

Fields:

- Device ID — required text
- Pretty-print JSON — checkbox, default true

Validation feedback SHALL be shown for missing Device ID.

### 10.4 API Request PI

Fields:

- Method — GET/POST/PUT/DELETE
- Path — required text
- Request Body — multiline JSON editor/textarea for POST/PUT
- JSON validity indicator
- Copy response to clipboard — checkbox
- Pretty-print JSON — checkbox

Behavior:

- GET/DELETE hides or disables body.
- POST/PUT shows body.
- Invalid JSON is clearly indicated before execution.
- Settings are persisted using Stream Deck action settings.

## 11. Action behavior

### 11.1 GetDevicesAction

On key down:

1. Execute `GET /v1.1/devices`.
2. On API success, copy the complete SwitchBot response JSON, pretty-printed, to clipboard.
3. Show OK only after clipboard write succeeds.
4. On any failure, log sanitized details and show alert.

### 11.2 GetStatusAction

On key down:

1. Load and normalize settings.
2. Reject empty Device ID as configuration error.
3. Safely encode/interpolate Device ID into `/v1.1/devices/{deviceId}/status`.
4. Execute GET.
5. Copy complete response to clipboard using configured pretty-print setting.
6. Show OK only after output processing succeeds.
7. Otherwise show alert.

### 11.3 ApiRequestAction

On key down:

1. Load and normalize settings.
2. Validate method, path, and body.
3. Build `ExecutionRequest`.
4. Execute through `RequestExecutor`.
5. If configured, copy response.
6. Show OK for successful completion; otherwise alert.

## 12. SwitchBot response handling

SwitchBot API-level status is distinct from HTTP status.

A typical success has:

```json
{
  "statusCode": 100,
  "body": {},
  "message": "success"
}
```

Rules:

- `statusCode === 100` is API success.
- Any other numeric status code is an API failure.
- Unknown future status codes MUST be preserved rather than rejected during parsing.
- `message` SHOULD be retained in `ExecutionResult`.
- The complete response remains available for clipboard and future binding.

## 13. Security requirements

1. API origin is fixed and cannot be changed by action settings.
2. Token and secret are stored only in global settings.
3. Token/secret/sign/Authorization are excluded from logs and errors.
4. Credentials are never copied to clipboard by plugin features.
5. Property Inspector displays credentials as password fields.
6. Runtime path validation prevents credential-bearing requests from being redirected to another origin.
7. Error objects sent to Property Inspector are sanitized.
8. Unit tests SHALL include credential-leak regression checks for logger/error formatting where practical.

Global settings are treated as the Stream Deck-supported location for plugin-wide API credentials, but not as an OS credential vault. Documentation SHALL not claim otherwise.

## 14. Future extension boundaries

### 14.1 Response Binding

Future flow:

```text
ExecutionResult
      |
      v
ResponseBindingOutput
      |
      +--> JsonSelector
      +--> Formatter
      +--> action.setTitle(...)
```

No changes to `SwitchBotClient` should be required.

Potential future settings:

- selector / JSONPath-like expression
- format string
- target: title

Do not commit to a specific JSONPath library in v1.

### 14.2 State Binding

Future flow:

```text
ExecutionResult -> StateBindingOutput -> Matcher -> action.setState(...)
```

State Binding is separate from Response Binding because Stream Deck states must be compatible with states defined by the action manifest.

### 14.3 Polling

Polling MUST NOT be implemented independently per key.

Future design:

```text
Actions
   |
   v
RequestCoordinator
   |
   +--> cache
   +--> request coalescing
   |
   v
RequestExecutor
```

This is required to avoid unnecessary consumption of SwitchBot API request limits when multiple keys observe the same device/status endpoint.

## 15. Tests

### 15.1 Unit tests required for v1

At minimum:

**SwitchBotAuth**
- deterministic signature test
- timestamp string handling
- nonce inclusion

**Validation**
- accepts valid relative SwitchBot paths
- rejects absolute URLs
- rejects alternate origins
- rejects missing leading slash
- validates supported methods
- validates JSON body

**Settings**
- missing settings receive defaults
- v1 settings round-trip/normalize
- malformed persisted values are safely normalized or rejected
- credentials never migrate into action settings

**RequestExecutor**
- success for HTTP success + SwitchBot status 100
- authentication classification
- network classification
- HTTP failure classification
- SwitchBot non-100 classification
- malformed response classification
- unknown SwitchBot status preserved

**Output**
- pretty JSON formatting
- raw fallback
- clipboard option honored
- clipboard failure produces failure

**Logging/security**
- known credential values do not appear in sanitized log/error output

### 15.2 Integration-style tests

HTTP SHALL be injectable/mockable so tests can verify:

- correct fixed origin
- required authentication headers present
- correct method/path/body
- GET/DELETE body omitted
- response normalization

Tests MUST NOT call the real SwitchBot API in CI and MUST NOT require secrets.

## 16. CI

GitHub Actions SHALL run on pull requests and pushes to the main development branch.

Initial CI SHALL perform:

1. checkout
2. setup Node.js 24
3. `npm ci`
4. formatting/lint check if configured
5. TypeScript type check
6. unit tests
7. production build
8. Stream Deck plugin validation using the official CLI in non-interactive/no-update-check mode where supported

No SwitchBot credentials SHALL be required by CI.

The workflow SHALL use least privileges, normally `contents: read`.

## 17. Acceptance criteria for v1

v1 is acceptable when all of the following are true:

1. Project builds with Node.js 24 using a clean `npm ci`.
2. Stream Deck plugin validation succeeds.
3. CI passes without SwitchBot secrets.
4. Token and secret can be configured globally.
5. Test Connection validates credentials through the common request stack.
6. Get Devices copies the complete pretty JSON response and shows success.
7. Get Status validates Device ID, retrieves status, copies response, and shows success.
8. API Request supports GET/POST/PUT/DELETE against the fixed SwitchBot host.
9. API Request rejects invalid paths and invalid JSON before network execution.
10. API Request optionally copies the complete response.
11. HTTP and SwitchBot-level failures are distinguished.
12. Failure produces `showAlert()`; success produces `showOk()`.
13. Sensitive authentication material is absent from normal logs.
14. Core API/execution code has no dependency on Stream Deck UI/context APIs.
15. Automated tests cover signing, validation, normalization, error classification, output formatting, and secret sanitization.
16. No v1 implementation decision prevents adding Response Binding as an `ExecutionResult` consumer.
17. No v1 implementation decision requires per-action polling in a future polling implementation.

## 18. Manual acceptance tests

Because GitHub Actions cannot emulate the Stream Deck desktop application or OS clipboard end-to-end, the following remain manual:

- plugin installation/loading in Stream Deck 7.1+
- Property Inspector visual behavior
- global credential persistence
- Test Connection against a real SwitchBot account
- real Get Devices response
- real Get Status response
- real command request
- clipboard contents
- key OK/alert feedback

These tests SHALL be performed only with user-supplied local credentials; credentials SHALL never be committed to the repository.

## 19. Implementation order

1. Scaffold current Stream Deck TypeScript plugin project.
2. Add CI immediately.
3. Implement settings schemas/migration and validation.
4. Implement `SwitchBotAuth` with tests.
5. Implement `SwitchBotClient` with mocked HTTP tests.
6. Implement `RequestExecutor` and `ExecutionResult`.
7. Implement clipboard/output abstractions.
8. Implement Get Devices.
9. Implement Get Status and its Property Inspector.
10. Implement API Request and its Property Inspector.
11. Implement global authentication UI and Test Connection messaging.
12. Run CI/Stream Deck validation.
13. Perform a code/security review.
14. Perform manual Stream Deck/SwitchBot smoke tests.

## 20. Design principle

The v1 feature set is deliberately small. Generic API execution is the stable core. Convenience and visualization features should be layered on top of the normalized `ExecutionResult` rather than expanding SwitchBot-specific logic inside Stream Deck actions.
