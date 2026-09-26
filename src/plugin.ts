import streamDeck from "@elgato/streamdeck";
import { ApiRequestAction } from "./actions/api-request-action.js";
import { GetDevicesAction } from "./actions/get-devices-action.js";
import { GetStatusAction } from "./actions/get-status-action.js";
import { SwitchBotClient } from "./api/switchbot-client.js";
import { RequestExecutor } from "./execution/request-executor.js";
import { ClipboardOutput } from "./output/clipboard-output.js";
import { OutputProcessor } from "./output/output-processor.js";
import { StreamDeckCredentialProvider } from "./settings/streamdeck-credential-provider.js";
import { SystemClipboardService } from "./services/system-clipboard-service.js";
import { DeviceCatalogStore } from "./settings/device-catalog-store.js";

const executor = new RequestExecutor(
  new SwitchBotClient(),
  new StreamDeckCredentialProvider()
);
const output = new OutputProcessor(
  new ClipboardOutput(new SystemClipboardService())
);
const catalogStore = new DeviceCatalogStore();

await streamDeck.connect();

streamDeck.actions.registerAction(new ApiRequestAction(executor, output));
streamDeck.actions.registerAction(new GetDevicesAction(executor, output, catalogStore));
streamDeck.actions.registerAction(new GetStatusAction(executor, output, catalogStore, streamDeck.info.application.language));
