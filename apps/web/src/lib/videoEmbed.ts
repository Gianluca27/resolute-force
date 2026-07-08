// YouTube/Vimeo page URL → embeddable player URL, or null when unrecognized.
// Whitelist parsing: whatever doesn't match a known shape renders nothing,
// so a merchant pasting a wrong URL can't inject an arbitrary iframe.

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function videoEmbedUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '');

  let ytId: string | null = null;
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') ytId = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/);
      ytId = m?.[1] ?? null;
    }
  } else if (host === 'youtu.be') {
    ytId = u.pathname.slice(1).split('/')[0] || null;
  }
  if (ytId && YT_ID.test(ytId)) return `https://www.youtube-nocookie.com/embed/${ytId}`;

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/(?:video\/)?(\d+)$/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}
