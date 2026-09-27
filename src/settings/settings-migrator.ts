import { normalizeApiRequestSettings, type ApiRequestSettingsV1 } from "./api-request-settings.js";
import { normalizeGetStatusSettings, type GetStatusSettingsV1 } from "./get-status-settings.js";
import { normalizeGlobalSettings, type GlobalSettingsV1 } from "./global-settings.js";

export class SettingsMigrator {
  global(value: unknown): GlobalSettingsV1 {
    return normalizeGlobalSettings(value);
  }

  apiRequest(value: unknown): ApiRequestSettingsV1 {
    return normalizeApiRequestSettings(value);
  }

  getStatus(value: unknown): GetStatusSettingsV1 {
    return normalizeGetStatusSettings(value);
  }
}
