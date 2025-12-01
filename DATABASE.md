# Database Setup Guide

## File-Based Storage (Default)

By default, pose data is saved to `public/poses/` as JSON files:
- `public/poses/danceone.json`
- `public/poses/dancetwo.json`

**To generate these files:**
```bash
npm run preprocess-files
```

The app automatically loads from these files on startup.

## PostgreSQL Storage (Optional)

If you have a Postgres database, you can use it instead of files.

### Setup

1. **Initialize the database:**
   ```bash
   DATABASE_URL=your_postgres_url npm run init-postgres
   ```

2. **Save pose files to database:**
   ```bash
   DATABASE_URL=your_postgres_url npm run save-to-postgres
   ```

3. **Set environment variable in Railway:**
   - Go to your Railway project
   - Settings → Variables
   - Add: `DATABASE_URL` = your postgres connection string

### Connection String Format

```
postgresql://username:password@host:port/database
```

Example:
```
postgresql://user:pass@localhost:5432/dancebattle
```

### Database Schema

The script creates a table:
```sql
CREATE TABLE poses (
  key VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Priority Order

The app loads poses in this order:
1. **Files** (`public/poses/*.json`) - if they exist
2. **PostgreSQL** - if `DATABASE_URL` is set
3. **IndexedDB** - browser storage (fallback)
4. **localStorage** - browser storage (last resort)

### Benefits of PostgreSQL

- ✅ Centralized storage
- ✅ Easy to update/backup
- ✅ Works across deployments
- ✅ No file size limits
- ✅ Better for production

### Benefits of Files

- ✅ Simple setup
- ✅ No database needed
- ✅ Easy to version control
- ✅ Works offline

