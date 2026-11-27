import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareOrDownload } from "./shareOrDownload";

const blob = new Blob(["%PDF-"], { type: "application/pdf" });
const NAME = "schedule-2026-W47.pdf";

/** The download link's click, with what the link was at that moment. */
const clicked = vi.fn<(link: { href: string; download: string }) => void>();

beforeEach(() => {
  // jsdom has neither of these.
  URL.createObjectURL = vi.fn(() => "blob:pdf");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  clicked.mockReset();
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
});

function withSharing(share: () => Promise<void>, canShare = true) {
  const shareSpy = vi.fn(share);
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => canShare });
  Object.defineProperty(navigator, "share", { configurable: true, value: shareSpy });
  return shareSpy;
}

describe("shareOrDownload", () => {
  it("downloads the file where files can't be shared", async () => {
    await shareOrDownload(blob, NAME);

    expect(clicked).toHaveBeenCalledWith({ href: "blob:pdf", download: NAME });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
  });

  it("opens the share sheet with the PDF where files can be shared", async () => {
    const share = withSharing(async () => {});

    await shareOrDownload(blob, NAME);

    const [data] = share.mock.calls[0] as unknown as [ShareData];
    expect(data.files).toHaveLength(1);
    expect(data.files![0]!.name).toBe(NAME);
    expect(data.files![0]!.type).toBe("application/pdf");
    expect(clicked).not.toHaveBeenCalled();
  });

  it("downloads when the device says it can't share this file", async () => {
    const share = withSharing(async () => {}, false);

    await shareOrDownload(blob, NAME);

    expect(share).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("does nothing more when the owner closes the share sheet", async () => {
    withSharing(async () => {
      throw new DOMException("Share canceled", "AbortError");
    });

    await shareOrDownload(blob, NAME);

    expect(clicked).not.toHaveBeenCalled();
  });

  it("downloads when the browser refuses to share", async () => {
    withSharing(async () => {
      throw new DOMException("Must be handling a user gesture", "NotAllowedError");
    });

    await shareOrDownload(blob, NAME);

    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
