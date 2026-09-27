import streamDeck from "@elgato/streamdeck";
import { ApiRequestAction } from "./actions/api-request-action.js";
import { GetStatusAction } from "./actions/get-status-action.js";
import { InfraredRemoteAction } from "./actions/infrared-remote-action.js";
import { SwitchBotClient } from "./api/switchbot-client.js";
import { RequestExecutor } from "./execution/request-executor.js";
import { ClipboardOutput } from "./output/clipboard-output.js";
import { OutputProcessor } from "./output/output-processor.js";
import { StreamDeckCredentialProvider } from "./settings/streamdeck-credential-provider.js";
import { SystemClipboardService } from "./services/system-clipboard-service.js";
import { DeviceCatalogStore } from "./settings/device-catalog-store.js";
import { SceneCatalogStore } from "./settings/scene-catalog-store.js";
import { GlobalSettingsStore } from "./settings/global-settings-store.js";
import { CatalogRefreshService } from "./services/catalog-refresh-service.js";

const globalSettings = new GlobalSettingsStore();
const executor = new RequestExecutor(new SwitchBotClient(), new StreamDeckCredentialProvider(globalSettings));
const output = new OutputProcessor(new ClipboardOutput(new SystemClipboardService()));
const deviceCatalogStore = new DeviceCatalogStore(globalSettings);
const sceneCatalogStore = new SceneCatalogStore(globalSettings);
const catalogRefresh = new CatalogRefreshService(executor, deviceCatalogStore, sceneCatalogStore);

streamDeck.actions.registerAction(new ApiRequestAction(
  executor, output, deviceCatalogStore, sceneCatalogStore, catalogRefresh, globalSettings, streamDeck.info.application.language
));
streamDeck.actions.registerAction(new GetStatusAction(
  executor, output, deviceCatalogStore, catalogRefresh, globalSettings, streamDeck.info.application.language
));
streamDeck.actions.registerAction(new InfraredRemoteAction(
  executor, output, deviceCatalogStore, catalogRefresh, globalSettings, streamDeck.info.application.language
));

await streamDeck.connect();
