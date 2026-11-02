import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import Base, engine, ensure_schema_compatibility, get_db
from models import (
    Customer,
    Product,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    Seller,
    SellerSettlementPayment,
    Supplier,
    Vendor,
)
from schemas import (
    CustomerCreate,
    CustomerResponse,
    ProductCreate,
    ProductResponse,
    PurchaseCreate,
    PurchaseResponse,
    SaleCreate,
    SaleResponse,
    SellerCreate,
    SellerResponse,
    SellerSettlementPaymentResponse,
    SellerSettlementResponse,
    SupplierCreate,
    SupplierResponse,
    VendorCreate,
    VendorResponse,
)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    yield


app = FastAPI(title="Art.Monia Decor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def _get_or_404(db: Session, model: type[Base], entity_id: int):
    entity = db.get(model, entity_id)
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{model.__name__} no encontrado",
        )
    return entity


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo completar la operación por una restricción de datos",
        ) from exc


def _sale_seller_id(payload: SaleCreate) -> int:
    seller_id = (
        payload.seller_id
        if payload.seller_id is not None
        else payload.vendor_id
    )
    if seller_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Se debe indicar un vendedor",
        )
    return seller_id


def _sync_stock(db: Session, old_items, new_items, operation: str) -> None:
    old_quantities: dict[int, int] = {}
    new_quantities: dict[int, int] = {}

    for item in old_items:
        old_quantities[item.product_id] = (
            old_quantities.get(item.product_id, 0) + item.quantity
        )

    for item in new_items:
        new_quantities[item.product_id] = (
            new_quantities.get(item.product_id, 0) + item.quantity
        )

    product_ids = old_quantities.keys() | new_quantities.keys()
    changes = []

    for product_id in product_ids:
        product = db.get(Product, product_id)
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto {product_id} no encontrado",
            )

        quantity_change = new_quantities.get(product_id, 0) - old_quantities.get(
            product_id, 0
        )
        stock_change = (
            quantity_change if operation == "purchase" else -quantity_change
        )
        resulting_stock = product.stock + stock_change

        if resulting_stock < 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stock insuficiente para el producto {product_id}",
            )

        changes.append((product, resulting_stock))

    for product, resulting_stock in changes:
        product.stock = resulting_stock


def _create_items(item_schema, item_model):
    return [item_model(**item.model_dump()) for item in item_schema]


def _validate_active_products(db: Session, items, allowed_inactive_ids=()) -> None:
    allowed_inactive_ids = set(allowed_inactive_ids)
    for item in items:
        product = _get_or_404(db, Product, item.product_id)
        if not product.active and product.id not in allowed_inactive_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El producto {product.name} está descontinuado",
            )


def _validate_sale_items(db: Session, items, allowed_inactive_ids=()) -> None:
    allowed_inactive_ids = set(allowed_inactive_ids)
    for item in items:
        product = _get_or_404(db, Product, item.product_id)
        if not product.active and product.id not in allowed_inactive_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El producto {product.name} está descontinuado",
            )
        discount = Decimal(str(item.discount_percentage))
        if discount > Decimal(str(product.max_discount)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"El descuento máximo para {product.name} es "
                    f"{product.max_discount}%"
                ),
            )

        expected_price = (
            Decimal(str(product.sale_price))
            * (Decimal("1") - discount / Decimal("100"))
        ).quantize(Decimal("0.01"))
        submitted_price = Decimal(str(item.unit_price)).quantize(Decimal("0.01"))
        if submitted_price != expected_price:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El precio unitario no coincide con el descuento de {product.name}",
            )


# Products
@app.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    _commit(db)
    db.refresh(product)
    return product


@app.get("/products", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product)).all()


@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Product, product_id)


@app.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int, payload: ProductCreate, db: Session = Depends(get_db)
):
    product = _get_or_404(db, Product, product_id)
    for field, value in payload.model_dump().items():
        setattr(product, field, value)
    _commit(db)
    db.refresh(product)
    return product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = _get_or_404(db, Product, product_id)
    product.active = False
    _commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Suppliers
