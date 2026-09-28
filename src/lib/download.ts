/** Saves text as a file through a temporary object URL. */
export function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick can cancel the download in Safari; give the browser time to start it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
