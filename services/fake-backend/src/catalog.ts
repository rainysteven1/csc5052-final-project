import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FakeCatalog, FakeScenario } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(__dirname, '../data');
const catalogPath = path.join(dataRoot, 'catalog.json');

function readJSON<T>(targetPath: string): T {
  return JSON.parse(fs.readFileSync(targetPath, 'utf-8')) as T;
}

export function loadCatalog(): FakeCatalog {
  return readJSON<FakeCatalog>(catalogPath);
}

export function loadScenarioResult(resultFile: string): Record<string, unknown> {
  return readJSON<Record<string, unknown>>(path.join(dataRoot, resultFile));
}

export function selectScenario(catalog: FakeCatalog, requested?: string | null): FakeScenario {
  const normalized = (requested || '').trim().toLowerCase();
  const scenariosById = new Map(
    catalog.scenarios.map((scenario) => [scenario.id.toLowerCase(), scenario])
  );

  if (normalized && scenariosById.has(normalized)) {
    return scenariosById.get(normalized)!;
  }

  if (normalized) {
    const fuzzy = catalog.scenarios.find(
      (scenario) =>
        normalized.includes(scenario.id.toLowerCase()) ||
        normalized.includes(path.basename(scenario.resultFile).toLowerCase())
    );
    if (fuzzy) {
      return fuzzy;
    }
  }

  return scenariosById.get(catalog.defaultScenario.toLowerCase()) || catalog.scenarios[0];
}
