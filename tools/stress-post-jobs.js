// tools/stress-post-jobs.js
const crypto = require('crypto');

const WORKER_URL = process.env.WORKER_URL || 'https://autojobs-worker.marciojunior5872.workers.dev/jobs';
const JOB_COUNT = Number(process.env.JOB_COUNT || 60);

function makeJob(i) {
  const id = crypto.randomUUID();
  return {
    id,
    company: `Company ${i}`,
    title: `Dev Test ${i}`,
    url: `https://linkedin.fake/jobs/${id}`,
    score: Math.floor(Math.random() * 100),
    status: 'found',
    location: i % 2 === 0 ? 'Pinheiros, São Paulo' : 'Osasco, São Paulo',
    modality: 'Híbrido',
    easyApply: i % 3 === 0,
    language: 'PT',
    profileName: 'staging-profile',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    applyResult: { status: 'skipped', details: 'test', metadata: { i } },
    postedAt: new Date().toISOString(),
    description: 'Descrição de teste '.repeat(50)
  };
}

(async () => {
  try {
    const jobs = Array.from({ length: JOB_COUNT }).map((_, i) => makeJob(i));
    console.log('Posting', jobs.length, 'jobs to', WORKER_URL);

    const res = await fetch(WORKER_URL, {
      method: 'POST',
      body: JSON.stringify(jobs),
      headers: { 'Content-Type': 'application/json' },
      // node fetch timeout not available for global fetch; rely on default or env
    });

    console.log('Status', res.status);
    const body = await res.text();
    console.log('Response', body);
  } catch (err) {
    console.error('Error posting jobs:', err);
    process.exit(1);
  }
})();
