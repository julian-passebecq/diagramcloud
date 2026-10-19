import {validateLearningCatalogue, learningSourceSchema} from '../../src/intelligence/learning/catalogue';
import {MIGRATION_SOURCES, migrationCardEntries} from '../../src/intelligence/learning/practicalCards';

/** The eight migration / CI / handoff candidates. The card data lives in the App catalogue module
 * (`src/intelligence/learning/practicalCards.ts`); the reconciliation decides which ones the App shows. */
export const migrationSources = MIGRATION_SOURCES.map(row => learningSourceSchema.parse(row));

export function buildMigrationCandidates() {
  return {entries: validateLearningCatalogue(migrationCardEntries(), migrationSources), sources: migrationSources};
}
