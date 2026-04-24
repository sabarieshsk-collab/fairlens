import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hasAlerts] = useState(true); // Placeholder for actual alert logic

  const pageNames = {
    '/dashboard': 'Dashboard',
    '/new-audit': 'New Audit',
    '/audit/history': 'Audit History',
    '/audit': 'Audit Detail',
    '/monitoring': 'Monitoring',
    '/reports': 'Compliance Reports',
    '/settings': 'Settings',
  };

  const getPageTitle = () => {
    for (const [path, name] of Object.entries(pageNames)) {
      if (location.pathname.startsWith(path)) {
        return name;
      }
    }
    return 'FairLens';
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = () => {
    if (!user) return '?';
    return user.email?.charAt(0).toUpperCase() || '?';
  };

  return (
    <div className="fixed top-0 left-60 right-0 h-16 bg-white border-b border-rule flex items-center justify-between px-8 z-40">
      {/* Page Title */}
      <h1 className="font-serif text-2xl font-bold text-ink">
        {getPageTitle()}
      </h1>

      {/* Right Section */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <div className="relative">
          <button className="relative p-2 text-ink-muted hover:text-ink transition-colors">
            <BellIcon className="w-6 h-6" />
            {hasAlerts && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-warn rounded-full"></span>
            )}
          </button>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-paper-warm transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-xs">
                {getInitials()}
              </span>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-rule overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-rule">
                <p className="text-sm font-medium text-ink truncate">
                  {user?.displayName || user?.email || 'User'}
                </p>
                <p className="text-xs text-ink-muted truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  navigate('/settings');
                  setShowUserMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-paper-warm transition-colors"
              >
                Profile Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-warn hover:bg-paper-warm transition-colors border-t border-rule"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