@app.post(
    "/suppliers",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    _commit(db)
    db.refresh(supplier)
    return supplier


@app.get("/suppliers", response_model=list[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
    return db.scalars(select(Supplier)).all()


@app.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Supplier, supplier_id)


@app.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int, payload: SupplierCreate, db: Session = Depends(get_db)
):
    supplier = _get_or_404(db, Supplier, supplier_id)
    for field, value in payload.model_dump().items():
        setattr(supplier, field, value)
    _commit(db)
    db.refresh(supplier)
    return supplier


@app.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = _get_or_404(db, Supplier, supplier_id)
    db.delete(supplier)
    _commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Customers
@app.post(
    "/customers",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    _commit(db)
    db.refresh(customer)
    return customer


@app.get("/customers", response_model=list[CustomerResponse])
def list_customers(db: Session = Depends(get_db)):
    return db.scalars(select(Customer)).all()


@app.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Customer, customer_id)


@app.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int, payload: CustomerCreate, db: Session = Depends(get_db)
):
    customer = _get_or_404(db, Customer, customer_id)
    for field, value in payload.model_dump().items():
        setattr(customer, field, value)
    _commit(db)
    db.refresh(customer)
    return customer


@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = _get_or_404(db, Customer, customer_id)
    db.delete(customer)
    _commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Sellers
@app.post(
    "/sellers",
    response_model=SellerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_seller(payload: SellerCreate, db: Session = Depends(get_db)):
    # The legacy vendors table requires email; new seller records do not expose it.
    seller = Seller(
        **payload.model_dump(),
        email=f"seller-{uuid.uuid4().hex}@legacy.artmonia.invalid",
    )
    db.add(seller)
    _commit(db)
    db.refresh(seller)
    return seller


@app.get("/sellers", response_model=list[SellerResponse])
def list_sellers(db: Session = Depends(get_db)):
    return db.scalars(select(Seller).order_by(Seller.name)).all()


@app.get("/sellers/settlement", response_model=SellerSettlementResponse)
def get_sellers_settlement(db: Session = Depends(get_db)):
    sales_rows = db.execute(
        select(
            Seller.id,
            Seller.name,
            Seller.commission_percentage,
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.total_amount), 0.0),
        )
        .outerjoin(
            Sale,
            (Sale.seller_id == Seller.id) & (Sale.is_cancelled.is_(False)),
        )
        .group_by(Seller.id)
        .order_by(Seller.name)
    ).all()
    payments_by_seller = dict(
        db.execute(
            select(
                SellerSettlementPayment.seller_id,
                func.coalesce(func.sum(SellerSettlementPayment.amount), 0.0),
            ).group_by(SellerSettlementPayment.seller_id)
        ).all()
    )

    sellers = []
    total_commissions = Decimal("0")
    for (
        seller_id,
        seller_name,
        commission_percentage,
        sales_count,
        total_sales,
    ) in sales_rows:
        sales_total = Decimal(str(total_sales)).quantize(Decimal("0.01"))
        commission = (
            sales_total * Decimal(str(commission_percentage)) / Decimal("100")
        ).quantize(Decimal("0.01"))
        paid = Decimal(str(payments_by_seller.get(seller_id, 0.0))).quantize(
            Decimal("0.01")
        )
        amount_to_settle = max(Decimal("0"), commission - paid)
        total_commissions += amount_to_settle
        sellers.append(
            {
                "seller_id": seller_id,
                "seller_name": seller_name,
                "sales_count": sales_count,
                "total_sales": float(sales_total),
                "commission_percentage": commission_percentage,
                "commission_amount": float(commission),
                "paid_amount": float(paid),
                "amount_to_settle": float(amount_to_settle),
            }
        )

    return {
        "total_commissions": float(total_commissions),
        "sellers": sellers,
    }


