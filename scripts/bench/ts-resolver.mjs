import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const resolve = async (specifier, context, next) => {
  if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL) {
    const url = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
  }
  return next(specifier, context);
};
