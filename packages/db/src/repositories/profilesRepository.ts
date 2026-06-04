// packages\db\src\repositories\profilesRepository.ts
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { profiles } from '../schema';
// import type { ProfileModel } from '../schema';
import type { Profile } from '../schema';

export class ProfilesRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createProfile(profile: Profile) {
    await this.db.insert(profiles).values(profile);
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
