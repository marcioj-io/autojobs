import assert from 'node:assert/strict';
import test from 'node:test';
import { TitleEligibilityValidator } from '@autojobs/shared';
import { PreFilterService } from './preFilter.service';

test('TitleEligibilityValidator rejects junior titles when profile only allows seniority levels', () => {
  const result = TitleEligibilityValidator.validate('Junior React Developer - Remote Work', {
    seniority: ['Pleno', 'Senior', 'Pleno/Senior'],
    allowedModalities: ['Remoto', 'Híbrido'],
    hybridCities: ['sao paulo', 'osasco'],
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason ?? '', /seniority|junior/i);
});

test('PreFilterService rejects junior roles before scoring even when title mentions remote', () => {
  const result = PreFilterService.evaluate({
    title: 'Junior React Developer - Remote Work',
    description: 'A remote role for a junior React developer',
    location: 'São Paulo, SP',
    profile: {
      seniority: ['Pleno', 'Senior', 'Pleno/Senior'],
      allowedModalities: ['Remoto', 'Híbrido'],
      hybridCities: ['sao paulo', 'osasco'],
      targetRoles: ['React Developer', 'Frontend Developer'],
    },
  } as any);

  assert.equal(result.action, 'reject');
  assert.match(result.reason ?? '', /pré-filtro|título|seniority|junior/i);
});

test('TitleEligibilityValidator accepts a matching role title and rejects a wrong role title', () => {
  const valid = TitleEligibilityValidator.validate('Node.js Developer', {
    targetRoles: ['Node.js Developer', 'Backend Developer'],
    seniority: ['Pleno', 'Senior'],
  });

  assert.equal(valid.eligible, true);

  const invalid = TitleEligibilityValidator.validate('Marketing Specialist', {
    targetRoles: ['Node.js Developer', 'Backend Developer'],
    seniority: ['Pleno', 'Senior'],
  });

  assert.equal(invalid.eligible, false);
  assert.match(invalid.reason ?? '', /Target Role|Target role|Target Role/i);
});

test('TitleEligibilityValidator rejects titles with incompatible seniority tokens', () => {
  const result = TitleEligibilityValidator.validate('Junior Backend Developer', {
    targetRoles: ['Backend Developer'],
    seniority: ['Pleno', 'Senior'],
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason ?? '', /seniority|junior/i);
});