@app.post(
    "/sellers/{seller_id}/payments",
    response_model=SellerSettlementPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def pay_seller_settlement(seller_id: int, db: Session = Depends(get_db)):
    seller = _get_or_404(db, Seller, seller_id)
    sales_total = Decimal(
        str(
            db.scalar(
                select(func.coalesce(func.sum(Sale.total_amount), 0.0)).where(
                    Sale.seller_id == seller_id,
                    Sale.is_cancelled.is_(False),
                )
            )
        )
    )
    commission = (
        sales_total
        * Decimal(str(seller.commission_percentage))
        / Decimal("100")
    ).quantize(Decimal("0.01"))
    paid = Decimal(
        str(
            db.scalar(
                select(
                    func.coalesce(func.sum(SellerSettlementPayment.amount), 0.0)
                ).where(SellerSettlementPayment.seller_id == seller_id)
            )
        )
    ).quantize(Decimal("0.01"))
    amount_to_settle = max(Decimal("0"), commission - paid)
    if amount_to_settle <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este vendedor no tiene comisiones pendientes de pago",
        )

    payment = SellerSettlementPayment(
        seller_id=seller_id,
        amount=float(amount_to_settle),
    )
    db.add(payment)
    _commit(db)
    db.refresh(payment)
    return payment


@app.get("/sellers/{seller_id}", response_model=SellerResponse)
def get_seller(seller_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Seller, seller_id)


@app.put("/sellers/{seller_id}", response_model=SellerResponse)
def update_seller(
    seller_id: int, payload: SellerCreate, db: Session = Depends(get_db)
):
    seller = _get_or_404(db, Seller, seller_id)
    for field, value in payload.model_dump().items():
        setattr(seller, field, value)
    _commit(db)
    db.refresh(seller)
    return seller


@app.delete("/sellers/{seller_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_seller(seller_id: int, db: Session = Depends(get_db)):
    seller = _get_or_404(db, Seller, seller_id)
    db.delete(seller)
    _commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Vendors
@app.post(
    "/vendors",
    response_model=VendorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_vendor(payload: VendorCreate, db: Session = Depends(get_db)):
    vendor = Vendor(**payload.model_dump())
    db.add(vendor)
    _commit(db)
    db.refresh(vendor)
    return vendor


@app.get("/vendors", response_model=list[VendorResponse])
def list_vendors(db: Session = Depends(get_db)):
    return db.scalars(select(Vendor)).all()


@app.get("/vendors/{vendor_id}", response_model=VendorResponse)
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Vendor, vendor_id)


@app.put("/vendors/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int, payload: VendorCreate, db: Session = Depends(get_db)
):
    vendor = _get_or_404(db, Vendor, vendor_id)
    for field, value in payload.model_dump().items():
        setattr(vendor, field, value)
    _commit(db)
    db.refresh(vendor)
    return vendor


@app.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = _get_or_404(db, Vendor, vendor_id)
    db.delete(vendor)
    _commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Purchases
@app.post(
    "/purchases",
    response_model=PurchaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db)):
    _get_or_404(db, Supplier, payload.supplier_id)
    _validate_active_products(db, payload.items)
    _sync_stock(db, [], payload.items, "purchase")

    purchase_data = payload.model_dump(exclude={"items", "purchase_date"})
    purchase = Purchase(**purchase_data)
    if payload.purchase_date is not None:
        purchase.purchase_date = payload.purchase_date
    purchase.items = _create_items(payload.items, PurchaseItem)

    db.add(purchase)
    _commit(db)
    db.refresh(purchase)
    return purchase


@app.get("/purchases", response_model=list[PurchaseResponse])
def list_purchases(db: Session = Depends(get_db)):
    return db.scalars(select(Purchase)).all()


