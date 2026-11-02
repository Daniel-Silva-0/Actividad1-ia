export const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  },
  {
    id: 'products',
    label: 'Productos & Stock',
    icon: 'M12 3 3 8l9 5 9-5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  },
  {
    id: 'sales',
    label: 'Ventas',
    icon: 'M3 3v18h18 M7 14l4-4 4 4 6-7',
  },
  {
    id: 'purchases',
    label: 'Compras',
    icon: 'M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6 M10 21h.01 M18 21h.01',
  },
  {
    id: 'actors',
    label: '👥 Actores (Vendedores/Clientes/Proveedores)',
    icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  },
  {
    id: 'settlement',
    label: '💳 Liquidación',
    icon: 'M2 7h20v13H2z M2 7l2-4h16l2 4 M16 14h2',
  },
]

export const pageTitles = Object.fromEntries(
  navItems.map(({ id, label }) => [id, label]),
)
