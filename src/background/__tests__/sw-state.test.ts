import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockAlarmsCreate = vi.fn();
const mockAlarmsClear = vi.fn();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
  alarms: {
    create: mockAlarmsCreate,
    clear: mockAlarmsClear,
  },
});

const { restoreState, persistCollectingState, startKeepAlive, stopKeepAlive, KEEP_ALIVE_ALARM } = await import("../sw-state");

describe("sw-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("persistCollectingState", () => {
    it("saves collecting=true and metadata to chrome.storage.local", () => {
      const metadata = {
        title: "TestStream",
        category: "Gaming",
        platform: "twitch" as const,
        viewerCountApprox: 1234,
        durationMonitored: 15,
      };

      persistCollectingState(true, metadata);

      expect(mockStorageSet).toHaveBeenCalledOnce();
      expect(mockStorageSet).toHaveBeenCalledWith({
        sw_collecting: true,
        sw_metadata: metadata,
      });
    });

    it("saves collecting=false to chrome.storage.local", () => {
      const metadata = {
        title: "TestStream",
        category: "Gaming",
        platform: "twitch" as const,
        viewerCountApprox: 0,
        durationMonitored: 0,
      };

      persistCollectingState(false, metadata);

      expect(mockStorageSet).toHaveBeenCalledWith({
        sw_collecting: false,
        sw_metadata: metadata,
      });
    });
  });

  describe("restoreState", () => {
    it("restores collecting=true and metadata from storage", async () => {
      const savedMetadata = {
        title: "SavedStream",
        category: "Just Chatting",
        platform: "twitch" as const,
        viewerCountApprox: 5000,
        durationMonitored: 30,
      };

      mockStorageGet.mockImplementation((_keys: string[], cb: (result: Record<string, unknown>) => void) => {
        cb({ sw_collecting: true, sw_metadata: savedMetadata });
      });

      const state = await restoreState();

      expect(state.collecting).toBe(true);
      expect(state.metadata).toEqual(savedMetadata);
    });

    it("restores collecting=false when not in storage", async () => {
      mockStorageGet.mockImplementation((_keys: string[], cb: (result: Record<string, unknown>) => void) => {
        cb({});
      });

      const state = await restoreState();

      expect(state.collecting).toBe(false);
    });

    it("returns default metadata when not in storage", async () => {
      mockStorageGet.mockImplementation((_keys: string[], cb: (result: Record<string, unknown>) => void) => {
        cb({ sw_collecting: false });
      });

      const state = await restoreState();

      expect(state.metadata).toEqual({
        title: "Unknown Stream",
        category: "Just Chatting",
        platform: "twitch",
        viewerCountApprox: 0,
        durationMonitored: 0,
      });
    });

    it("restores full state from storage", async () => {
      const savedMetadata = {
        title: "xQc",
        category: "Just Chatting",
        platform: "twitch" as const,
        viewerCountApprox: 80000,
        durationMonitored: 60,
      };

      mockStorageGet.mockImplementation((_keys: string[], cb: (result: Record<string, unknown>) => void) => {
        cb({ sw_collecting: true, sw_metadata: savedMetadata });
      });

      const state = await restoreState();

      expect(state.collecting).toBe(true);
      expect(state.metadata.title).toBe("xQc");
      expect(state.metadata.viewerCountApprox).toBe(80000);
    });
  });

  describe("startKeepAlive / stopKeepAlive", () => {
    it("creates alarm with correct name and period", () => {
      startKeepAlive();

      expect(mockAlarmsCreate).toHaveBeenCalledOnce();
      expect(mockAlarmsCreate).toHaveBeenCalledWith(KEEP_ALIVE_ALARM, { periodInMinutes: 0.4 });
    });

    it("clears alarm on stop", () => {
      stopKeepAlive();

      expect(mockAlarmsClear).toHaveBeenCalledOnce();
      expect(mockAlarmsClear).toHaveBeenCalledWith(KEEP_ALIVE_ALARM);
    });

    it("alarm constant is correct", () => {
      expect(KEEP_ALIVE_ALARM).toBe("chatpulse-keepalive");
    });
  });
});
