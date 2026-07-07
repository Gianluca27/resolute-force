import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import Landing from './pages/Landing';
import ProtectedRoute from './components/admin/ProtectedRoute';
import { RouteTracker } from './hooks/usePageview';

// Route-level code splitting: the public landing is the only eager chunk.
// Admin, designer and checkout-result pages load on demand so visitors don't
// download them.
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const CheckoutPending = lazy(() => import('./pages/CheckoutPending'));
const CheckoutFailure = lazy(() => import('./pages/CheckoutFailure'));
const Login = lazy(() => import('./pages/admin/Login'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Metrics = lazy(() => import('./pages/admin/Metrics'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const ProductForm = lazy(() => import('./pages/admin/ProductForm'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const Shipping = lazy(() => import('./pages/admin/Shipping'));
const DropConfig = lazy(() => import('./pages/admin/DropConfig'));
const ContentConfig = lazy(() => import('./pages/admin/ContentConfig'));
const Design = lazy(() => import('./pages/admin/design/Design'));
const DesignPreview = lazy(() => import('./pages/admin/design/DesignPreview'));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RouteTracker />
        <Suspense fallback={<div className="min-h-screen bg-bg" />}>
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
              <Route path="correo" element={<Shipping />} />
              <Route path="drop" element={<DropConfig />} />
              <Route path="contenido" element={<ContentConfig />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
