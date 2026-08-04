from sqlalchemy import text
from app.db.database import engine

def main():
    with engine.connect() as conn:
        print("Checking services table columns...")
        result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'services';"))
        columns = [row[0] for row in result.fetchall()]
        print("Current services columns:", columns)

        if "category_id" not in columns:
            print("Adding column category_id to services table...")
            conn.execute(text("""
                ALTER TABLE services 
                ADD COLUMN category_id UUID REFERENCES salon_service_categories(id) ON DELETE SET NULL;
            """))
            conn.commit()
            print("Successfully added category_id column!")
        else:
            print("category_id column already exists.")

        # Check existing services count
        res = conn.execute(text("SELECT COUNT(*) FROM services;"))
        count = res.scalar()
        print("Current services count:", count)

if __name__ == "__main__":
    main()
