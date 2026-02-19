"""
Database Migration Script
Fixes the filestore table schema by removing incorrect user_id column
Run this script ONCE before starting the application
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect, MetaData, Table, Column, Integer

# Load environment variables
load_dotenv()

DB_URL = os.getenv("DB_URL")
if not DB_URL:
    print("ERROR: DB_URL not found in .env file")
    sys.exit(1)

print("=" * 60)
print("Memoir Database Migration - Fix FileStore Table")
print("=" * 60)

try:
    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # Check if filestore table exists
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        if 'filestore' not in tables:
            print("✓ filestore table does not exist - will be created fresh")
            print("✓ No migration needed - run the application to create tables")
            sys.exit(0)

        # Check current columns
        columns = [col['name'] for col in inspector.get_columns('filestore')]
        print(f"\nCurrent filestore columns: {columns}")

        # Check if user_id column exists (it shouldn't)
        if 'user_id' in columns:
            print("\n⚠ Found incorrect 'user_id' column in filestore table")
            print("⚠ This column should not exist - filestore links to person, not user")

            response = input("\nDo you want to remove the user_id column? (yes/no): ")
            if response.lower() != 'yes':
                print("Migration cancelled")
                sys.exit(0)

            print("\n🔧 Removing user_id column from filestore...")

            # Use a transaction to ensure the change is committed
            with conn.begin():
                # First, check if there are any constraints on user_id
                constraints = inspector.get_foreign_keys('filestore')
                for constraint in constraints:
                    if 'user_id' in constraint['constrained_columns']:
                        print(f"  Dropping foreign key constraint: {constraint['name']}")
                        conn.execute(text(f"ALTER TABLE filestore DROP CONSTRAINT IF EXISTS {constraint['name']}"))

                # Drop the user_id column
                try:
                    conn.execute(text("ALTER TABLE filestore DROP COLUMN user_id"))
                    print("✓ user_id column removed successfully")
                except Exception as e:
                    print(f"⚠ Could not drop column with ALTER: {e}")
                    print("  Trying to recreate table without user_id...")

                    # Backup data
                    result = conn.execute(text("SELECT id, file_name, file_data, file_type, description, created_at, person_id FROM filestore"))
                    backup_data = result.fetchall()

                    # Drop and recreate table
                    conn.execute(text("DROP TABLE filestore"))

                    # Recreate table without user_id
                    conn.execute(text("""
                        CREATE TABLE filestore (
                            id SERIAL PRIMARY KEY,
                            file_name VARCHAR NOT NULL,
                            file_data BYTEA NOT NULL,
                            file_type VARCHAR NOT NULL,
                            description TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE
                        )
                    """))

                    # Restore data
                    for row in backup_data:
                        conn.execute(text("""
                            INSERT INTO filestore (id, file_name, file_data, file_type, description, created_at, person_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """), (row[0], row[1], row[2], row[3], row[4], row[5], row[6]))

                    print("✓ Table recreated and data restored")
        else:
            print("\n✓ filestore table schema is correct")

        # Verify final schema
        inspector = inspect(engine)  # Re-inspect after changes
        columns = [col['name'] for col in inspector.get_columns('filestore')]
        expected = ['id', 'file_name', 'file_data', 'file_type', 'description', 'created_at', 'person_id']

        print(f"\nFinal filestore columns: {columns}")

        missing = set(expected) - set(columns)
        extra = set(columns) - set(expected)

        if missing:
            print(f"⚠ Missing columns: {missing}")
        if extra:
            print(f"⚠ Extra columns: {extra}")

        if not missing and not extra:
            print("\n✅ FileStore table schema is correct!")

except Exception as e:
    print(f"\n❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("Migration completed successfully")
print("You can now run: python run.py")
print("=" * 60)