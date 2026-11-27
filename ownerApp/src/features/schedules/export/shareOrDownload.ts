/**
 * Hands the PDF to the owner. On a phone or tablet that can share files, the
 * system's share sheet opens (WhatsApp is in it); everywhere else, and when
 * sharing isn't allowed, the file is downloaded.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      // The owner closed the share sheet: nothing more to do.
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Anything else (the browser refused, e.g. the click was too long ago): download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
