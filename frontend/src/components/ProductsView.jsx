import { useCallback, useEffect, useState } from 'react'
import {
  createProduct,
  getProducts,
  updateProduct,
} from '../services/api.js'

const initialForm = {
  name: '',
  category: '',
  purchase_price: '',
  sale_price: '',
  stock: '0',
  max_discount: '0',
  active: true,
}

function getErrorMessage(error) {
  const detail = error.response?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(', ')
  }

  return error.message || 'Ocurrió un error inesperado.'
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export default function ProductsView() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editingProductId, setEditingProductId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadProducts = useCallback(async () => {
    const data = await getProducts()
    setProducts(data)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadInitialProducts() {
      try {
        const data = await getProducts({ signal: controller.signal })
        setProducts(data)
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.code !== 'ERR_CANCELED') {
          setError(getErrorMessage(requestError))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadInitialProducts()

    return () => controller.abort()
  }, [])

  async function refreshProducts() {
    try {
      await loadProducts()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function handleFormChange(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  function closeModal() {
    if (isSaving) return

    setIsModalOpen(false)
    setEditingProductId(null)
    setForm(initialForm)
    setFormError('')
  }

  function openCreateModal() {
    setEditingProductId(null)
    setForm(initialForm)
    setFormError('')
    setIsModalOpen(true)
  }

  function openEditModal(product) {
    setEditingProductId(product.id)
    setForm({
      name: product.name,
      category: product.category,
      purchase_price: String(product.purchase_price),
      sale_price: String(product.sale_price),
      stock: String(product.stock),
      max_discount: String(product.max_discount),
      active: product.active,
    })
    setFormError('')
    setIsModalOpen(true)
  }

  async function handleToggleActive(product) {
    const action = product.active ? 'descontinuar' : 'reactivar'
    if (
      !window.confirm(
        `¿${action[0].toUpperCase()}${action.slice(1)} "${product.name}"? ${
          product.active
            ? 'Se conservará el producto y su historial, pero no estará disponible para nuevas operaciones.'
            : 'Volverá a estar disponible para nuevas operaciones.'
        }`,
      )
    ) {
      return
    }

    try {
      const { id, ...productData } = product
      await updateProduct(id, { ...productData, active: !product.active })
      setError('')
      setLoading(true)
      await refreshProducts()
    } catch (requestError) {
      setError(`No se pudo ${action} el producto: ${getErrorMessage(requestError)}`)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setIsSaving(true)

    try {
      const productData = {
        name: form.name.trim(),
        category: form.category.trim(),
        purchase_price: Number(form.purchase_price),
        sale_price: Number(form.sale_price),
        stock: Number(form.stock),
        max_discount: Number(form.max_discount),
        active: form.active,
      }

      if (editingProductId === null) {
        await createProduct(productData)
      } else {
        await updateProduct(editingProductId, productData)
      }

      setForm(initialForm)
      setEditingProductId(null)
      setIsModalOpen(false)
      setError('')
      setLoading(true)
      await refreshProducts()
    } catch (requestError) {
      setFormError(getErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">Inventario</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Productos &amp; Stock
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Consulta y administra los productos de tu catálogo.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#46513e] focus:outline-none focus:ring-2 focus:ring-[#58634f] focus:ring-offset-2"
        >
          Nuevo producto
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>No se pudo completar la operación: {error}</span>
          <button
            type="button"
            onClick={() => {
              setError('')
              setLoading(true)
              refreshProducts()
            }}
            className="font-medium underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-200/30">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">Nombre</th>
                <th scope="col" className="px-5 py-4 font-medium">Categoría</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Precio Compra</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Precio Venta</th>
                <th scope="col" className="px-5 py-4 text-center font-medium">Stock</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Descuento Máx.</th>
                <th scope="col" className="px-5 py-4 text-center font-medium">Estado</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-stone-500">
                    Cargando productos…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-stone-500">
                    No hay productos registrados todavía.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="text-stone-700 hover:bg-stone-50/70">
                    <td className="px-5 py-4 font-medium text-stone-900">
                      {product.name}
                    </td>
                    <td className="px-5 py-4">{product.category}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatCurrency(product.purchase_price)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatCurrency(product.sale_price)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          product.stock > 5
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {Number(product.max_discount)}%
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          product.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {product.active ? 'Activo' : 'Descontinuado'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="font-medium text-[#58634f] hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          className={`font-medium hover:underline ${
                            product.active
                              ? 'text-red-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {product.active ? 'Descontinuar' : 'Reactivar'}
                        </button>
                      </div>
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
            aria-labelledby="product-modal-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stone-500">Catálogo</p>
                <h3
                  id="product-modal-title"
                  className="mt-1 text-xl font-semibold text-stone-900"
                >
                  {editingProductId === null ? 'Registrar producto' : 'Editar producto'}
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
                No se pudo {editingProductId === null ? 'registrar' : 'actualizar'} el producto: {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Nombre
                  </span>
                  <input
                    required
                    maxLength={150}
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Categoría
                  </span>
                  <input
                    required
                    maxLength={100}
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Precio de compra
                  </span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    name="purchase_price"
                    value={form.purchase_price}
                    onChange={handleFormChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>

                {editingProductId !== null && (
                  <label className="sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">
                      Estado del producto
                    </span>
                    <select
                      name="active"
                      value={String(form.active)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          active: event.target.value === 'true',
                        }))
                      }
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                    >
                      <option value="true">Activo</option>
                      <option value="false">Descontinuado</option>
                    </select>
                  </label>
                )}

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Precio de venta
                  </span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    name="sale_price"
                    value={form.sale_price}
                    onChange={handleFormChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Stock inicial
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    name="stock"
                    value={form.stock}
                    onChange={handleFormChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Descuento máximo (%)
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    name="max_discount"
                    value={form.max_discount}
                    onChange={handleFormChange}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/20"
                  />
                </label>
              </div>

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
                  disabled={isSaving}
                  className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#46513e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? 'Guardando…'
                    : editingProductId === null
                      ? 'Guardar producto'
                      : 'Actualizar producto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
