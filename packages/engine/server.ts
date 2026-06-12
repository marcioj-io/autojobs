// packages\engine\server.ts
import Fastify from 'fastify';
import { LinkedInScraperService } from './src/linkedinScraperService';
async function start() {
  const app = Fastify({ logger: true });
console.log('RAILWAY_SERVICE_NAME=', process.env.RAILWAY_SERVICE_NAME);
console.log('RAILWAY_ENVIRONMENT_NAME=', process.env.RAILWAY_ENVIRONMENT_NAME);
console.log('NODE_ENV=', process.env.NODE_ENV);
    console.log('=== ENV VALUES ===');

    console.log({
      BROWSER_WS_ENDPOINT: process.env.BROWSER_WS_ENDPOINT
        ? 'PRESENT'
        : 'MISSING',

      LINKEDIN_USERNAME: process.env.LINKEDIN_USERNAME
        ? 'PRESENT'
        : 'MISSING',

      LINKEDIN_PASSWORD: process.env.LINKEDIN_PASSWORD
        ? 'PRESENT'
        : 'MISSING'
    });

    console.log('==================');
  // =================================================
  // Route
  // =================================================
  app.post('/scrape', async (req, reply) => {
    const body = req.body as any;

    const scraper = new LinkedInScraperService(true);

    const result = await scraper.scrape({
      query: body.query,
      location: body.location,
      profile: body.profile,
      language: body.language,
      maxResults: body.maxResults,
      storageState: body.storageState
    });
    
    return reply.send({
      success: true,
      data: result
    });
  });

  await app.listen({
    port: 3001,
    host: '0.0.0.0'
  });
}

start().catch(console.error);