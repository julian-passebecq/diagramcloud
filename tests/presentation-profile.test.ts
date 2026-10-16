import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRESENTATION_PROFILE, isPresentationProfile, PRESENTATION_PROFILES,
  presentationExposure, presentationPreferenceKey, readPresentationPreference, writePresentationPreference,
  type PresentationPreferenceStorage,
} from '../src/core/presentationProfile';

function memoryStorage() {
  const values = new Map<string, string>();
  return {values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key, value);}};
}

test('presentation choices affect tool placement, while export, backup and recovery stay reachable', () => {
  assert.deepEqual(PRESENTATION_PROFILES, ['vanilla', 'standard', 'advanced']);
  assert.equal(DEFAULT_PRESENTATION_PROFILE, 'standard');
  assert.equal(presentationExposure('vanilla').simplifiedToolbar, true);
  assert.equal(presentationExposure('vanilla').workflowTools, false);
  assert.equal(presentationExposure('standard').workflowTools, true);
  assert.equal(presentationExposure('standard').advancedTools, false);
  assert.equal(presentationExposure('advanced').advancedTools, true);
  for(const profile of PRESENTATION_PROFILES) {
    assert.equal(presentationExposure(profile).exportBackupRecovery, true);
    assert.equal(presentationExposure(profile).moreTools, true);
  }
  for(const invalid of ['quick', 'deep', 'repository', 'guided', 'hybrid', 'graph', 'none', 'text', 'files', 'cli', 'sdk', 'mcp', '', null, 1]) {
    assert.equal(isPresentationProfile(invalid), false);
  }
});

test('preferences are versioned and isolated by project and host, including separator-containing identities', () => {
  const storage = memoryStorage();
  assert.equal(writePresentationPreference(storage, 'project:a', 'host:b', 'vanilla'), true);
  assert.deepEqual(readPresentationPreference(storage, 'project:a', 'host:b'), {profile: 'vanilla', status: 'saved'});
  assert.equal(readPresentationPreference(storage, 'project:a', 'other').status, 'missing');
  assert.equal(readPresentationPreference(storage, 'other', 'host:b').status, 'missing');
  assert.notEqual(presentationPreferenceKey('c', 'a:b'), presentationPreferenceKey('b:c', 'a'));
  assert.deepEqual(JSON.parse(storage.values.get(presentationPreferenceKey('project:a', 'host:b'))!), {version: 1, profile: 'vanilla'});
  assert.equal(writePresentationPreference(storage, 'project:a', 'other', 'advanced'), true);
  assert.equal(readPresentationPreference(storage, 'project:a', 'host:b').profile, 'vanilla');
});

test('corrupt or unsupported preferences fall back without deleting or repairing anything', () => {
  const storage = memoryStorage(), key = presentationPreferenceKey('project', 'host');
  for(const raw of ['{', 'null', '[]', '{}', '{"version":2,"profile":"advanced"}', '{"version":1,"profile":"deep"}', '{"version":1,"profile":"standard","source":"hybrid"}', 'x'.repeat(257)]) {
    storage.values.set(key, raw);
    assert.deepEqual(readPresentationPreference(storage, 'project', 'host'), {profile: 'standard', status: 'corrupt'});
    assert.equal(storage.values.get(key), raw);
  }
});

test('blocked reads and quota failures are contained, preserve existing project records and require no document mutation', () => {
  const storage = memoryStorage();
  const originalDocument = '{"id":"project","revision":7,"source":"guided","assistance":"none","audience":"private"}';
  storage.values.set('project-document', originalDocument);
  for(const profile of PRESENTATION_PROFILES) assert.equal(writePresentationPreference(storage, 'project', 'host', profile), true);
  assert.equal(storage.values.get('project-document'), originalDocument);
  const blocked: PresentationPreferenceStorage = {
    getItem() {throw new Error('SecurityError');},
    setItem() {throw new Error('QuotaExceededError');},
  };
  assert.deepEqual(readPresentationPreference(blocked, 'project', 'host'), {profile: 'standard', status: 'unavailable'});
  assert.equal(writePresentationPreference(blocked, 'project', 'host', 'advanced'), false);
  assert.equal(readPresentationPreference(null, 'project', 'host').status, 'unavailable');
  assert.equal(writePresentationPreference(null, 'project', 'host', 'vanilla'), false);
});
