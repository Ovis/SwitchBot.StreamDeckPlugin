import streamDeck from "@elgato/streamdeck";
import { GetDevicesAction } from "./actions/get-devices-action.js";
import { GetStatusAction } from "./actions/get-status-action.js";
import { SwitchBotClient } from "./api/switchbot-client.js";
import { RequestExecutor } from "./execution/request-executor.js";
import { ClipboardOutput } from "./output/clipboard-output.js";
import { OutputProcessor } from "./output/output-processor.js";
import { StreamDeckCredentialProvider } from "./settings/streamdeck-credential-provider.js";
import { SystemClipboardService } from "./services/system-clipboard-service.js";

const executor = new RequestExecutor(
  new SwitchBotClient(),
  new StreamDeckCredentialProvider()
);
const output = new OutputProcessor(
  new ClipboardOutput(new SystemClipboardService())
);

streamDeck.actions.registerAction(new GetDevicesAction(executor, output));
streamDeck.actions.registerAction(new GetStatusAction(executor, output));

await streamDeck.connect();
