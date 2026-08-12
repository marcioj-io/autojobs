import test from 'node:test';
import assert from 'node:assert/strict';
import { PreFilterService } from '../packages/scoring/src/filters/preFilter.service';

test('rejects onsite roles when the profile only allows remote or hybrid', () => {
  const result = PreFilterService.evaluate({
    title: 'Node.js Developer',
    description: 'We are looking for a Node.js Developer to work 100% onsite at our office in Campinas. Willingness to work with Java.',
    location: 'Campinas, SP',
    profile: {
      targetRoles: ['Node.js Developer'],
      seniority: ['Pleno', 'Senior'],
      negativeKeywords: ['Java', 'specialist', 'senior'],
      allowedModalities: ['Remoto', 'Híbrido'],
      hybridCities: ['sao paulo', 'osasco'],
    },
  } as any);

  assert.equal(result.action, 'reject');
  assert.notEqual(result.action, 'soft_reject');
});
