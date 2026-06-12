// packages/engine/server.ts

import Fastify from 'fastify';
import { LinkedInScraperService } from './src/linkedinScraperService';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION');
  console.error(err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION');
  console.error(err);
});

async function start() {
  console.log('RAILWAY_SERVICE_NAME=', process.env.RAILWAY_SERVICE_NAME);
  console.log('RAILWAY_ENVIRONMENT_NAME=', process.env.RAILWAY_ENVIRONMENT_NAME);
  console.log('NODE_ENV=', process.env.NODE_ENV);
  console.log('PORT=', process.env.PORT);

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

  const app = Fastify({
    logger: true
  });

  app.get('/health', async () => {
    return {
      success: true,
      service: 'engine'
    };
  });

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

  try {
    await app.listen({
      port: Number(process.env.PORT ?? 3001),
      host: '0.0.0.0'
    });

    console.log('ENGINE READY');
  } catch (err) {
    console.error('LISTEN FAILED');
    console.error(err);
    throw err;
  }
}

start().catch((err) => {
  console.error('FATAL STARTUP ERROR');
  console.error(err);
  process.exit(1);
});