@app.get("/purchases/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(purchase_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Purchase, purchase_id)


@app.put("/purchases/{purchase_id}", response_model=PurchaseResponse)
def update_purchase(
    purchase_id: int, payload: PurchaseCreate, db: Session = Depends(get_db)
):
    purchase = _get_or_404(db, Purchase, purchase_id)
    if purchase.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede editar una compra anulada",
        )
    _get_or_404(db, Supplier, payload.supplier_id)
    _validate_active_products(
        db,
        payload.items,
        allowed_inactive_ids={item.product_id for item in purchase.items},
    )
    _sync_stock(db, purchase.items, payload.items, "purchase")

    purchase_data = payload.model_dump(exclude={"items", "purchase_date"})
    for field, value in purchase_data.items():
        setattr(purchase, field, value)
    if payload.purchase_date is not None:
        purchase.purchase_date = payload.purchase_date
    purchase.items = _create_items(payload.items, PurchaseItem)

    _commit(db)
    db.refresh(purchase)
    return purchase


@app.post("/purchases/{purchase_id}/cancel", response_model=PurchaseResponse)
def cancel_purchase(purchase_id: int, db: Session = Depends(get_db)):
    purchase = _get_or_404(db, Purchase, purchase_id)
    if not purchase.is_cancelled:
        _sync_stock(db, purchase.items, [], "purchase")
        purchase.is_cancelled = True
        purchase.cancelled_at = datetime.now(timezone.utc)
        _commit(db)
        db.refresh(purchase)
    return purchase


@app.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(purchase_id: int, db: Session = Depends(get_db)):
    cancel_purchase(purchase_id, db)
    _commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Sales
@app.post(
    "/sales",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    seller_id = _sale_seller_id(payload)
    _get_or_404(db, Customer, payload.customer_id)
    _get_or_404(db, Seller, seller_id)
    _validate_sale_items(db, payload.items)
    _sync_stock(db, [], payload.items, "sale")

    sale_data = payload.model_dump(
        exclude={"items", "sale_date", "seller_id", "vendor_id"}
    )
    sale_data["seller_id"] = seller_id
    sale_data["vendor_id"] = seller_id
    sale = Sale(**sale_data)
    if payload.sale_date is not None:
        sale.sale_date = payload.sale_date
    sale.items = _create_items(payload.items, SaleItem)

    db.add(sale)
    _commit(db)
    db.refresh(sale)
    return sale


@app.get("/sales", response_model=list[SaleResponse])
def list_sales(db: Session = Depends(get_db)):
    return db.scalars(select(Sale)).all()


@app.get("/sales/{sale_id}", response_model=SaleResponse)
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Sale, sale_id)


@app.put("/sales/{sale_id}", response_model=SaleResponse)
def update_sale(sale_id: int, payload: SaleCreate, db: Session = Depends(get_db)):
    sale = _get_or_404(db, Sale, sale_id)
    if sale.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede editar una venta anulada",
        )
    seller_id = _sale_seller_id(payload)
    _get_or_404(db, Customer, payload.customer_id)
    _get_or_404(db, Seller, seller_id)
    _validate_sale_items(
        db,
        payload.items,
        allowed_inactive_ids={item.product_id for item in sale.items},
    )
    _sync_stock(db, sale.items, payload.items, "sale")

    sale_data = payload.model_dump(
        exclude={"items", "sale_date", "seller_id", "vendor_id"}
    )
    for field, value in sale_data.items():
        setattr(sale, field, value)
    sale.seller_id = seller_id
    sale.vendor_id = seller_id
    if payload.sale_date is not None:
        sale.sale_date = payload.sale_date
    sale.items = _create_items(payload.items, SaleItem)

    _commit(db)
    db.refresh(sale)
    return sale


@app.post("/sales/{sale_id}/cancel", response_model=SaleResponse)
def cancel_sale(sale_id: int, db: Session = Depends(get_db)):
    sale = _get_or_404(db, Sale, sale_id)
    if not sale.is_cancelled:
        _sync_stock(db, sale.items, [], "sale")
        sale.is_cancelled = True
        sale.cancelled_at = datetime.now(timezone.utc)
        _commit(db)
        db.refresh(sale)
    return sale


@app.delete("/sales/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(sale_id: int, db: Session = Depends(get_db)):
    cancel_sale(sale_id, db)
    _commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
