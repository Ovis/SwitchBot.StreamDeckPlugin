import { describe, expect, it } from "vitest";
import { displayLocale, formatStatusForKey, localizeDeviceLabel } from "../src/output/status-title-formatter.js";

describe("display localization", () => {
  it("selects Japanese for Japanese Stream Deck locales and English otherwise", () => {
    expect(displayLocale("ja")).toBe("ja");
    expect(displayLocale("ja-JP")).toBe("ja");
    expect(displayLocale("en-US")).toBe("en");
  });

  it("localizes status labels and known values", () => {
    expect(formatStatusForKey({ body: { temperature: 23.8, humidity: 54, power: "on" } }, "ja"))
      .toBe("温度: 23.8°C\n湿度: 54%\n電源: オン");
    expect(formatStatusForKey({ body: { lockState: "locked", battery: 87 } }, "ja"))
      .toBe("電池: 87%\nロック: 施錠");
  });

  it("localizes deleted device labels", () => {
    expect(localizeDeviceLabel("玄関", "Lock", "A", true, "ja"))
      .toBe("[削除済み] 玄関 — Lock (A)");
    expect(localizeDeviceLabel("Front Door", "Lock", "A", true, "en"))
      .toBe("[Deleted] Front Door — Lock (A)");
  });
});
