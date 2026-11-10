import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSyncStore } from './store/sync';
import { SyncBar } from './ui/components/SyncBar';
import { Icon } from './ui/components/Icon';
import { AutoPush } from './ui/components/AutoPush';
import { PlanLogger } from './ui/components/PlanLogger';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { GuideScreen } from './ui/screens/GuideScreen';
import { HistoryScreen } from './ui/screens/HistoryScreen';
import { TodayScreen } from './ui/screens/TodayScreen';
import { PlanScreen } from './ui/screens/PlanScreen';
import { SeasonScreen } from './ui/screens/SeasonScreen';
import { GoalsScreen } from './ui/screens/GoalsScreen';
import { PlayerScreen } from './ui/screens/PlayerScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

const NAV = [
  { to: '/today', label: 'Today', icon: 'today' },
  { to: '/plan', label: '14 days', icon: 'plan' },
  { to: '/season', label: 'Season', icon: 'season' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/goals', label: 'Goals', icon: 'goals' },
  { to: '/player', label: 'Ride', icon: 'ride' },
  { to: '/guide', label: 'Guide', icon: 'guide' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
] as const;

export function App() {
  const autoSync = useSyncStore((s) => s.autoSync);
  const location = useLocation();
  useEffect(() => {
    void autoSync();
  }, [autoSync]);

  return (
    <div className="shell">
      <AutoPush />
      <PlanLogger />
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="bolt" size={16} />
          </span>
          <span className="brand-name">
            Cycling<strong>Hub</strong>
          </span>
        </div>
        <nav aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <SyncBar />
        <footer className="sidebar-footer">v{__APP_VERSION__}</footer>
      </aside>
      <main className="content">
        <ErrorBoundary resetKey={location.pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayScreen />} />
            <Route path="/plan" element={<PlanScreen />} />
            <Route path="/season" element={<SeasonScreen />} />
            <Route path="/history" element={<HistoryScreen />} />
            <Route path="/goals" element={<GoalsScreen />} />
            <Route path="/player" element={<PlayerScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/guide" element={<GuideScreen />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
