import { useEffect, useState } from 'react'
import { getProducts, getPurchases, getSales } from '../services/api.js'

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('es-ES')

function formatCurrency(value) {
  return currencyFormatter.format(value)
}

const initialData = {
  products: [],
  sales: [],
  purchases: [],
}

export default function DashboardView() {
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      setIsLoading(true)
      setError('')

      try {
        const [products, sales, purchases] = await Promise.all([
          getProducts({ signal: controller.signal }),
          getSales({ signal: controller.signal }),
          getPurchases({ signal: controller.signal }),
        ])

        if (
          !Array.isArray(products) ||
          !Array.isArray(sales) ||
          !Array.isArray(purchases)
        ) {
          throw new Error('El servidor devolvió datos con un formato inesperado.')
        }

        setData({ products, sales, purchases })
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'No se pudieron cargar los datos del dashboard.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => controller.abort()
  }, [])

  const activeProducts = data.products.filter((product) => product.active)
  const activeSales = data.sales.filter((sale) => !sale.is_cancelled)
  const activePurchases = data.purchases.filter(
    (purchase) => !purchase.is_cancelled,
  )

  const inventoryValue = data.products.reduce(
    (total, product) =>
      total + Number(product.purchase_price) * Number(product.stock),
    0,
  )

  const salesRevenue = activeSales.reduce(
    (total, sale) => total + Number(sale.total_amount),
    0,
  )

  const lowStockProducts = activeProducts
    .filter((product) => Number(product.stock) <= 5)
    .sort((a, b) => Number(a.stock) - Number(b.stock))

  const metrics = [
    {
      label: 'Productos en catálogo',
      value: numberFormatter.format(activeProducts.length),
      note: 'Productos activos en catálogo',
      icon: 'M12 3 3 8l9 5 9-5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
    },
    {
      label: 'Valor del inventario',
      value: formatCurrency(inventoryValue),
      note: 'Calculado al precio de compra',
      icon: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    },
    {
      label: 'Ingresos por ventas',
      value: formatCurrency(salesRevenue),
      note: `${numberFormatter.format(activeSales.length)} ventas activas`,
      icon: 'M3 3v18h18 M7 14l4-4 4 4 6-7',
    },
    {
      label: 'Productos con bajo stock',
      value: numberFormatter.format(lowStockProducts.length),
      note: 'Con 5 unidades o menos',
      icon: 'M10.3 3.9 1.8 18.6A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.4L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
    },
  ]

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-amber-800">
            Resumen general
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Bienvenida a Art.Monia
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Una visión clara del catálogo, el inventario y la actividad de ventas.
          </p>
        </div>

        <p className="text-sm text-stone-500">
          Compras registradas:{' '}
          <span className="font-semibold text-stone-800">
            {isLoading ? '—' : numberFormatter.format(activePurchases.length)}
          </span>
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          No se pudo cargar el dashboard: {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/30"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-stone-500">
                {metric.label}
              </p>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                  index === 3
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={metric.icon} />
                </svg>
              </span>
            </div>

            <p className="mt-5 text-2xl font-semibold tracking-tight text-stone-900">
              {isLoading ? '—' : metric.value}
            </p>
            <p className="mt-1 text-xs text-stone-400">{metric.note}</p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-200/30">
        <div className="flex flex-col gap-2 border-b border-stone-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">
              Reabastecimiento urgente
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              Productos con existencias iguales o inferiores a 5 unidades.
            </p>
          </div>
          <span className="w-fit rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
            {isLoading ? '—' : `${lowStockProducts.length} por revisar`}
          </span>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-stone-500">
            Cargando información del inventario…
          </p>
        ) : lowStockProducts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-500">
            Todo en orden: no hay productos que requieran reabastecimiento
            urgente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Producto
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Categoría
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Stock actual
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Precio de compra
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lowStockProducts.map((product) => (
                  <tr key={product.id} className="text-stone-700">
                    <td className="px-5 py-4 font-medium text-stone-900">
                      {product.name}
                    </td>
                    <td className="px-5 py-4">{product.category}</td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          Number(product.stock) === 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {formatCurrency(Number(product.purchase_price))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
