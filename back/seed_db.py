import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine, ensure_schema_compatibility
from models import Customer, Product, Supplier, Vendor

INITIAL_DATA = (
    (
        Product,
        "name",
        [
            {
                "name": "Jarrón de cerámica",
                "category": "Decoración",
                "purchase_price": 12.50,
                "sale_price": 24.99,
                "max_discount": 10.0,
                "stock": 15,
            },
            {
                "name": "Vela aromática",
                "category": "Iluminación",
                "purchase_price": 6.00,
                "sale_price": 14.99,
                "max_discount": 5.0,
                "stock": 30,
            },
            {
                "name": "Cojín decorativo",
                "category": "Textiles",
                "purchase_price": 9.75,
                "sale_price": 19.99,
                "max_discount": 10.0,
                "stock": 20,
            },
        ],
    ),
    (
        Supplier,
        "name",
        [
            {
                "name": "Hogar y Diseño",
                "contact_info": "contacto@hogarydiseno.example",
            },
            {
                "name": "Cerámicas del Sur",
                "contact_info": "Tel. +34 600 123 456",
            },
        ],
    ),
    (
        Customer,
        "name",
        [
            {
                "name": "Laura Martínez",
                "contact_info": "laura.martinez@example.com",
            },
            {
                "name": "Carlos Gómez",
                "contact_info": "carlos.gomez@example.com",
            },
        ],
    ),
    (
        Vendor,
        "email",
        [
            {
                "name": "Ana López",
                "email": "ana.lopez@example.com",
                "commission_percentage": 5.0,
            },
            {
                "name": "María Torres",
                "email": "maria.torres@example.com",
                "commission_percentage": 7.5,
            },
        ],
    ),
)


def seed_database(db: Session) -> None:
    for model, lookup_field, records in INITIAL_DATA:
        column = getattr(model, lookup_field)

        for record in records:
            existing = db.scalar(
                select(model).where(column == record[lookup_field])
            )
            if existing is None:
                db.add(model(**record))

    db.commit()


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    db = SessionLocal()

    try:
        seed_database(db)
        print("Datos iniciales cargados correctamente.")
    except Exception as exc:
        db.rollback()
        print(f"Error al cargar los datos iniciales: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()