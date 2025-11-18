import { Pool, PoolClient } from 'pg';
import * as diff from 'diff';

export interface PromptVersion {
  id: number;
  promptId: string;
  versionNumber: number;
  parentVersionId?: number;
  content: string;
  metadata: Record<string, any>;
  diffFromParent?: string;
  createdBy: string;
  createdAt: Date;
  commitMessage?: string;
  tags: string[];
  isPublished: boolean;
}

export interface CreateVersionOptions {
  promptId: string;
  content: string;
  commitMessage: string;
  createdBy: string;
  tags?: string[];
  parentVersionId?: number;
  metadata?: Record<string, any>;
}

export class PromptVersionService {
  constructor(private db: Pool) {}

  /**
   * Create a new version of a prompt
   */
  async createVersion(options: CreateVersionOptions): Promise<PromptVersion> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get the current version number
      const { rows: [lastVersion] } = await client.query(
        `SELECT id, version_number, content FROM prompts_versions
         WHERE prompt_id = $1
         ORDER BY version_number DESC
         LIMIT 1`,
        [options.promptId]
      );

      const versionNumber = lastVersion ? lastVersion.version_number + 1 : 1;
      const parentVersionId = options.parentVersionId || lastVersion?.id;

      // Calculate diff from parent
      let diffFromParent: string | undefined;
      if (lastVersion) {
        const patches = diff.createPatch(
          'prompt',
          lastVersion.content,
          options.content,
          'Previous version',
          'Current version'
        );
        diffFromParent = patches;
      }

      // Insert new version
      const { rows: [newVersion] } = await client.query(
        `INSERT INTO prompts_versions (
          prompt_id, version_number, parent_version_id, content,
          metadata, diff_from_parent, created_by, commit_message, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          options.promptId,
          versionNumber,
          parentVersionId,
          options.content,
          JSON.stringify(options.metadata || {}),
          diffFromParent,
          options.createdBy,
          options.commitMessage,
          options.tags || []
        ]
      );

      // Update the current snapshot
      await client.query(
        `INSERT INTO prompts_snapshots (prompt_id, current_version_id, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (prompt_id)
         DO UPDATE SET current_version_id = $2, updated_at = NOW()`,
        [options.promptId, newVersion.id, options.promptId]
      );

      await client.query('COMMIT');

      return this.mapRowToVersion(newVersion);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get version history for a prompt
   */
  async getVersionHistory(
    promptId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ versions: PromptVersion[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const { rows: versions } = await this.db.query(
      `SELECT * FROM prompts_versions
       WHERE prompt_id = $1
       ORDER BY version_number DESC
       LIMIT $2 OFFSET $3`,
      [promptId, limit, offset]
    );

    const { rows: [{ count }] } = await this.db.query(
      'SELECT COUNT(*) as count FROM prompts_versions WHERE prompt_id = $1',
      [promptId]
    );

    return {
      versions: versions.map(this.mapRowToVersion),
      total: parseInt(count)
    };
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: number): Promise<PromptVersion | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM prompts_versions WHERE id = $1',
      [versionId]
    );

    return rows.length > 0 ? this.mapRowToVersion(rows[0]) : null;
  }

  /**
   * Compare two versions
   */
  async compareVersions(versionId1: number, versionId2: number) {
    const [version1, version2] = await Promise.all([
      this.getVersion(versionId1),
      this.getVersion(versionId2)
    ]);

    if (!version1 || !version2) {
      throw new Error('Version not found');
    }

    const patches = diff.createPatch(
      'prompt',
      version1.content,
      version2.content,
      `Version ${version1.versionNumber}`,
      `Version ${version2.versionNumber}`
    );

    const changes = diff.diffLines(version1.content, version2.content);

    return {
      version1: {
        id: version1.id,
        versionNumber: version1.versionNumber,
        createdAt: version1.createdAt,
        createdBy: version1.createdBy
      },
      version2: {
        id: version2.id,
        versionNumber: version2.versionNumber,
        createdAt: version2.createdAt,
        createdBy: version2.createdBy
      },
      patch: patches,
      changes
    };
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(
    promptId: string,
    versionId: number,
    createdBy: string,
    commitMessage: string
  ): Promise<PromptVersion> {
    const targetVersion = await this.getVersion(versionId);

    if (!targetVersion || targetVersion.promptId !== promptId) {
      throw new Error('Invalid version for rollback');
    }

    return this.createVersion({
      promptId,
      content: targetVersion.content,
      commitMessage: `Rollback to version ${targetVersion.versionNumber}: ${commitMessage}`,
      createdBy,
      tags: ['rollback'],
      metadata: {
        rolledBackFrom: versionId,
        rolledBackToVersion: targetVersion.versionNumber
      }
    });
  }

  /**
   * Create a branch
   */
  async createBranch(
    promptId: string,
    branchName: string,
    baseVersionId: number,
    createdBy: string
  ) {
    const { rows: [branch] } = await this.db.query(
      `INSERT INTO prompts_branches (prompt_id, branch_name, base_version_id, head_version_id, created_by)
       VALUES ($1, $2, $3, $3, $4)
       RETURNING *`,
      [promptId, branchName, baseVersionId, createdBy]
    );

    return branch;
  }

  /**
   * Tag a version
   */
  async tagVersion(versionId: number, tags: string[]): Promise<void> {
    await this.db.query(
      'UPDATE prompts_versions SET tags = array_cat(tags, $1) WHERE id = $2',
      [tags, versionId]
    );
  }

  /**
   * Publish a version
   */
  async publishVersion(versionId: number): Promise<void> {
    await this.db.query(
      'UPDATE prompts_versions SET is_published = true WHERE id = $1',
      [versionId]
    );
  }

  private mapRowToVersion(row: any): PromptVersion {
    return {
      id: row.id,
      promptId: row.prompt_id,
      versionNumber: row.version_number,
      parentVersionId: row.parent_version_id,
      content: row.content,
      metadata: row.metadata,
      diffFromParent: row.diff_from_parent,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      commitMessage: row.commit_message,
      tags: row.tags || [],
      isPublished: row.is_published
    };
  }
}
