import React, { useState, useEffect } from 'react';
import { Box, Button, Text, useToast } from '@chakra-ui/react';
import { auth } from '../config/firebase';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const db = getFirestore();

const AdminSetup = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const toast = useToast();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const makeAdmin = async () => {
    if (!currentUser) return;

    try {
      // Создаем документ пользователя с правами администратора
      await setDoc(doc(db, 'users', currentUser.uid), {
        email: currentUser.email,
        isAdmin: true,
        createdAt: new Date().toISOString()
      });

      toast({
        title: 'Admin rights granted',
        description: `User ${currentUser.email} is now an admin`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (!currentUser) {
    return <Text>Please log in first</Text>;
  }

  return (
    <Box p={5}>
      <Text mb={4}>Current user: {currentUser.email}</Text>
      <Button colorScheme="blue" onClick={makeAdmin}>
        Make me an admin
      </Button>
    </Box>
  );
};

export default AdminSetup;
