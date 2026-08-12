// packages/engine/server.ts
import Fastify from 'fastify';
import { LinkedInScraperService } from './src/linkedinScraperService';

async function start() {
  const app = Fastify({ logger: true });

  // =================================================
  // Route
  // =================================================
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
      profileName: body.profileName,
      language: body.language,
      maxResults: body.maxResults,
      storageState: body.storageState,
      profile: body.profile,
      modalities: Array.isArray(body.modalities) ? body.modalities : undefined,
      processedJobIds: Array.isArray(body.processedJobIds) ? body.processedJobIds : undefined
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