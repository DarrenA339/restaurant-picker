import { afterEach, describe, expect, it, vi } from "vitest";
import { CallLog } from "./calls";

describe("CallLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says 0 Google calls when nothing was called", () => {
    expect(new CallLog().summary()).toBe("0 Google calls");
  });

  it("singular for one call", () => {
    const calls = new CallLog();
    calls.count("details");
    expect(calls.summary()).toBe("1 Google call (details 1)");
  });

  it("lists kinds in a fixed order with their counts", () => {
    const calls = new CallLog();
    calls.count("photo");
    calls.count("details");
    calls.count("photo");
    expect(calls.total).toBe(3);
    expect(calls.summary()).toBe("3 Google calls (details 1, photo 2)");
  });

  it("logs one line per request with a [places] prefix", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const calls = new CallLog();
    calls.count("search");
    calls.log("GET /api/places/search");
    expect(info).toHaveBeenCalledWith("[places] GET /api/places/search: 1 Google call (search 1)");
  });
});
