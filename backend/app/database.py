import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATABASE_FILE = Path(__file__).resolve().parent / "maxidom.db"

def init_db():
    """
    Initializes the database and creates the 'users' table if it doesn't exist.
    This function is idempotent and safe to run on every application startup.
    """
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        
        # Create the users table for storing profile IDs and hashed passwords.
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                profile_id TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL
            );
        """)
        
        conn.commit()
        conn.close()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)

def save_user_hash(profile_id: str, password_hash: str) -> bool:
    """
    Saves a new user's profile ID and hashed password to the database.
    
    Args:
        profile_id: The user's unique identifier.
        password_hash: The bcrypt hash of the user's password.
        
    Returns:
        True if the save was successful, False if the user already exists.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    try:
        # INSERT OR IGNORE will prevent errors if the user already exists.
        # We check changed rows to see if the insert was successful.
        cursor.execute("INSERT OR IGNORE INTO users (profile_id, password_hash) VALUES (?, ?)", (profile_id, password_hash))
        conn.commit()
        return conn.total_changes > 0
    except Exception as e:
        logger.error(f"Failed to save hash for user {profile_id}: {e}")
        return False
    finally:
        conn.close()

def get_user_hash(profile_id: str) -> str | None:
    """
    Retrieves the stored password hash for a given user.
    
    Args:
        profile_id: The user's unique identifier.
        
    Returns:
        The stored password hash as a string, or None if the user is not found.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT password_hash FROM users WHERE profile_id = ?", (profile_id,))
        result = cursor.fetchone()
        return result[0] if result else None
    except Exception as e:
        logger.error(f"Failed to retrieve hash for user {profile_id}: {e}")
        return None
    finally:
        conn.close()
