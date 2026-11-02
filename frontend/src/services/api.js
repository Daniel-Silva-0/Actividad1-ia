import axios from 'axios'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(
    /\/$/,
    '',
  ),
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function getProducts(config = {}) {
  const { data } = await api.get('/products', config)
  return data
}

export async function createProduct(product, config = {}) {
  const { data } = await api.post('/products', product, config)
  return data
}

export async function updateProduct(productId, product, config = {}) {
  const { data } = await api.put(`/products/${productId}`, product, config)
  return data
}

export async function getSales(config = {}) {
  const { data } = await api.get('/sales', config)
  return data
}

export async function createSale(sale, config = {}) {
  const { data } = await api.post('/sales', sale, config)
  return data
}

export async function updateSale(saleId, sale, config = {}) {
  const { data } = await api.put(`/sales/${saleId}`, sale, config)
  return data
}

export async function cancelSale(saleId, config = {}) {
  const { data } = await api.post(`/sales/${saleId}/cancel`, undefined, config)
  return data
}

export async function getPurchases(config = {}) {
  const { data } = await api.get('/purchases', config)
  return data
}

export async function createPurchase(purchase, config = {}) {
  const { data } = await api.post('/purchases', purchase, config)
  return data
}

export async function updatePurchase(purchaseId, purchase, config = {}) {
  const { data } = await api.put(`/purchases/${purchaseId}`, purchase, config)
  return data
}

export async function cancelPurchase(purchaseId, config = {}) {
  const { data } = await api.post(
    `/purchases/${purchaseId}/cancel`,
    undefined,
    config,
  )
  return data
}

export async function getCustomers(config = {}) {
  const { data } = await api.get('/customers', config)
  return data
}

export async function createCustomer(customer, config = {}) {
  const { data } = await api.post('/customers', customer, config)
  return data
}

export async function getSellers(config = {}) {
  const { data } = await api.get('/sellers', config)
  return data
}

export async function createSeller(seller, config = {}) {
  const { data } = await api.post('/sellers', seller, config)
  return data
}

export async function getSellersSettlement(config = {}) {
  const { data } = await api.get('/sellers/settlement', config)
  return data
}

export async function paySellerSettlement(sellerId, config = {}) {
  const { data } = await api.post(
    `/sellers/${sellerId}/payments`,
    undefined,
    config,
  )
  return data
}

export async function getVendors(config = {}) {
  const { data } = await api.get('/vendors', config)
  return data
}

export async function getSuppliers(config = {}) {
  const { data } = await api.get('/suppliers', config)
  return data
}

export async function createSupplier(supplier, config = {}) {
  const { data } = await api.post('/suppliers', supplier, config)
  return data
}
