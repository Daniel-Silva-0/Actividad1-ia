import { useState } from 'react'
import Layout from './components/Layout.jsx'
import DashboardView from './components/DashboardView.jsx'
import ProductsView from './components/ProductsView.jsx'
import PurchasesView from './components/PurchasesView.jsx'
import SalesView from './components/SalesView.jsx'
import ActorsView from './components/ActorsView.jsx'
import SettlementView from './components/SettlementView.jsx'
import { pageTitles } from './components/navigation.js'

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')

  let activeView

  switch (activePage) {
    case 'dashboard':
      activeView = <DashboardView />
      break
    case 'products':
      activeView = <ProductsView />
      break
    case 'sales':
      activeView = <SalesView />
      break
    case 'purchases':
      activeView = <PurchasesView />
      break
    case 'actors':
      activeView = <ActorsView />
      break
    case 'settlement':
      activeView = <SettlementView />
      break
    default:
      activeView = (
        <section className="rounded-2xl border border-stone-200 bg-white p-8">
          <p className="text-sm text-stone-500">Módulo</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-900">
            {pageTitles[activePage] ?? 'Módulo'}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Esta sección está lista para incorporar sus listados y formularios.
          </p>
        </section>
      )
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {activeView}
    </Layout>
  )
}
