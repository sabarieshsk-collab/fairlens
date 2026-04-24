import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

export function useOrganization() {
  const { user, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [fetchedUid, setFetchedUid] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setOrganization(null);
      setFetchedUid(null);
      return;
    }

    if (user.uid === 'mock-user-123') {
      if (localStorage.getItem('fairlens_onboarding_complete') === 'true') {
        setOrganization({
          orgId: 'mock-org-123',
          name: 'Tech Corp India',
          sector: 'Technology',
          headcount: '500-2000',
          states: ['Karnataka', 'Maharashtra']
        });
      } else {
        setOrganization(null);
      }
      setFetchedUid(user.uid);
      return;
    }

    const fetchOrganization = async () => {
      try {
        const orgRef = doc(db, 'users', user.uid);
        const orgSnap = await getDoc(orgRef);
        
        if (orgSnap.exists()) {
          setOrganization(orgSnap.data());
        } else {
          setOrganization(null);
        }
        setFetchedUid(user.uid);
      } catch (err) {
        setError(err);
        setFetchedUid(user.uid);
      }
    };

    fetchOrganization();
  }, [user, authLoading]);

  const currentUid = user ? user.uid : null;
  const orgLoading = authLoading || fetchedUid !== currentUid;

  return { organization, orgLoading, error };
}
