import { Routes, Route, Navigate } from 'react-router-dom';
import { useData } from '@/hooks/useData';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Settings from '@/pages/Settings';

export default function App() {
  const dataHook = useData();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard {...dataHook} />} />
        <Route path="/settings" element={<Settings {...dataHook} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
