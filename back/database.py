import os
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./artmonia.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)

if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _record) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    pass


def ensure_schema_compatibility() -> None:
    compatibility_columns = {
        "sale_items": {
            "discount_percentage": (
                "FLOAT NOT NULL DEFAULT 0"
            ),
        },
        "suppliers": {
            "phone": "VARCHAR(50)",
            "pickup_address": "VARCHAR(255)",
        },
        "customers": {
            "phone": "VARCHAR(50)",
            "shipping_address": "VARCHAR(255)",
        },
        "vendors": {
            "phone": "VARCHAR(50)",
        },
        "products": {
            "active": "BOOLEAN NOT NULL DEFAULT TRUE",
        },
        "sales": {
            "seller_id": "INTEGER REFERENCES vendors(id)",
            "is_cancelled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "cancelled_at": "DATETIME",
        },
        "purchases": {
            "is_cancelled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "cancelled_at": "DATETIME",
        },
    }

    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, expected_columns in compatibility_columns.items():
            columns = {
                column["name"] for column in inspector.get_columns(table_name)
            }
            for column_name, column_definition in expected_columns.items():
                if column_name not in columns:
                    connection.execute(
                        text(
                            f"ALTER TABLE {table_name} ADD COLUMN "
                            f"{column_name} {column_definition}"
                        )
                    )

        connection.execute(
            text(
                "UPDATE sales SET seller_id = vendor_id "
                "WHERE seller_id IS NULL"
            )
        )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
