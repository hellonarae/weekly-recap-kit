import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { Week } from '@/pages/Week';
import { Units } from '@/pages/Units';
import { Privacy } from '@/pages/Privacy';
import { Navigate } from 'react-router-dom';
import { course } from '@/config/course';
import { AudioProviderRoot } from '@/audio/AudioService';
import { Unit } from '@/pages/Unit';
import { MyPage } from '@/pages/MyPage';
// Auth module: loaded only when course.yml turns it on, so a kit build never ships supabase-js active.
const AuthRoot = lazy(() => import('@/auth/AuthRoot').then((m) => ({ default: m.AuthRoot })));
const Admin = lazy(() => import('@/pages/Admin').then((m) => ({ default: m.Admin })));

function Modules({ children }: { children: ReactNode }) {
  if (course.modules.auth === 'none') return <>{children}</>;
  return <Suspense fallback={null}><AuthRoot>{children}</AuthRoot></Suspense>;
}

export function App() {
  const m = course.modules;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Modules>
      <AudioProviderRoot>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path=":level/week/:n/:tab?" element={<Week />} />
          <Route path=":level/units" element={<Units />} />
          <Route path=":level/unit/:unit" element={<Unit />} />
          <Route path=":level/my" element={<MyPage />} />
          <Route path="my" element={<MyPage />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="profile" element={<Navigate to="/my" replace />} />
          {m.admin && <Route path="admin" element={<Suspense fallback={null}><Admin /></Suspense>} />}
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
      </AudioProviderRoot>
      </Modules>
    </BrowserRouter>
  );
}
