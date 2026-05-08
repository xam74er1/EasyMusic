import logging
from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)

def apply_migrations(engine):
    """
    Automatically adds missing columns to tables based on the current models.
    Currently specifically handles the 'videos' table for EaseMusic.
    """
    try:
        inspector = inspect(engine)
        if 'videos' not in inspector.get_table_names():
            logger.info("Table 'videos' does not exist yet. create_all will handle it.")
            return

        columns = [col['name'] for col in inspector.get_columns('videos')]
        
        # List of expected columns and their SQL types
        expected = {
            "spotify_url": "TEXT DEFAULT ''",
            "download_error": "TEXT",
            "added_at": "TEXT DEFAULT ''",
            "profile_id": "TEXT DEFAULT 'master'",
            "additional_profile_ids": "TEXT DEFAULT '[]'"
        }
        
        with engine.connect() as conn:
            changed = False
            for col_name, col_type in expected.items():
                if col_name not in columns:
                    logger.info(self_name := f"Migration: Adding column {col_name} to videos table")
                    conn.execute(text(f"ALTER TABLE videos ADD COLUMN {col_name} {col_type}"))
                    changed = True

            indexes = {
                "ix_videos_category": "CREATE INDEX IF NOT EXISTS ix_videos_category ON videos (category)",
                "ix_videos_title": "CREATE INDEX IF NOT EXISTS ix_videos_title ON videos (title)",
                "ix_videos_is_downloaded": "CREATE INDEX IF NOT EXISTS ix_videos_is_downloaded ON videos (is_downloaded)",
                "ix_videos_profile_id": "CREATE INDEX IF NOT EXISTS ix_videos_profile_id ON videos (profile_id)",
            }
            for idx_name, ddl in indexes.items():
                conn.execute(text(ddl))
                changed = True

            if changed:
                conn.commit()
                logger.info("Database migrations applied successfully.")
                
    except Exception as e:
        logger.error(f"Failed to apply database migrations: {e}")
