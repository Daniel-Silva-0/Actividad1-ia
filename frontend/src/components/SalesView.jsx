import { useEffect, useState } from 'react'
import {
  cancelSale,
  createSale,
  getCustomers,
  getProducts,
  getSales,
  getVendors,
  updateSale,
} from '../services/api.js'

const initialForm = {
  product_id: '',
  quantity: '1',
  discount_percentage: '0',
  customer_id: '',
  vendor_id: '',
  payment_method: 'Caja - Efectivo',
}

function getErrorMessage(error) {
  const detail = error.response?.data?.detail

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ')

  return error.message || 'Ocurrió un error inesperado.'
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

export default function SalesView() {
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editingSale, setEditingSale] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [cancellingSaleId, setCancellingSaleId] = useState(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadData() {
      try {
        const [salesData, productsData, customersData, vendorsData] =
          await Promise.all([
            getSales({ signal: controller.signal }),
            getProducts({ signal: controller.signal }),
            getCustomers({ signal: controller.signal }),
            getVendors({ signal: controller.signal }),
          ])

        setSales(salesData)
        setProducts(productsData)
        setCustomers(customersData)
        setVendors(vendorsData)
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.code !== 'ERR_CANCELED') {
          setError(getErrorMessage(requestError))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadData()
    return () => controller.abort()
  }, [])

  const selectedProduct = products.find(
    (product) => String(product.id) === form.product_id,
  )
  const originalItem = editingSale?.items?.[0]
  const selectableProducts = products.filter(
    (product) => product.active || product.id === originalItem?.product_id,
  )
  const availableStock =
    Number(selectedProduct?.stock ?? 0) +
    (originalItem &&
    String(originalItem.product_id) === form.product_id
      ? Number(originalItem.quantity)
      : 0)
  const quantity = Number(form.quantity)
  const discount = Number(form.discount_percentage)
  const exceedsStock = Boolean(
    selectedProduct && quantity > availableStock,
  )
  const maxDiscount = selectedProduct
    ? Math.min(Number(selectedProduct.max_discount), 99.99)
    : 99.99
  const exceedsDiscount = Boolean(
    selectedProduct && (discount < 0 || discount > maxDiscount),
  )
  const unitPrice = selectedProduct
    ? Number(
        (
          Number(selectedProduct.sale_price) *
          (1 - discount / 100)
        ).toFixed(2),
      )
    : 0
  const saleTotal = Number((unitPrice * quantity).toFixed(2))
  const fullSaleTotal =
    saleTotal +
    (editingSale?.items ?? [])
      .slice(1)
      .reduce(
        (total, item) =>
          total + Number(item.unit_price) * Number(item.quantity),
        0,
      )

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function closeModal() {
    if (isSaving) return
    setIsModalOpen(false)
    setEditingSale(null)
    setForm(initialForm)
    setFormError('')
  }

  function openCreateModal() {
    setEditingSale(null)
    setForm(initialForm)
    setFormError('')
    setIsModalOpen(true)
  }

  function openEditModal(sale) {
    const item = sale.items?.[0]
    if (!item) {
      setError(`No se puede editar la venta #${sale.id}: no contiene artículos.`)
      return
    }

    setEditingSale(sale)
    setForm({
      product_id: String(item.product_id),
      quantity: String(item.quantity),
      discount_percentage: String(item.discount_percentage ?? 0),
      customer_id: String(sale.customer_id),
      vendor_id: String(sale.vendor_id),
      payment_method: sale.payment_method,
    })
    setFormError('')
    setIsModalOpen(true)
  }

  async function handleCancel(sale) {
    if (
      !window.confirm(
        `¿Anular la venta #${sale.id}? Se conservará en el historial y los artículos regresarán al stock.`,
      )
    ) {
      return
    }

    setCancellingSaleId(sale.id)
    try {
      await cancelSale(sale.id)
      setLoading(true)
      setError('')
      await refreshSales()
    } catch (requestError) {
      setError(`No se pudo cancelar la venta: ${getErrorMessage(requestError)}`)
    } finally {
      setCancellingSaleId(null)
      setLoading(false)
    }
  }

  async function refreshSales() {
    const [salesData, productsData] = await Promise.all([
      getSales(),
      getProducts(),
    ])
    setSales(salesData)
    setProducts(productsData)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    if (!selectedProduct) {
      setFormError('Selecciona un producto.')
      return
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setFormError('La cantidad debe ser un número entero mayor que cero.')
      return
    }
    if (exceedsStock) {
      setFormError(
        `La cantidad supera el stock disponible (${availableStock}).`,
      )
      return
    }
    if (!Number.isFinite(discount) || exceedsDiscount) {
      setFormError(
        `El descuento debe estar entre 0% y ${maxDiscount}% para este producto.`,
      )
      return
    }
    if (!form.customer_id || !form.vendor_id) {
      setFormError('Selecciona un cliente y un vendedor.')
      return
    }
    if (unitPrice <= 0 || saleTotal <= 0) {
      setFormError('El total de la venta debe ser mayor que cero.')
      return
    }

    setIsSaving(true)

    try {
      const updatedFirstItem = {
        product_id: selectedProduct.id,
        quantity,
        unit_price: unitPrice,
        discount_percentage: discount,
      }
      const saleData = {
        customer_id: Number(form.customer_id),
        vendor_id: Number(form.vendor_id),
        payment_method: form.payment_method,
        total_amount: fullSaleTotal,
        items: [
          updatedFirstItem,
          ...(editingSale?.items ?? []).slice(1).map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percentage: item.discount_percentage ?? 0,
          })),
        ],
      }

      if (editingSale) {
        await updateSale(editingSale.id, saleData)
      } else {
        await createSale(saleData)
      }

      setForm(initialForm)
      setEditingSale(null)
      setIsModalOpen(false)
      setLoading(true)
      setError('')

      try {
        await refreshSales()
      } catch (refreshError) {
        setError(
          `La venta se ${editingSale ? 'actualizó' : 'registró'}, pero no se pudo actualizar el historial: ${getErrorMessage(refreshError)}`,
        )
      } finally {
        setLoading(false)
      }
    } catch (requestError) {
      setFormError(getErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  const saleRows = sales.flatMap((sale) =>
    (sale.items ?? []).map((item, index) => ({
      sale,
      item,
      product: products.find((candidate) => candidate.id === item.product_id),
      key: item.id ?? `${sale.id}-${index}`,
      isFirstItem: index === 0,
      isCancelled: sale.is_cancelled,
    })),
  )

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">Registro comercial</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Ventas
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Consulta el historial o registra una nueva venta.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || products.length === 0 || customers.length === 0 || vendors.length === 0}
          onClick={openCreateModal}
          className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#46513e] focus:outline-none focus:ring-2 focus:ring-[#58634f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Nueva Venta
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={async () => {
              setLoading(true)
              setError('')
              try {
                await refreshSales()
              } catch (requestError) {
                setError(getErrorMessage(requestError))
              } finally {
                setLoading(false)
              }
            }}
            className="font-medium underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-200/30">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">ID</th>
                <th scope="col" className="px-5 py-4 font-medium">Producto</th>
                <th scope="col" className="px-5 py-4 text-center font-medium">Cantidad</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Precio unitario</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Descuento aplicado</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Total</th>
                <th scope="col" className="px-5 py-4 font-medium">Fecha</th>
                <th scope="col" className="px-5 py-4 font-medium">Estado</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-5 py-12 text-center text-stone-500">
                    Cargando ventas…
                  </td>
                </tr>
              ) : saleRows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-5 py-12 text-center text-stone-500">
                    No hay ventas registradas todavía.
                  </td>
                </tr>
              ) : (
                saleRows.map(({ sale, item, product, key, isFirstItem, isCancelled }) => (
                  <tr
                    key={key}
                    className={`text-stone-700 hover:bg-stone-50/70 ${
                      isCancelled ? 'bg-stone-50 text-stone-400' : ''
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-stone-900">
                      #{sale.id}
                    </td>
                    <td className="px-5 py-4">
                      {product?.name ?? `Producto #${item.product_id}`}
                    </td>
                    <td className="px-5 py-4 text-center">{item.quantity}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {item.discount_percentage == null
                        ? '—'
                        : `${Number(item.discount_percentage)}%`}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </td>
                    <td className="px-5 py-4">{formatDate(sale.sale_date)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isCancelled
                            ? 'bg-stone-200 text-stone-600'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isCancelled ? 'Anulada' : 'Activa'}
                      </span>
                      {isCancelled && sale.cancelled_at && (
                        <span className="mt-1 block text-xs text-stone-400">
                          {formatDate(sale.cancelled_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isFirstItem && !isCancelled && (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(sale)}
                            className="font-medium text-[#58634f] hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={cancellingSaleId === sale.id}
                            onClick={() => handleCancel(sale)}
                            className="font-medium text-red-700 hover:underline disabled:opacity-50"
                          >
                            {cancellingSaleId === sale.id ? 'Anulando…' : 'Anular'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-modal-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stone-500">Registro comercial</p>
                <h3 id="sale-modal-title" className="mt-1 text-xl font-semibold text-stone-900">
                  {editingSale ? `Editar venta #${editingSale.id}` : 'Registrar venta'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar formulario"
                disabled={isSaving}
                onClick={closeModal}
                className="rounded-lg px-2 py-1 text-xl leading-none text-stone-500 hover:bg-stone-100 disabled:opacity-50"
              >
                &times;
              </button>
            </div>

            {formError && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                No se pudo {editingSale ? 'actualizar' : 'registrar'} la venta: {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">
                  Producto
                </span>
                <select
                  required
                  name="product_id"
                  value={form.product_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                >
                  <option value="">Selecciona un producto</option>
                  {selectableProducts.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                      disabled={product.stock < 1 && product.id !== originalItem?.product_id}
                    >
                      {product.name}{product.active ? '' : ' — Descontinuado'} — Stock: {product.stock} — {formatCurrency(product.sale_price)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedProduct && (
                <p className="text-sm text-stone-500">
                  Stock disponible: <strong>{availableStock}</strong>
                  {' · '}Descuento máximo: <strong>{maxDiscount}%</strong>
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Cantidad</span>
                  <input
                    required
                    type="number"
                    min="1"
                    max={selectedProduct ? availableStock : undefined}
                    step="1"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleChange}
                    aria-invalid={exceedsStock}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 ${
                      exceedsStock
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : 'border-stone-300 focus:border-[#58634f] focus:ring-[#58634f]/20'
                    }`}
                  />
                  {exceedsStock && (
                    <span className="mt-1 block text-xs text-red-600">
                      La cantidad supera el stock disponible.
                    </span>
                  )}
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Descuento (%)
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    max={maxDiscount}
                    step="0.01"
                    name="discount_percentage"
                    value={form.discount_percentage}
                    onChange={handleChange}
                    aria-invalid={exceedsDiscount}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 ${
                      exceedsDiscount
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : 'border-stone-300 focus:border-[#58634f] focus:ring-[#58634f]/20'
                    }`}
                  />
                  {exceedsDiscount && (
                    <span className="mt-1 block text-xs text-red-600">
                      Supera el descuento máximo del producto.
                    </span>
                  )}
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Cliente</span>
                  <select
                    required
                    name="customer_id"
                    value={form.customer_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  >
                    <option value="">Selecciona un cliente</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Vendedor</span>
                  <select
                    required
                    name="vendor_id"
                    value={form.vendor_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  >
                    <option value="">Selecciona un vendedor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Método de pago
                  </span>
                  <select
                    name="payment_method"
                    value={form.payment_method}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  >
                    <option value="Caja - Efectivo">Caja - Efectivo</option>
                    <option value="Banco">Banco</option>
                  </select>
                </label>
              </div>

              {selectedProduct && (
                <div className="rounded-xl bg-stone-50 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4 text-stone-600">
                    <span>Precio unitario con descuento</span>
                    <span>{formatCurrency(unitPrice)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4 font-semibold text-stone-900">
                    <span>Total</span>
                    <span>{formatCurrency(fullSaleTotal)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-stone-100 pt-5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeModal}
                  className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    !selectedProduct ||
                    exceedsStock ||
                    exceedsDiscount ||
                    customers.length === 0 ||
                    vendors.length === 0
                  }
                  className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#46513e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? 'Guardando…'
                    : editingSale
                      ? 'Actualizar venta'
                      : 'Guardar venta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
