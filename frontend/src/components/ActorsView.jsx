import { useEffect, useState } from 'react'
import {
  createCustomer,
  createSeller,
  createSupplier,
  getCustomers,
  getSellers,
  getSuppliers,
} from '../services/api.js'

const actorTypes = {
  sellers: {
    title: 'Vendedores',
    singular: 'vendedor',
    load: getSellers,
    create: createSeller,
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'phone', label: 'Teléfono', type: 'tel', required: true },
      {
        name: 'commission_percentage',
        label: '% Comisión',
        type: 'number',
        required: true,
        min: 0,
        max: 100,
        step: '0.01',
      },
    ],
    columns: [
      { name: 'name', label: 'Nombre' },
      { name: 'phone', label: 'Teléfono' },
      { name: 'commission_percentage', label: '% Comisión', suffix: '%' },
    ],
    initialForm: { name: '', phone: '', commission_percentage: '' },
  },
  customers: {
    title: 'Compradores',
    singular: 'comprador',
    load: getCustomers,
    create: createCustomer,
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'phone', label: 'Teléfono', type: 'tel', required: true },
      {
        name: 'shipping_address',
        label: 'Dirección de despacho',
        type: 'text',
        required: true,
      },
    ],
    columns: [
      { name: 'name', label: 'Nombre' },
      { name: 'phone', label: 'Teléfono' },
      { name: 'shipping_address', label: 'Dirección de despacho' },
    ],
    initialForm: { name: '', phone: '', shipping_address: '' },
  },
  suppliers: {
    title: 'Proveedores',
    singular: 'proveedor',
    load: getSuppliers,
    create: createSupplier,
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'phone', label: 'Teléfono', type: 'tel', required: true },
      {
        name: 'pickup_address',
        label: 'Lugar de recogida',
        type: 'text',
        required: true,
      },
    ],
    columns: [
      { name: 'name', label: 'Nombre' },
      { name: 'phone', label: 'Teléfono' },
      { name: 'pickup_address', label: 'Lugar de recogida' },
    ],
    initialForm: { name: '', phone: '', pickup_address: '' },
  },
}

const tabs = Object.keys(actorTypes)

function getErrorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ')
  return error.message || 'Ocurrió un error inesperado.'
}

export default function ActorsView() {
  const [activeTab, setActiveTab] = useState('sellers')
  const [actors, setActors] = useState({
    sellers: [],
    customers: [],
    suppliers: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(actorTypes.sellers.initialForm)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadActors() {
      try {
        const [sellers, customers, suppliers] = await Promise.all([
          getSellers({ signal: controller.signal }),
          getCustomers({ signal: controller.signal }),
          getSuppliers({ signal: controller.signal }),
        ])
        setActors({ sellers, customers, suppliers })
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.code !== 'ERR_CANCELED') {
          setError(getErrorMessage(requestError))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadActors()
    return () => controller.abort()
  }, [])

  const config = actorTypes[activeTab]

  function openModal() {
    setForm({ ...config.initialForm })
    setFormError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    if (isSaving) return
    setIsModalOpen(false)
    setFormError('')
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const payload = { ...form }
    if (activeTab === 'sellers') {
      payload.commission_percentage = Number(payload.commission_percentage)
    }

    setIsSaving(true)
    try {
      await config.create(payload)
      const updatedActors = await config.load()
      setActors((current) => ({ ...current, [activeTab]: updatedActors }))
      setIsModalOpen(false)
    } catch (requestError) {
      setFormError(getErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-stone-500">Gestión de personas y aliados</p>
          <h2 className="mt-1 text-2xl font-semibold text-stone-900">Actores</h2>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#46513e]"
        >
          Registrar {config.singular}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-stone-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
              activeTab === tab
                ? 'border-[#58634f] text-[#46513e]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {actorTypes[tab].title}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-stone-500">Cargando actores…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.name} scope="col" className="px-5 py-3">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {actors[activeTab].map((actor) => (
                  <tr key={actor.id} className="text-stone-700">
                    {config.columns.map((column) => (
                      <td key={column.name} className="px-5 py-4">
                        {actor[column.name] == null || actor[column.name] === ''
                          ? '—'
                          : `${actor[column.name]}${column.suffix ?? ''}`}
                      </td>
                    ))}
                  </tr>
                ))}
                {actors[activeTab].length === 0 && (
                  <tr>
                    <td
                      colSpan={config.columns.length}
                      className="px-5 py-10 text-center text-stone-500"
                    >
                      No hay {config.title.toLowerCase()} registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-stone-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="actor-modal-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stone-500">Nuevo registro</p>
                <h3
                  id="actor-modal-title"
                  className="mt-1 text-xl font-semibold text-stone-900"
                >
                  Registrar {config.singular}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={isSaving}
                onClick={closeModal}
                className="rounded-lg px-2 py-1 text-xl text-stone-500 hover:bg-stone-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {config.fields.map((field) => (
                <label key={field.name} className="block text-sm font-medium text-stone-700">
                  {field.label}
                  <input
                    className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-[#58634f] focus:ring-2 focus:ring-[#58634f]/15"
                    name={field.name}
                    type={field.type}
                    value={form[field.name]}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={handleChange}
                  />
                </label>
              ))}

              {formError && (
                <p role="alert" className="text-sm text-red-700">
                  {formError}
                </p>
              )}

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
                  disabled={isSaving}
                  className="rounded-xl bg-[#58634f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#46513e] disabled:opacity-60"
                >
                  {isSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
