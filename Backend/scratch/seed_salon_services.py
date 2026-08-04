import uuid
from sqlalchemy import text
from app.db.database import engine

DEMO_SERVICES = [
  # Hair
  {"name": "Gentlemen Haircut & Beard Styling", "category_name": "Hair", "duration_minutes": 45, "price": 499, "description": "Precision haircut, hot towel wash, and custom beard shaping with premium oil finish."},
  {"name": "Luxury Hair Spa & Scalp Therapy", "category_name": "Hair", "duration_minutes": 60, "price": 1299, "description": "Deep nourishing steam treatment, argon oil scalp massage, and blow dry finish."},
  {"name": "Global Hair Color & Highlights", "category_name": "Hair", "duration_minutes": 90, "price": 2499, "description": "Ammonia-free vibrant hair coloring with gloss shine coat."},

  # Skin
  {"name": "Hydra-Glow Facial & De-tan", "category_name": "Skin", "duration_minutes": 60, "price": 1599, "description": "Deep pore cleansing, ultrasonic exfoliation, serum hydration, and cool ice-globe therapy."},
  {"name": "Gold Radiance Organic Facial", "category_name": "Skin", "duration_minutes": 75, "price": 2199, "description": "24k gold leaf infusion with herbal face pack for instant luminous complexion."},

  # Nails
  {"name": "Gel Manicure & Nail Art", "category_name": "Nails", "duration_minutes": 50, "price": 899, "description": "Cuticle care, nail shaping, long-lasting gel polish, and custom accent nail art."},
  {"name": "Luxury Spa Pedicure", "category_name": "Nails", "duration_minutes": 60, "price": 1099, "description": "Herbal foot soak, scrub exfoliation, massage, and polish application."},

  # Spa
  {"name": "Aromatherapy Full Body Spa", "category_name": "Spa", "duration_minutes": 60, "price": 1999, "description": "Relaxing full body essential oil massage to relieve tension and stress."},
  {"name": "Deep Tissue & Hot Stone Therapy", "category_name": "Spa", "duration_minutes": 90, "price": 2799, "description": "Therapeutic deep pressure muscle treatment with heated volcanic stones."},

  # Bridal
  {"name": "Royal Bridal Makeup & Styling", "category_name": "Bridal", "duration_minutes": 180, "price": 14999, "description": "HD Airbrush bridal makeup, luxury saree/lehenga draping, and intricate hair styling."},
  {"name": "Pre-Bridal Glow Package", "category_name": "Bridal", "duration_minutes": 150, "price": 7999, "description": "Full body polish, facial, waxing, manicure, and pedicure combo."},

  # Makeup
  {"name": "Party Glam HD Makeup", "category_name": "Makeup", "duration_minutes": 60, "price": 2999, "description": "High-definition party makeup with false lashes and hair styling."},

  # Grooming
  {"name": "Executive Grooming Combo", "category_name": "Grooming", "duration_minutes": 60, "price": 999, "description": "Haircut, beard trim, charcoal face mask, and head massage."},
]

def main():
    with engine.connect() as conn:
        # 1. Fetch businesses
        res = conn.execute(text("SELECT id, name, business_type_id FROM businesses;"))
        businesses = res.fetchall()
        print("Found businesses:", len(businesses))

        for biz in businesses:
            biz_id = str(biz[0])
            biz_name = biz[1]
            print(f"\nProcessing Business: {biz_name} ({biz_id})")

            # Fetch or Seed Categories
            res = conn.execute(text("SELECT id, name FROM salon_service_categories WHERE business_id = :bid"), {"bid": biz_id})
            categories = {row[1].lower(): str(row[0]) for row in res.fetchall()}
            print("Existing Categories:", categories)

            # Ensure standard categories exist
            cat_names = ["Hair", "Skin", "Nails", "Spa", "Bridal", "Makeup", "Grooming"]
            for idx, cat_name in enumerate(cat_names):
                if cat_name.lower() not in categories:
                    cid = str(uuid.uuid4())
                    conn.execute(text("""
                        INSERT INTO salon_service_categories (id, business_id, name, display_order, is_active, created_at, updated_at)
                        VALUES (:id, :bid, :name, :dorder, true, NOW(), NOW())
                    """), {"id": cid, "bid": biz_id, "name": cat_name, "dorder": idx})
                    categories[cat_name.lower()] = cid
                    print(f"Created category '{cat_name}' with ID {cid}")

            conn.commit()

            # Seed / Link services
            for item in DEMO_SERVICES:
                cname = item["category_name"]
                cat_id = categories.get(cname.lower())

                # Check if service already exists
                check = conn.execute(text("SELECT id FROM services WHERE business_id = :bid AND name = :name"), {"bid": biz_id, "name": item["name"]}).fetchone()
                if not check:
                    sid = str(uuid.uuid4())
                    conn.execute(text("""
                        INSERT INTO services (id, business_id, category_id, name, description, price, duration_minutes, category, is_active, created_at, updated_at)
                        VALUES (:id, :bid, :cat_id, :name, :desc, :price, :dur, :cat, true, NOW(), NOW())
                    """), {
                        "id": sid,
                        "bid": biz_id,
                        "cat_id": cat_id,
                        "name": item["name"],
                        "desc": item["description"],
                        "price": item["price"],
                        "dur": item["duration_minutes"],
                        "cat": cname,
                    })
                    print(f"Added service: {item['name']} ({cname})")
                else:
                    # Update category_id if null
                    conn.execute(text("UPDATE services SET category_id = :cat_id, category = :cat WHERE id = :sid AND category_id IS NULL"), {"cat_id": cat_id, "cat": cname, "sid": check[0]})

            conn.commit()
            print("Successfully seeded/linked services for business!")

if __name__ == "__main__":
    main()
