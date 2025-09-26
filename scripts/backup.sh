#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BACKUP_BUCKET:-}" ]]; then
  echo "BACKUP_BUCKET environment variable is required" >&2
  exit 1
fi

TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
WORKDIR="${BACKUP_WORKDIR:-/tmp}/portal-backup-${TIMESTAMP}"
mkdir -p "$WORKDIR"

# Database backup (PostgreSQL example)
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Exporting database snapshot..."
  pg_dump "$DATABASE_URL" >"$WORKDIR/database.sql"
else
  echo "Skipping database export because DATABASE_URL is not set" >&2
fi

# Application assets (if stored locally)
if [[ -d "${ASSET_DIR:-public/uploads}" ]]; then
  echo "Archiving asset directory..."
  tar -czf "$WORKDIR/assets.tar.gz" -C "${ASSET_DIR:-public/uploads}" .
else
  echo "Asset directory not found; skipping asset archive" >&2
fi

ARCHIVE_PATH="${WORKDIR}.tar.gz"
tar -czf "$ARCHIVE_PATH" -C "${WORKDIR}" .

S3_URI="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX:-portal}/daily/${TIMESTAMP}.tar.gz"
echo "Uploading backup to ${S3_URI}"
aws s3 cp "$ARCHIVE_PATH" "$S3_URI" --storage-class STANDARD_IA --sse AES256

echo "Backup completed successfully."
