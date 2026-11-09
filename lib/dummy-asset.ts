import fs from 'fs';
import path from 'path';

// Valid 10x10 solid black PNG (PNG magic bytes 89504e470d0a1a0a)
export const DUMMY_BLACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGYzAAAO9+CQW9Q0QSAAAAAElFTkSuQmCC';

/**
 * Returns the absolute path to a guaranteed valid dummy black PNG image.
 * If the file does not yet exist on disk in public/test-assets/, it creates it automatically.
 */
export function getOrCreateDummyUploadImage(): string {
  const dir = path.join(process.cwd(), 'public', 'test-assets');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, 'dummy-black.png');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    fs.writeFileSync(filePath, Buffer.from(DUMMY_BLACK_PNG_BASE64, 'base64'));
  }
  return filePath;
}
