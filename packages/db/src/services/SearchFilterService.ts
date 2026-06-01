import { and, eq } from 'drizzle-orm';
import { searchFilters } from '../schema';
import { randomUUID } from 'crypto';
import type { SearchFilter } from '@autojobs/shared';

export class SearchFilterService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async createSearchFilter(
    profile: string,
    data: Omit<SearchFilter, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SearchFilter> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const newFilter = {
      id,
      profile,
      name: data.name,
      jobTitle: data.jobTitle,
      modalities: data.modalities.join(','),
      cvId: data.cvId,
      useLatestCv: data.useLatestCv ? 1 : 0,
      postedWithinHours: data.postedWithinHours,
      requiredSkills: data.requiredSkills.join(','),
      excludedSkills: data.excludedSkills.join(','),
      seniority: data.seniority.join(','),
      locations: data.locations.join(','),
      excludedCompanies: data.excludedCompanies ? data.excludedCompanies.join(',') : null,
      isActive: data.isActive ? 1 : 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.insert(searchFilters).values(newFilter);

    return this.formatSearchFilter({
      ...newFilter,
      createdAt: now,
      updatedAt: now,
      isActive: data.isActive
    } as any);
  }

  async getSearchFilter(id: string): Promise<SearchFilter | null> {
    const result: any[] = await this.db
      .select()
      .from(searchFilters)
      .where(eq(searchFilters.id, id))
      .limit(1);

    if (!result.length) return null;
    return this.formatSearchFilter(result[0]);
  }

  async getProfileSearchFilters(profile: string): Promise<SearchFilter[]> {
    const results: any[] = await this.db
      .select()
      .from(searchFilters)
      .where(eq(searchFilters.profile, profile));

    return results.map((r: any) => this.formatSearchFilter(r));
  }

  async updateSearchFilter(
    id: string,
    data: Partial<Omit<SearchFilter, 'id' | 'profile' | 'createdAt' | 'updatedAt'>>
  ): Promise<SearchFilter | null> {
    const existing = await this.getSearchFilter(id);
    if (!existing) return null;

    const updates: any = {
      updatedAt: new Date()
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.jobTitle !== undefined) updates.jobTitle = data.jobTitle;
    if (data.modalities !== undefined) updates.modalities = data.modalities.join(',');
    if (data.cvId !== undefined) updates.cvId = data.cvId;
    if (data.useLatestCv !== undefined) updates.useLatestCv = data.useLatestCv ? 1 : 0;
    if (data.postedWithinHours !== undefined) updates.postedWithinHours = data.postedWithinHours;
    if (data.requiredSkills !== undefined) updates.requiredSkills = data.requiredSkills.join(',');
    if (data.excludedSkills !== undefined) updates.excludedSkills = data.excludedSkills.join(',');
    if (data.seniority !== undefined) updates.seniority = data.seniority.join(',');
    if (data.locations !== undefined) updates.locations = data.locations.join(',');
    if (data.excludedCompanies !== undefined) updates.excludedCompanies = data.excludedCompanies ? data.excludedCompanies.join(',') : null;
    if (data.isActive !== undefined) updates.isActive = data.isActive ? 1 : 0;

    await this.db.update(searchFilters).set(updates).where(eq(searchFilters.id, id));

    return this.getSearchFilter(id);
  }

  async deleteSearchFilter(id: string): Promise<boolean> {
    const result = await this.db.delete(searchFilters).where(eq(searchFilters.id, id));
    return !!result;
  }

  private formatSearchFilter(row: any): SearchFilter {
    return {
      id: row.id,
      profile: row.profile,
      name: row.name,
      jobTitle: row.jobTitle,
      modalities: (row.modalities || '').split(',').filter(Boolean),
      cvId: row.cvId,
      useLatestCv: Boolean(row.useLatestCv),
      postedWithinHours: row.postedWithinHours,
      requiredSkills: (row.requiredSkills || '').split(',').filter(Boolean),
      excludedSkills: (row.excludedSkills || '').split(',').filter(Boolean),
      seniority: ((row.seniority || '') as string).split(',').filter(Boolean) as any,
      locations: (row.locations || '').split(',').filter(Boolean),
      excludedCompanies: (row.excludedCompanies || '').split(',').filter(Boolean),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      isActive: Boolean(row.isActive)
    };
  }
}
