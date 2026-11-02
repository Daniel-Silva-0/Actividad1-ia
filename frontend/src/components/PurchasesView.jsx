import { useEffect, useState } from 'react'
import {
  cancelPurchase,
  createPurchase,
  getProducts,
  getPurchases,
  getSuppliers,
  updatePurchase,
} from '../services/api.js'

const initialForm = {
  supplier_id: '',
  product_id: '',
  quantity: '1',
  unit_cost: '',
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

export default function PurchasesView() {
  const [purchases, setPurchases] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [cancellingPurchaseId, setCancellingPurchaseId] = useState(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadData() {
      try {
        const [purchaseData, productData, supplierData] = await Promise.all([
          getPurchases({ signal: controller.signal }),
          getProducts({ signal: controller.signal }),
          getSuppliers({ signal: controller.signal }),
        ])

        setPurchases(purchaseData)
        setProducts(productData)
        setSuppliers(supplierData)
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
  const originalItem = editingPurchase?.items?.[0]
  const selectableProducts = products.filter(
    (product) => product.active || product.id === originalItem?.product_id,
  )
  const quantity = Number(form.quantity)
  const unitCost = Number(form.unit_cost)
  const purchaseTotal = Number((quantity * unitCost).toFixed(2))
  const fullPurchaseTotal =
    purchaseTotal +
    (editingPurchase?.items ?? [])
      .slice(1)
      .reduce(
        (total, item) =>
          total + Number(item.unit_cost) * Number(item.quantity),
        0,
      )

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => {
      if (name === 'product_id') {
        const product = products.find(
          (candidate) => String(candidate.id) === value,
        )

        return {
          ...current,
          product_id: value,
          unit_cost: product ? String(product.purchase_price) : '',
        }
      }

      return { ...current, [name]: value }
    })
  }

  function closeModal() {
    if (isSaving) return
    setIsModalOpen(false)
    setEditingPurchase(null)
    setForm(initialForm)
    setFormError('')
  }

  function openCreateModal() {
    setEditingPurchase(null)
    setForm(initialForm)
    setFormError('')
    setIsModalOpen(true)
  }

  function openEditModal(purchase) {
    const item = purchase.items?.[0]
    if (!item) {
      setError(
        `No se puede editar la compra #${purchase.id}: no contiene artículos.`,
      )
      return
    }

    setEditingPurchase(purchase)
    setForm({
      supplier_id: String(purchase.supplier_id),
      product_id: String(item.product_id),
      quantity: String(item.quantity),
      unit_cost: String(item.unit_cost),
      payment_method: purchase.payment_method,
    })
    setFormError('')
    setIsModalOpen(true)
  }

  async function handleCancel(purchase) {
    if (
      !window.confirm(
        `¿Anular la compra #${purchase.id}? Se conservará en el historial y se descontarán del stock los artículos ingresados.`,
      )
    ) {
      return
    }

    setCancellingPurchaseId(purchase.id)
    try {
      await cancelPurchase(purchase.id)
      setLoading(true)
      setError('')
      await refreshData()
    } catch (requestError) {
      setError(`No se pudo anular la compra: ${getErrorMessage(requestError)}`)
    } finally {
      setCancellingPurchaseId(null)
      setLoading(false)
    }
  }

  async function refreshData() {
    const [purchaseData, productData] = await Promise.all([
      getPurchases(),
      getProducts(),
    ])

    setPurchases(purchaseData)
    setProducts(productData)
  }

  async function handleRetry() {
    setLoading(true)
    setError('')

    try {
      const [purchaseData, productData, supplierData] = await Promise.all([
        getPurchases(),
        getProducts(),
        getSuppliers(),
      ])

      setPurchases(purchaseData)
      setProducts(productData)
      setSuppliers(supplierData)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    if (!selectedProduct) {
      setFormError('Selecciona un producto.')
      return
    }
    if (!form.supplier_id) {
      setFormError('Selecciona un proveedor.')
      return
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setFormError('La cantidad debe ser un número entero mayor que cero.')
      return
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      setFormError('El precio unitario debe ser mayor que cero.')
      return
    }

    setIsSaving(true)

    try {
      const purchaseData = {
        supplier_id: Number(form.supplier_id),
        payment_method: form.payment_method,
        total_amount: fullPurchaseTotal,
        items: [
          {
            product_id: selectedProduct.id,
            quantity,
            unit_cost: unitCost,
          },
          ...(editingPurchase?.items ?? []).slice(1).map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
          })),
        ],
      }

      if (editingPurchase) {
        await updatePurchase(editingPurchase.id, purchaseData)
      } else {
        await createPurchase(purchaseData)
      }

      setForm(initialForm)
      setEditingPurchase(null)
      setIsModalOpen(false)
      setLoading(true)
      setError('')

      try {
        await refreshData()
      } catch (refreshError) {
        setError(
          `La compra se ${editingPurchase ? 'actualizó' : 'registró'}, pero no se pudo actualizar el historial: ${getErrorMessage(refreshError)}`,
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

  const purchaseRows = purchases.flatMap((purchase) =>
    (purchase.items ?? []).map((item, index) => ({
      purchase,
      item,
      product: products.find((candidate) => candidate.id === item.product_id),
      key: item.id ?? `${purchase.id}-${index}`,
      isFirstItem: index === 0,
      isCancelled: purchase.is_cancelled,
    })),
  )

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">Inventario</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Compras
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Consulta el historial o registra una entrada de stock.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || products.length === 0 || suppliers.length === 0}
          onClick={openCreateModal}
          className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#46513e] focus:outline-none focus:ring-2 focus:ring-[#58634f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Registrar Compra
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
            onClick={handleRetry}
            className="font-medium underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-200/30">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">ID</th>
                <th scope="col" className="px-5 py-4 font-medium">Producto</th>
                <th scope="col" className="px-5 py-4 text-center font-medium">
                  Cantidad Comprada
                </th>
                <th scope="col" className="px-5 py-4 text-right font-medium">
                  Precio Unitario de Compra
                </th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Total</th>
                <th scope="col" className="px-5 py-4 font-medium">
                  Fecha de Registro
                </th>
                <th scope="col" className="px-5 py-4 text-right font-medium">
                  Acciones
                </th>
                <th scope="col" className="px-5 py-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-stone-500">
                    Cargando compras…
                  </td>
                </tr>
              ) : purchaseRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-stone-500">
                    No hay compras registradas todavía.
                  </td>
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
                    {isCancelled && purchase.cancelled_at && (
                      <span className="mt-1 block text-xs text-stone-400">
                        {formatDate(purchase.cancelled_at)}
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                purchaseRows.map(({ purchase, item, product, key, isFirstItem, isCancelled }) => (
                  <tr
                    key={key}
                    className={`text-stone-700 hover:bg-stone-50/70 ${
                      isCancelled ? 'bg-stone-50 text-stone-400' : ''
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-stone-900">
                      #{purchase.id}
                    </td>
                    <td className="px-5 py-4">
                      {product?.name ?? `Producto #${item.product_id}`}
                    </td>
                    <td className="px-5 py-4 text-center">{item.quantity}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatCurrency(item.unit_cost)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatCurrency(item.unit_cost * item.quantity)}
                    </td>
                    <td className="px-5 py-4">{formatDate(purchase.purchase_date)}</td>
                    <td className="px-5 py-4 text-right">
                      {isFirstItem && !isCancelled && (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(purchase)}
                            className="font-medium text-[#58634f] hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={cancellingPurchaseId === purchase.id}
                            onClick={() => handleCancel(purchase)}
                            className="font-medium text-red-700 hover:underline disabled:opacity-50"
                          >
                            {cancellingPurchaseId === purchase.id
                              ? 'Anulando…'
                              : 'Anular'}
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
            aria-labelledby="purchase-modal-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stone-500">Inventario</p>
                <h3
                  id="purchase-modal-title"
                  className="mt-1 text-xl font-semibold text-stone-900"
                >
                  {editingPurchase
                    ? `Editar compra #${editingPurchase.id}`
                    : 'Registrar compra'}
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
                No se pudo {editingPurchase ? 'actualizar' : 'registrar'} la compra: {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">
                  Proveedor
                </span>
                <select
                  required
                  name="supplier_id"
                  value={form.supplier_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                >
                  <option value="">Selecciona un proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

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
                    <option key={product.id} value={product.id}>
                      {product.name}{product.active ? '' : ' — Descontinuado'} — Stock: {product.stock}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Cantidad ingresada
                  </span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Precio unitario de compra
                  </span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    name="unit_cost"
                    value={form.unit_cost}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>
              </div>

              <label className="block">
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

              <p className="text-sm text-stone-600">
                Total de la compra:{' '}
                <strong className="text-stone-900">
                  {formatCurrency(fullPurchaseTotal || 0)}
                </strong>
              </p>

              <div className="flex justify-end gap-3 pt-2">
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
                  disabled={isSaving || products.length === 0 || suppliers.length === 0}
                  className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#46513e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving
                    ? 'Guardando…'
                    : editingPurchase
                      ? 'Actualizar compra'
                      : 'Registrar compra'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
