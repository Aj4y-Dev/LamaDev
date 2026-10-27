import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetwork(): { isOnline: boolean } {
  const [isOnline, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false));
    return unsub;
  }, []);
  return { isOnline };
}
