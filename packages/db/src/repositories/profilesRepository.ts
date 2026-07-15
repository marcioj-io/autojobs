// packages/db/src/repositories/profilesRepository.ts
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { profiles } from '../schema';
import type { Profile } from '../schema';

export class ProfilesRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createProfile(profile: Profile) {
    await this.db
      .insert(profiles)
      .values(profile)
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          name: profile.name,
          
          // Novas propriedades atualizadas conforme o Schema:
          targetRoles: profile.targetRoles,
          targetAreas: profile.targetAreas,
          seniority: profile.seniority,
          searchLocation: profile.searchLocation,
          allowedModalities: profile.allowedModalities,
          hybridCities: profile.hybridCities,
          skillMatrix: profile.skillMatrix,
          languages: profile.languages,
          negativeKeywords: profile.negativeKeywords,
          resumeFilePath: profile.resumeFilePath,
          aiApplicationContext: profile.aiApplicationContext,
          minScore: profile.minScore,
          dailyLimit: profile.dailyLimit,
          
          updatedAt: new Date(), // Atualiza o timestamp
        }
      });
  }

  async getProfileByName(name: string) {
    return this.db.select().from(profiles).where(eq(profiles.name, name)).get();
  }

  async getAllProfiles() {
    return this.db.select().from(profiles).all();
  }

  async getProfileById(id: string) {
    return this.db.select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .get();
  }
}