import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProtectedRoute from './components/ProtectedRoute';
import { authService } from './api/authService';
import ProjectPage from './pages/ProjectPage';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={
          authService.isAuthenticated() ? <Navigate to="/dashboard" /> : <WelcomePage />
        } />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={
          authService.isAuthenticated() ? <Navigate to="/dashboard" /> : <LoginPage />
        } />
        <Route path="/register" element={
          authService.isAuthenticated() ? <Navigate to="/dashboard" /> : <RegisterPage />
        } />
        
        {/* Rutas protegidas simplificadas */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-project"
          element={
            <ProtectedRoute>
              <CreateProjectPage />
            </ProtectedRoute>
          }
        />
        
        {/* ProjectPage lo agregaremos después */}
        <Route path="/project/:id" element={
          <ProtectedRoute>
            <ProjectPage />
          </ProtectedRoute>
        } />
        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}