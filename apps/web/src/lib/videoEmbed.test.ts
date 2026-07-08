import { videoEmbedUrl } from './videoEmbed';

it('resolves the common YouTube URL shapes', () => {
  const expected = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
  expect(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
  expect(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(expected);
  expect(videoEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(expected);
  expect(videoEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(expected);
  expect(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe(expected);
});

it('resolves Vimeo URLs', () => {
  expect(videoEmbedUrl('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
  expect(videoEmbedUrl('https://www.vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
});

it('rejects anything else', () => {
  expect(videoEmbedUrl('')).toBeNull();
  expect(videoEmbedUrl('no es una url')).toBeNull();
  expect(videoEmbedUrl('https://ejemplo.com/video.mp4')).toBeNull();
  expect(videoEmbedUrl('https://www.youtube.com/watch')).toBeNull();
  expect(videoEmbedUrl('javascript:alert(1)')).toBeNull();
  expect(videoEmbedUrl('https://vimeo.com/canal-sin-id')).toBeNull();
});
