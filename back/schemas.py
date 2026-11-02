from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

PaymentMethod = Literal["Caja - Efectivo", "Banco"]


class SchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProductBase(SchemaBase):
    name: str
    category: str
    purchase_price: float = Field(gt=0)
    sale_price: float = Field(gt=0)
    max_discount: float = Field(default=0.0, ge=0, le=100)
    stock: int = Field(default=0, ge=0)
    active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int


class SupplierBase(SchemaBase):
    name: str
    contact_info: str | None = None
    phone: str | None = None
    pickup_address: str | None = None


class SupplierCreate(SupplierBase):
    pass


class SupplierResponse(SupplierBase):
    id: int


class CustomerBase(SchemaBase):
    name: str
    contact_info: str | None = None
    phone: str | None = None
    shipping_address: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: int


class SellerBase(SchemaBase):
    name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=50)
    commission_percentage: float = Field(ge=0, le=100)


class SellerCreate(SellerBase):
    pass


class SellerResponse(SellerBase):
    id: int


class VendorBase(SchemaBase):
    name: str
    email: EmailStr
    commission_percentage: float = Field(ge=0, le=100)


class VendorCreate(VendorBase):
    pass


class VendorResponse(VendorBase):
    id: int


class SellerSettlementItem(SchemaBase):
    seller_id: int
    seller_name: str
    sales_count: int
    total_sales: float
    commission_percentage: float
    commission_amount: float
    paid_amount: float
    amount_to_settle: float


class SellerSettlementResponse(SchemaBase):
    total_commissions: float
    sellers: list[SellerSettlementItem]


class SellerSettlementPaymentResponse(SchemaBase):
    id: int
    seller_id: int
    amount: float
    paid_at: datetime


class PurchaseItemCreate(SchemaBase):
    product_id: int
    quantity: int = Field(gt=0)
    unit_cost: float = Field(gt=0)


class PurchaseItemResponse(PurchaseItemCreate):
    id: int
    purchase_id: int


class PurchaseCreate(SchemaBase):
    supplier_id: int
    purchase_date: datetime | None = None
    total_amount: float = Field(gt=0)
    payment_method: PaymentMethod
    items: list[PurchaseItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def total_matches_items(self):
        items_total = sum(
            (Decimal(str(item.unit_cost)) * item.quantity for item in self.items),
            Decimal("0"),
        )
        if items_total.quantize(Decimal("0.01")) != Decimal(
            str(self.total_amount)
        ).quantize(Decimal("0.01")):
            raise ValueError("El total debe coincidir con la suma de los artículos")
        return self


class PurchaseResponse(PurchaseCreate):
    id: int
    purchase_date: datetime
    is_cancelled: bool
    cancelled_at: datetime | None
    items: list[PurchaseItemResponse]


class SaleItemCreate(SchemaBase):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)
    discount_percentage: float = Field(default=0.0, ge=0, lt=100)


class SaleItemResponse(SaleItemCreate):
    id: int
    sale_id: int


class SaleCreate(SchemaBase):
    customer_id: int
    seller_id: int | None = None
    vendor_id: int | None = None
    sale_date: datetime | None = None
    total_amount: float = Field(gt=0)
    payment_method: PaymentMethod
    items: list[SaleItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def total_matches_items(self):
        if self.seller_id is None and self.vendor_id is None:
            raise ValueError("Se debe indicar un vendedor")
        if (
            self.seller_id is not None
            and self.vendor_id is not None
            and self.seller_id != self.vendor_id
        ):
            raise ValueError(
                "seller_id y vendor_id deben identificar al mismo vendedor"
            )

        items_total = sum(
            (Decimal(str(item.unit_price)) * item.quantity for item in self.items),
            Decimal("0"),
        )
        if items_total.quantize(Decimal("0.01")) != Decimal(
            str(self.total_amount)
        ).quantize(Decimal("0.01")):
            raise ValueError("El total debe coincidir con la suma de los artículos")
        return self


class SaleResponse(SaleCreate):
    id: int
    seller_id: int
    vendor_id: int
    sale_date: datetime
    is_cancelled: bool
    cancelled_at: datetime | None
    items: list[SaleItemResponse]
