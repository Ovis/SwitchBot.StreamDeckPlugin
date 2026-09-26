# SwitchBot.StreamDeckPlugin

An advanced-user Stream Deck plugin for calling SwitchBot OpenAPI v1.1 directly.

The first release is planned to provide:

- Get Devices: copy the complete device-list JSON response to the clipboard.
- Get Status: retrieve a configured device status and copy the JSON response.
- API Request: execute a manually configured SwitchBot API request.

The implementation is based on Stream Deck SDK 3.x, Node.js 24, and TypeScript.

See [docs/IMPLEMENTATION_SPEC.md](docs/IMPLEMENTATION_SPEC.md) for the implementation contract.

## Development

Requires Node.js 24 or later.

```sh
npm install
npm run typecheck
npm test
npm run build
npm run validate
```

SwitchBot credentials must never be committed to this repository.
