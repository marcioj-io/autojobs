const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const migrationsDir = path.resolve(__dirname, '..', 'migrations');

function readMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations folder not found: ${migrationsDir}`);
  }
  return fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
}

function checkSequential(files) {
  const ids = files.map((file) => {
    const match = /^0*(\d+)-/.exec(file);
    if (!match) {
      throw new Error(`Invalid migration filename (expected NNNN-name.sql): ${file}`);
    }
    return parseInt(match[1], 10);
  });

  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i] !== ids[0] + i) {
      const expected = String(ids[0] + i).padStart(4, '0');
      throw new Error(`Migration sequence gap at ${files[i]} (expected ${expected})`);
    }
  }
}

async function validate() {
  const files = readMigrationFiles();
  if (files.length === 0) {
    console.warn('No migrations found.');
    return;
  }

  checkSequential(files);

  const SQL = await initSqlJs({ locateFile: (file) => require.resolve(`sql.js/dist/${file}`) });
  const db = new SQL.Database();

  try {
    db.run('PRAGMA foreign_keys = ON;');
    db.run('CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY, filename TEXT NOT NULL, applied_at INTEGER NOT NULL);');

    for (const file of files) {
      const id = file.split('-')[0];
      const result = db.exec(`SELECT 1 FROM __migrations WHERE id = '${id}';`);
      const exists = result.length > 0 && result[0].values.length > 0;
      if (exists) {
        console.log(`Skipping already-applied migration ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying migration ${file}...`);
      try {
        db.run('BEGIN;');
        db.run(sql);
        db.run(`INSERT INTO __migrations (id, filename, applied_at) VALUES ('${id}', '${file}', ${Date.now()});`);
        db.run('COMMIT;');
        console.log(`Applied ${file}`);
      } catch (error) {
        try {
          db.run('ROLLBACK;');
        } catch (_) {
          // ignore rollback failure
        }
        console.error(`Migration ${file} failed:`, error && error.message ? error.message : error);
        throw error;
      }
    }

    console.log('All migrations applied successfully in local SQLite test.');
  } finally {
    db.close();
  }
}

validate().catch((error) => {
  console.error('Migration validation failed:', error && error.message ? error.message : error);
  process.exit(2);
});
