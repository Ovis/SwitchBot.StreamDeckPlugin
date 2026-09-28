import { describe, expect, it } from "vitest";
import {
  parsePluginToPropertyInspectorMessage,
  parsePropertyInspectorToPluginMessage
} from "../src/protocol/property-inspector-protocol.js";

describe("Property Inspector protocol", () => {
  describe("parsePropertyInspectorToPluginMessage", () => {
    it("認証情報を持つ要求を判別する", () => {
      expect(parsePropertyInspectorToPluginMessage({
        event: "testConnection",
        credentials: { token: "token", secret: "secret" }
      })).toEqual({
        event: "testConnection",
        credentials: { token: "token", secret: "secret" }
      });
    });

    it("実行診断要求を判別する", () => {
      expect(parsePropertyInspectorToPluginMessage({
        event: "getExecutionDiagnostics"
      })).toEqual({ event: "getExecutionDiagnostics" });
    });

    it("カタログ更新要求のrefresh指定を保持する", () => {
      expect(parsePropertyInspectorToPluginMessage({
        event: "getDevices",
        isRefresh: true
      })).toEqual({ event: "getDevices", isRefresh: true });
    });

    it("Physical Control catalog要求を判別する", () => {
      expect(parsePropertyInspectorToPluginMessage({
        event: "getPhysicalControlCatalog",
        isRefresh: true
      })).toEqual({ event: "getPhysicalControlCatalog", isRefresh: true });
    });

    it("未知eventと不正な認証情報をfail closedする", () => {
      expect(parsePropertyInspectorToPluginMessage({ event: "futureEvent" })).toBeUndefined();
      expect(parsePropertyInspectorToPluginMessage({
        event: "saveCredentials",
        credentials: { token: "token" }
      })).toBeUndefined();
    });
  });

  describe("parsePluginToPropertyInspectorMessage", () => {
    it("デバイス一覧とcommand templateを検証して返す", () => {
      expect(parsePluginToPropertyInspectorMessage({
        event: "getDevices",
        items: [{ label: "Bot", value: "device-1" }],
        commandTemplates: { "device-1": "{\"command\":\"press\"}" },
        refreshFailed: false
      })).toEqual({
        event: "getDevices",
        items: [{ label: "Bot", value: "device-1" }],
        commandTemplates: { "device-1": "{\"command\":\"press\"}" },
        refreshFailed: false
      });
    });

    it("Physical Control catalogのdeviceTypeを検証する", () => {
      expect(parsePluginToPropertyInspectorMessage({
        event: "physicalControlCatalog",
        devices: [
          { label: "Bot", value: "bot-1", deviceType: "Bot" },
          { label: "Broken", value: "broken" }
        ],
        operations: [{ label: "Press", value: "press" }],
        refreshFailed: false
      })).toEqual({
        event: "physicalControlCatalog",
        devices: [{ label: "Bot", value: "bot-1", deviceType: "Bot" }],
        operations: [{ label: "Press", value: "press" }],
        refreshFailed: false
      });
    });

    it("赤外線リモコンの入れ子構造を検証する", () => {
      expect(parsePluginToPropertyInspectorMessage({
        event: "getInfraredRemotes",
        items: [{ label: "TV", value: "remote-1" }],
        remotes: [{
          label: "TV",
          value: "remote-1",
          remoteType: "TV",
          hubDeviceId: "hub-1",
          commands: [{ label: "Power On", value: "turnOn", parameterKind: "default" }]
        }]
      })).toEqual({
        event: "getInfraredRemotes",
        items: [{ label: "TV", value: "remote-1" }],
        remotes: [{
          label: "TV",
          value: "remote-1",
          remoteType: "TV",
          hubDeviceId: "hub-1",
          commands: [{ label: "Power On", value: "turnOn", parameterKind: "default" }]
        }]
      });
    });

    it("実行診断応答を検証する", () => {
      expect(parsePluginToPropertyInspectorMessage({
        event: "executionDiagnostics",
        available: true,
        executedAt: "2026-09-28T00:00:00.000Z",
        method: "GET",
        path: "/v1.1/devices",
        success: false,
        errorCategory: "http",
        errorMessage: "HTTP 500",
        httpStatus: 500,
        responseBody: `{\n  "error": true\n}`
      })).toEqual({
        event: "executionDiagnostics",
        available: true,
        executedAt: "2026-09-28T00:00:00.000Z",
        method: "GET",
        path: "/v1.1/devices",
        success: false,
        errorCategory: "http",
        errorMessage: "HTTP 500",
        httpStatus: 500,
        responseBody: `{\n  "error": true\n}`
      });
      expect(parsePluginToPropertyInspectorMessage({
        event: "executionDiagnostics",
        available: false
      })).toEqual({ event: "executionDiagnostics", available: false });
    });

    it("不完全な実行診断応答をfail closedする", () => {
      expect(parsePluginToPropertyInspectorMessage({
        event: "executionDiagnostics",
        available: true,
        method: "GET"
      })).toBeUndefined();
    });

    it("未知eventと必須配列欠落をfail closedする", () => {
      expect(parsePluginToPropertyInspectorMessage({ event: "futureResult" })).toBeUndefined();
      expect(parsePluginToPropertyInspectorMessage({ event: "getDevices" })).toBeUndefined();
    });

    it("不正な一覧要素だけを除外して有効な応答を維持する", () => {
      expect(parsePluginToPropertyInspectorMessage({
        event: "getScenes",
        items: [
          { label: "Scene", value: "scene-1" },
          { label: 123, value: "broken" }
        ]
      })).toEqual({
        event: "getScenes",
        items: [{ label: "Scene", value: "scene-1" }]
      });
    });

    it("未知の接続エラーカテゴリを取り込まない", () => {
      expect(parsePluginToPropertyInspectorMessage({
        event: "testConnectionResult",
        success: false,
        errorCategory: "future-category"
      })).toEqual({
        event: "testConnectionResult",
        success: false
      });
    });
  });
});
