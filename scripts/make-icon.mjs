import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import toIco from 'to-ico';

const size = 256;
const png = new PNG({ width: size, height: size });
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const i = (size * y + x) << 2;
    const edge = x < 18 || y < 18 || x > 237 || y > 237;
    const board = x > 48 && x < 208 && y > 48 && y < 208;
    const house = y > 78 && y < 150 && x > 108 && x < 148;
    png.data[i] = edge ? 62 : board ? 243 : house ? 30 : 92;
    png.data[i + 1] = edge ? 41 : board ? 228 : house ? 120 : 56;
    png.data[i + 2] = edge ? 24 : board ? 196 : house ? 60 : 32;
    png.data[i + 3] = 255;
  }
}
const out = path.resolve('build');
fs.mkdirSync(out, { recursive: true });
const buffer = PNG.sync.write(png);
fs.writeFileSync(path.join(out, 'icon.png'), buffer);
const ico = await toIco([buffer]);
fs.writeFileSync(path.join(out, 'icon.ico'), ico);
console.log('Wrote build/icon.png and build/icon.ico');
