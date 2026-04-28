import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const mockUserJson = sessionStorage.getItem('fairlens_mock_user');
    if (mockUserJson) {
      try {
        setUser(JSON.parse(mockUserJson));
      } catch (e) {
        console.error('Failed to parse mock user', e);
      }
      setLoading(false);
      return;
    }

    const hasFirebaseConfig = process.env.REACT_APP_FIREBASE_API_KEY && process.env.REACT_APP_FIREBASE_API_KEY !== 'your_value_here';
    
    if (!hasFirebaseConfig) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(
        auth,
        (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
      return unsubscribe;
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    sessionStorage.removeItem('fairlens_mock_user');
    setUser(null);
    
    const hasFirebaseConfig = process.env.REACT_APP_FIREBASE_API_KEY && process.env.REACT_APP_FIREBASE_API_KEY !== 'your_value_here';
    if (!hasFirebaseConfig) return;

    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  return { user, loading, error, logout };
}
