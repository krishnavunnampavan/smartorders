import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import NewOrderPage from './pages/NewOrderPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import OrderDetailPage from './pages/OrderDetailPage'
import CatalogPage from './pages/CatalogPage'
import CompaniesPage from './pages/CompaniesPage'
import SettingsPage from './pages/SettingsPage'
import PublicOrderPage from './pages/PublicOrderPage'
import InventoryPage from './pages/InventoryPage'
import ProductsPage from './pages/ProductsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import FloatingOrderCart from './components/shared/FloatingOrderCart'
import { useCartSync } from './hooks/useCartSync'
import { useOrderStore } from './store/orderStore'

function CartSyncProvider() {
  useCartSync()
  const loadCart = useOrderStore((s) => s.loadCart)
  useEffect(() => { loadCart() }, [loadCart])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <CartSyncProvider />
      <Routes>
        {/* Public — no layout chrome */}
        <Route path="/order/:token" element={<PublicOrderPage />} />

        {/* App routes */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders/new" element={<NewOrderPage />} />
        <Route path="/orders" element={<OrderHistoryPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      {/* Global floating order cart — visible on all app pages */}
      <FloatingOrderCart />
    </BrowserRouter>
  )
}
