import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  PlusCircleIcon,
  ClockIcon,
  BellIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: HomeIcon },
    { path: '/new-audit', label: 'New Audit', icon: PlusCircleIcon },
    { path: '/audit/history', label: 'Audit History', icon: ClockIcon },
    { path: '/monitoring', label: 'Monitoring', icon: BellIcon },
    { path: '/reports', label: 'Compliance Reports', icon: DocumentTextIcon },
    { path: '/settings', label: 'Settings', icon: Cog6ToothIcon },
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  const getInitials = () => {
    if (!user) return '?';
    return user.email?.charAt(0).toUpperCase() || '?';
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-60 bg-ink text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-ink-soft">
        <h1 className="font-serif text-2xl font-bold text-white">FairLens</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-accent text-white'
                  : 'text-ink-faint hover:text-paper hover:bg-ink-soft'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-ink-soft p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {getInitials()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.displayName || user?.email || 'User'}
            </p>
            <p className="text-xs text-ink-faint truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
