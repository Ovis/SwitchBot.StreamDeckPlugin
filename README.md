# SwitchBot.StreamDeckPlugin

A Stream Deck plugin for SwitchBot OpenAPI v1.1.

## Current actions

### Get Status
- Selects a device from a cached device catalog.
- The catalog can be refreshed from the Property Inspector.
- Calls `GET /v1.1/devices/{deviceId}/status`.
- Can temporarily display the result on the Stream Deck key.
- Can optionally copy the complete response JSON to the clipboard.

### API Request
- Provides presets for common device, scene, and webhook APIs.
- Device and scene parameters are selected from cached catalogs.
- Catalogs can be refreshed from the Property Inspector.
- Preset metadata, methods, paths, body policy, and request templates are defined centrally in TypeScript.
- Custom mode supports GET, POST, PUT, and DELETE against the fixed SwitchBot API host.
- Response clipboard copying is optional.

Both Property Inspectors provide global SwitchBot Token/Secret configuration and a connection test.

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
