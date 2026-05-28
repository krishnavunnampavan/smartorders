import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
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
import AccessKeyPage from './pages/AccessKeyPage'
import OwnerDashboard from './pages/OwnerDashboard'
import OwnerStoreDetailPage from './pages/OwnerStoreDetailPage'
import OwnerNewStorePage from './pages/OwnerNewStorePage'
import OwnerSettingsPage from './pages/OwnerSettingsPage'
import FloatingOrderCart from './components/shared/FloatingOrderCart'
import { useCartSync } from './hooks/useCartSync'
import { useOrderStore } from './store/orderStore'
import { useAuthStore } from './store/authStore'

function CartSyncProvider() {
  useCartSync()
  const loadCart = useOrderStore((s) => s.loadCart)
  useEffect(() => { loadCart() }, [loadCart])
  return null
}

// Guard: redirect to /login if not authenticated
function RequireAuth({ children }) {
  const { storeKey, isOwner } = useAuthStore()
  const location = useLocation()
  if (!storeKey) return <Navigate to="/login" state={{ from: location }} replace />
  if (isOwner)   return <Navigate to="/owner" replace />
  return children
}

// Guard: redirect owner away from store routes
function RequireOwner({ children }) {
  const { storeKey, isOwner } = useAuthStore()
  const location = useLocation()
  if (!storeKey) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isOwner)  return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <CartSyncProvider />
      <Routes>
        {/* Public — no auth needed */}
        <Route path="/order/:token" element={<PublicOrderPage />} />
        <Route path="/login" element={<AccessKeyPage />} />

        {/* Owner-only routes */}
        <Route path="/owner" element={<RequireOwner><OwnerDashboard /></RequireOwner>} />
        <Route path="/owner/stores/new" element={<RequireOwner><OwnerNewStorePage /></RequireOwner>} />
        <Route path="/owner/stores/:storeId" element={<RequireOwner><OwnerStoreDetailPage /></RequireOwner>} />
        <Route path="/owner/settings" element={<RequireOwner><OwnerSettingsPage /></RequireOwner>} />

        {/* Store app routes */}
        <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/orders/new" element={<RequireAuth><NewOrderPage /></RequireAuth>} />
        <Route path="/orders" element={<RequireAuth><OrderHistoryPage /></RequireAuth>} />
        <Route path="/orders/:orderId" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route path="/products" element={<RequireAuth><ProductsPage /></RequireAuth>} />
        <Route path="/catalog" element={<RequireAuth><CatalogPage /></RequireAuth>} />
        <Route path="/companies" element={<RequireAuth><CompaniesPage /></RequireAuth>} />
        <Route path="/inventory" element={<RequireAuth><InventoryPage /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Floating cart — only on store pages (not owner, not public) */}
      <FloatingOrderCart />
    </BrowserRouter>
  )
}
