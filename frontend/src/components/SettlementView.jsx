import { useEffect, useState } from 'react'
import {
  getSellersSettlement,
  paySellerSettlement,
} from '../services/api.js'

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
  }).format(Number(value ?? 0))
}

export default function SettlementView() {
  const [settlement, setSettlement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingSellerId, setPayingSellerId] = useState(null)

  async function loadSettlement(signal) {
    const data = await getSellersSettlement(signal ? { signal } : {})
    setSettlement(data)
  }

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        await loadSettlement(controller.signal)
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.code !== 'ERR_CANCELED') {
          setError(getErrorMessage(requestError))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  async function handlePayment(seller) {
    if (
      !window.confirm(
        `¿Registrar el pago de ${formatCurrency(seller.amount_to_settle)} a ${seller.seller_name}?`,
      )
    ) {
      return
    }

    setPayingSellerId(seller.seller_id)
    setError('')
    try {
      await paySellerSettlement(seller.seller_id)
      await loadSettlement()
    } catch (requestError) {
      setError(`No se pudo registrar el pago: ${getErrorMessage(requestError)}`)
    } finally {
      setPayingSellerId(null)
    }
  }

  const sellers = settlement?.sellers ?? []
  const totalSales = sellers.reduce(
    (total, seller) => total + Number(seller.total_sales ?? 0),
    0,
  )
  const salesCount = sellers.reduce(
    (total, seller) => total + Number(seller.sales_count ?? 0),
    0,
  )

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">Comisiones acumuladas</p>
        <h2 className="mt-1 text-2xl font-semibold text-stone-900">
          Liquidación de vendedores
        </h2>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Comisiones pendientes</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {loading ? '…' : formatCurrency(settlement?.total_commissions)}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Volumen facturado</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {loading ? '…' : formatCurrency(totalSales)}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Ventas contabilizadas</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {loading ? '…' : salesCount}
          </p>
        </article>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">Detalle por vendedor</h3>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-stone-500">Cargando liquidaciones…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Vendedor</th>
                  <th scope="col" className="px-5 py-3">Cantidad de ventas</th>
                  <th scope="col" className="px-5 py-3">Vol. facturado</th>
                  <th scope="col" className="px-5 py-3">% Comisión</th>
                  <th scope="col" className="px-5 py-3">Monto a liquidar</th>
                  <th scope="col" className="px-5 py-3">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sellers.map((seller) => {
                  const hasBalance = Number(seller.amount_to_settle) > 0
                  const isPaying = payingSellerId === seller.seller_id

                  return (
                    <tr key={seller.seller_id} className="text-stone-700">
                      <td className="px-5 py-4 font-medium text-stone-900">
                        {seller.seller_name}
                      </td>
                      <td className="px-5 py-4">{seller.sales_count}</td>
                      <td className="px-5 py-4">{formatCurrency(seller.total_sales)}</td>
                      <td className="px-5 py-4">{seller.commission_percentage}%</td>
                      <td className="px-5 py-4 font-semibold">
                        {formatCurrency(seller.amount_to_settle)}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={!hasBalance || payingSellerId !== null}
                          onClick={() => handlePayment(seller)}
                          className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${
                            hasBalance
                              ? 'bg-[#58634f] text-white hover:bg-[#46513e]'
                              : 'bg-stone-100 text-stone-500'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {isPaying
                            ? 'Registrando…'
                            : hasBalance
                              ? 'Marcar pagado'
                              : 'Al día'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {sellers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-stone-500">
                      No hay vendedores registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
