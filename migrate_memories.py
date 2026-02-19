"""
Database Migration Script
Adds the memories table for text memories
Run this script ONCE after updating the models
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect

# Load environment variables
load_dotenv()

DB_URL = os.getenv("DB_URL")
if not DB_URL:
    print("ERROR: DB_URL not found in .env file")
    sys.exit(1)

print("=" * 60)
print("Memoir Database Migration - Add Memories Table")
print("=" * 60)

try:
    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # Check if memories table exists
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        if 'memories' in tables:
            print("✓ memories table already exists")
            columns = [col['name'] for col in inspector.get_columns('memories')]
            print(f"Current memories columns: {columns}")

            expected = ['id', 'content', 'created_at', 'person_id']
            missing = set(expected) - set(columns)
            if missing:
                print(f"⚠ Missing columns: {missing}")
            else:
                print("✅ Memories table schema is correct!")
        else:
            print("🔧 Creating memories table...")

            # Create the memories table
            conn.execute(text("""
                CREATE TABLE memories (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE
                )
            """))

            # Create index on person_id
            conn.execute(text("CREATE INDEX idx_memories_person_id ON memories(person_id)"))

            print("✅ Memories table created successfully!")

except Exception as e:
    print(f"\n❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("Migration completed successfully")
print("You can now run: python run.py")
print("=" * 60)