import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fontDirectory = new URL('../src/fonts/', import.meta.url);
const hasFonts = readdirSync(fontDirectory, { withFileTypes: true }).some(
  (entry) => entry.isFile() && /\.(ttf|otf|woff2?)$/i.test(entry.name),
);

if (hasFonts || existsSync(new URL('generated/.sources.json', fontDirectory))) {
  const windows = process.platform === 'win32';
  const localPython = fileURLToPath(new URL(
    windows ? '../.venv/Scripts/python.exe' : '../.venv/bin/python',
    import.meta.url,
  ));
  const python = existsSync(localPython) ? localPython : (windows ? 'python' : 'python3');
  const script = fileURLToPath(new URL('./prepare_fonts.py', import.meta.url));
  const result = spawnSync(python, [script], { stdio: 'inherit' });

  if (result.error) console.error(`Could not start Python for font preparation: ${result.error.message}`);
  process.exitCode = result.status ?? 1;
}
