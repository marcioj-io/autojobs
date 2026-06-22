import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { runtimeState } from '../schema';
import type { RuntimeStateModel } from '../schema';

export class RuntimeStateRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async getState(id: string) {
    return this.db.select().from(runtimeState).where(eq(runtimeState.id, id)).get();
  }

  async upsertState(state: RuntimeStateModel) {
    const existing = await this.getState(state.id);
    if (existing) {
      await this.db.update(runtimeState).set(state).where(eq(runtimeState.id, state.id));
    } else {
      await this.db.insert(runtimeState).values(state);
    }
  }

  async patchState(id: string, patch: Partial<Omit<RuntimeStateModel, 'id' | 'createdAt'>>) {
    await this.db.update(runtimeState).set(patch).where(eq(runtimeState.id, id));
  }
}
