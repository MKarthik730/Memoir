"""
Database Migration Script
Fixes the filestore table schema by removing incorrect user_id column
Run this script ONCE before starting the application
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
            
            with conn.begin():
                # Drop the user_id column
                conn.execute(text("ALTER TABLE filestore DROP COLUMN IF EXISTS user_id CASCADE"))
            
            print("✓ user_id column removed successfully")
        else:
            print("\n✓ filestore table schema is correct")
        
        # Verify final schema
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
