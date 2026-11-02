import { navItems } from './navigation.js'

function NavIcon({ path }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  )
}

export default function Sidebar({ activePage, isOpen, onNavigate, onClose }) {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-20 bg-stone-950/30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-stone-200 bg-[#fbfaf8] px-5 py-6 transition-transform md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <a
          href="#dashboard"
          className="mb-10 flex items-center gap-3 px-2"
          onClick={() => onNavigate('dashboard')}
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#58634f] text-lg font-semibold text-white">
            A
          </span>
          <span>
            <span className="block font-semibold tracking-tight text-stone-900">
              Art.Monia
            </span>
            <span className="block text-xs tracking-[0.16em] text-stone-500">
              DECOR
            </span>
          </span>
        </a>

        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
          Menú principal
        </p>

        <nav aria-label="Navegación principal" className="space-y-1">
          {navItems.map((item) => {
            const isActive = activePage === item.id

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-[#e9ebe5] font-medium text-[#46513e]'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <NavIcon path={item.icon} />
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="mt-auto rounded-2xl bg-[#f0eee8] p-4">
          <p className="text-sm font-medium text-stone-800">Art.Monia Decor</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Gestión de inventario y ventas
          </p>
        </div>
      </aside>
    </>
  )
}
