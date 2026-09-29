# SwitchBot.StreamDeckPlugin

A Stream Deck plugin for SwitchBot OpenAPI v1.1.

## Current actions

### Physical Control
Seven focused actions expose structured, model-aware SwitchBot Control Commands:

- Bot
- Power
- Lighting
- Climate
- Security
- Curtains & Blinds
- Cleaning

Each action filters the cached device catalog to compatible `deviceType` values, exposes only documented operations and parameters, validates settings fail-closed, and builds Property Inspector previews through the same command builder used for execution. Security-sensitive operations require a second key press unless the supported unlock-confirmation option is explicitly disabled.

### Infrared Remote
- Selects a virtual infrared remote from the cached device catalog.
- Provides model-aware operations and advanced command overrides.
- Uses the normal authenticated request and execution pipeline.

### Get Status
- Selects a device from a cached device catalog.
- Calls `GET /v1.1/devices/{deviceId}/status`.
- Can temporarily display the result on the Stream Deck key.
- Can optionally copy the complete response JSON to the clipboard.

### API Request
- Provides presets for common device, scene, and webhook APIs plus Custom mode.
- Device and scene parameters are selected from cached catalogs.
- The device-command preset shows only documented Control Commands-capable devices.
- Physical Control device samples are derived from the shared Physical Control catalog; API Request-only devices keep explicit templates.
- Custom mode supports GET, POST, PUT, and DELETE against the fixed SwitchBot API host.
- Response clipboard copying is optional.

Property Inspectors share global SwitchBot Token/Secret configuration and connection testing.

## Architecture

- Stream Deck SDK 3.x
- Node.js 24
- TypeScript
- SwitchBot OpenAPI v1.1
- Zod runtime settings validation
- Vitest
- GitHub Actions

Global settings updates are serialized through a shared store so credential, device-catalog, and scene-catalog updates cannot overwrite one another inside the plugin process.

See [docs/IMPLEMENTATION_SPEC.md](docs/IMPLEMENTATION_SPEC.md) for the current implementation contract.

## Development

Requires Node.js 24 or later.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run validate
```

SwitchBot credentials must never be committed to this repository.
