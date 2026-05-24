import client from './client'

const cartAPI = {
  getCart: () =>
    client.get('/cart').then((r) => r.data),

  addItem: (payload) =>
    client.post('/cart/items', payload).then((r) => r.data),

  updateItem: (itemId, updates) =>
    client.put(`/cart/items/${itemId}`, updates).then((r) => r.data),

  removeItem: (itemId, removedBy = 'manager') =>
    client.delete(`/cart/items/${itemId}`, { params: { removed_by: removedBy } }).then((r) => r.data),

  clearCart: (clearedBy = 'manager') =>
    client.delete('/cart', { data: { cleared_by: clearedBy } }).then((r) => r.data),

  submitCart: (submittedBy = 'manager') =>
    client.post('/cart/submit', { submitted_by: submittedBy }).then((r) => r.data),

  getActivity: (limit = 50) =>
    client.get('/cart/activity', { params: { limit } }).then((r) => r.data),
}

export default cartAPI
