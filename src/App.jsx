import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth/Auth';
import GameInterface from './components/Game/GameInterface';
import AdminPanel from './components/Admin/AdminPanel';
import Navbar from './components/Navigation/Navbar';
import AdminSetup from './components/AdminSetup';
import { auth } from './config/firebase';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Box, useToast } from '@chakra-ui/react';
import { signOut } from 'firebase/auth';
import { ChakraProvider } from '@chakra-ui/react';

const db = getFirestore();

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.ban) {
            const isBanned = userData.ban.isBanned;
            const banEndTime = userData.ban.banEndTime;
            
            if (isBanned && (!banEndTime || banEndTime.toDate() > new Date())) {
              // Пользователь забанен
              await signOut(auth);
              toast({
                title: 'Access Denied',
                description: userData.ban.banReason 
                  ? `You are banned. Reason: ${userData.ban.banReason}`
                  : 'You are banned from accessing the game.',
                status: 'error',
                duration: 5000,
                isClosable: true,
              });
              return;
            }
          }
        }
        setUser(user);
        setIsAdmin(userDoc.data()?.isAdmin || false);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  return (
    <ChakraProvider>
      <Router>
        <Box>
          {user && <Navbar isAdmin={isAdmin} />}
          <Routes>
            <Route 
              path="/" 
              element={user ? <Navigate to="/game" /> : <Auth />} 
            />
            <Route 
              path="/game" 
              element={user ? <GameInterface /> : <Navigate to="/" />} 
            />
            <Route 
              path="/admin" 
              element={
                user && isAdmin ? (
                  <AdminPanel />
                ) : (
                  <Navigate to="/" />
                )
              } 
            />
            <Route 
              path="/setup-admin" 
              element={user ? <AdminSetup /> : <Navigate to="/" />} 
            />
          </Routes>
        </Box>
      </Router>
    </ChakraProvider>
  );
}

export default App;
