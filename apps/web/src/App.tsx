import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import Landing from './pages/Landing';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutPending from './pages/CheckoutPending';
import CheckoutFailure from './pages/CheckoutFailure';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminLayout from './pages/admin/AdminLayout';
import Login from './pages/admin/Login';
import Metrics from './pages/admin/Metrics';
import AdminProducts from './pages/admin/Products';
import ProductForm from './pages/admin/ProductForm';
import Orders from './pages/admin/Orders';
import DropConfig from './pages/admin/DropConfig';
import ContentConfig from './pages/admin/ContentConfig';
import Design from './pages/admin/design/Design';
import DesignPreview from './pages/admin/design/DesignPreview';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/checkout/pending" element={<CheckoutPending />} />
          <Route path="/checkout/failure" element={<CheckoutFailure />} />
          <Route path="/admin/login" element={<Login />} />
          {/* Full-screen designer + its iframe preview live outside AdminLayout on purpose. */}
          <Route path="/admin/design" element={<ProtectedRoute><Design /></ProtectedRoute>} />
          <Route path="/admin/design/preview" element={<ProtectedRoute><DesignPreview /></ProtectedRoute>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Metrics />} />
            <Route path="productos" element={<AdminProducts />} />
            <Route path="productos/nuevo" element={<ProductForm />} />
            <Route path="productos/:id" element={<ProductForm />} />
            <Route path="pedidos" element={<Orders />} />
            <Route path="drop" element={<DropConfig />} />
            <Route path="contenido" element={<ContentConfig />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
