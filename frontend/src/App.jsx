import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import NewOrderPage from './pages/NewOrderPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import CatalogPage from './pages/CatalogPage'
import CompaniesPage from './pages/CompaniesPage'
import SettingsPage from './pages/SettingsPage'
import PublicOrderPage from './pages/PublicOrderPage'
import InventoryPage from './pages/InventoryPage'
import ProductsPage from './pages/ProductsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public — no layout chrome */}
        <Route path="/order/:token" element={<PublicOrderPage />} />

        {/* App routes */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders/new" element={<NewOrderPage />} />
        <Route path="/orders" element={<OrderHistoryPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
