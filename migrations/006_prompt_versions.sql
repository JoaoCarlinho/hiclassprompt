-- Create prompts_versions table in PostgreSQL
CREATE TABLE IF NOT EXISTS prompts_versions (
  id SERIAL PRIMARY KEY,
  prompt_id VARCHAR(255) NOT NULL,
  version_number INTEGER NOT NULL,
  parent_version_id INTEGER REFERENCES prompts_versions(id),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  diff_from_parent TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  commit_message TEXT,
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,

  UNIQUE(prompt_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_prompts_versions_prompt_id ON prompts_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompts_versions_created_at ON prompts_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_versions_created_by ON prompts_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_prompts_versions_tags ON prompts_versions USING GIN(tags);

-- Create prompts_snapshots table for active prompts
CREATE TABLE IF NOT EXISTS prompts_snapshots (
  prompt_id VARCHAR(255) PRIMARY KEY,
  current_version_id INTEGER REFERENCES prompts_versions(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create prompts_branches table for parallel development
CREATE TABLE IF NOT EXISTS prompts_branches (
  id SERIAL PRIMARY KEY,
  prompt_id VARCHAR(255) NOT NULL,
  branch_name VARCHAR(100) NOT NULL,
  base_version_id INTEGER REFERENCES prompts_versions(id),
  head_version_id INTEGER REFERENCES prompts_versions(id),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  merged_at TIMESTAMP,

  UNIQUE(prompt_id, branch_name)
);

-- Add comments for documentation
COMMENT ON TABLE prompts_versions IS 'Stores all versions of prompts with Git-like version control';
COMMENT ON TABLE prompts_snapshots IS 'Tracks the current/active version of each prompt';
COMMENT ON TABLE prompts_branches IS 'Manages parallel development branches for prompts';
