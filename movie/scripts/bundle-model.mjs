import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from '../../node_modules/esbuild/lib/main.js';

export async function bundleModel(root) {
  await esbuild.build({
    absWorkingDir: root,
    stdin: {
      contents: `export { createCastle } from './castle.js';
export { createLandscape } from './landscape.js';
export { createAttraction } from './attractions.js';
export { staticBatch } from './materials.js';`,
      resolveDir: path.join(root, 'assets/wonder/park-source'),
      sourcefile: 'film-model.js',
    },
    bundle: true, format: 'esm', platform: 'browser',
    external: ['three', 'three/*'],
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.hdr': 'dataurl' },
    outfile: path.join(root, 'assets/wonder/model/park-model.js'),
    logLevel: 'warning',
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await bundleModel(process.env.FILM_WORKSPACE || process.cwd());
  console.log('Bundled current park models and imported image assets.');
}
