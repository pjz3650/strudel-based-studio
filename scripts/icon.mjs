import { writeFileSync } from 'node:fs';
// Original waveform mark, encoded as multi-resolution Windows DIB icon.
const sizes = [16, 24, 32, 48, 64, 128, 256],
  frames = [];
for (const size of sizes) {
  const stride = Math.ceil(size / 32) * 4,
    pixels = size * size * 4;
  const dib = Buffer.alloc(40 + pixels + stride * size);
  dib.writeUInt32LE(40);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(pixels + stride * size, 20);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = ((x + 0.5) * 256) / size,
        py = ((y + 0.5) * 256) / size;
      let foreground = false;
      for (const [i, height] of [42, 90, 140, 184, 104, 60].entries()) {
        const distanceX = px - (48 + i * 32),
          distanceY = Math.max(0, Math.abs(py - 128) - height / 2);
        if (distanceX * distanceX + distanceY * distanceY <= 36) foreground = true;
      }
      const index = 40 + ((size - y - 1) * size + x) * 4;
      const color = foreground ? [34, 211, 238] : [11, 18, 32];
      dib[index] = color[2];
      dib[index + 1] = color[1];
      dib[index + 2] = color[0];
      dib[index + 3] = 255;
    }
  frames.push(dib);
}
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const at = 6 + i * 16;
  header[at] = header[at + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(frames[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += frames[i].length;
});
writeFileSync('assets/icon.ico', Buffer.concat([header, ...frames]));
