// Starts a file download from a string: a Blob, a temporary object URL and a link with the
// download attribute. Works on current desktop browsers and on Android and iPhone Safari.

const REVOKE_AFTER_MS = 1000;

export function downloadFile(name: string, mime: string, content: string): void {
  const type = mime.startsWith('text/') ? `${mime};charset=utf-8` : mime;
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // the browser needs the URL a moment longer to start the download
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
