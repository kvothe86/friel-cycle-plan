import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useSyncStore } from './store/sync';
import { SyncBar } from './ui/components/SyncBar';
import { AutoPush } from './ui/components/AutoPush';
import { HistoryScreen } from './ui/screens/HistoryScreen';
import { TodayScreen } from './ui/screens/TodayScreen';
import { PlanScreen } from './ui/screens/PlanScreen';
import { SeasonScreen } from './ui/screens/SeasonScreen';
import { GoalsScreen } from './ui/screens/GoalsScreen';
import { PlayerScreen } from './ui/screens/PlayerScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

const NAV = [
  { to: '/today', label: 'Today' },
  { to: '/plan', label: '14 days' },
  { to: '/season', label: 'Season' },
  { to: '/history', label: 'History' },
  { to: '/goals', label: 'Goals' },
  { to: '/player', label: 'Ride' },
  { to: '/settings', label: 'Settings' },
] as const;

export function App() {
  const autoSync = useSyncStore((s) => s.autoSync);
  useEffect(() => {
    void autoSync();
  }, [autoSync]);

  return (
    <div className="shell">
      <AutoPush />
      <aside className="sidebar">
        <div className="brand">
          <img src="./favicon.svg" alt="" width={28} height={28} />
          <span>CyclingHub</span>
        </div>
        <nav aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <SyncBar />
        <footer className="sidebar-footer">v{__APP_VERSION__}</footer>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/season" element={<SeasonScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/goals" element={<GoalsScreen />} />
          <Route path="/player" element={<PlayerScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>
    </div>
  );
}
