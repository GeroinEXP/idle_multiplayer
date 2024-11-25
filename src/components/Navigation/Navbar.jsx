import React from 'react';
import {
  Box,
  Flex,
  Button,
  Spacer,
  useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase';
import { signOut } from 'firebase/auth';

const Navbar = ({ isAdmin }) => {
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
      toast({
        title: "Logged out successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error logging out",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box bg="gray.100" px={4} py={2}>
      <Flex maxW="container.xl" mx="auto" alignItems="center">
        <Button
          variant="ghost"
          onClick={() => navigate('/game')}
        >
          Game
        </Button>
        
        <Spacer />
        
        {isAdmin && (
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            mr={2}
            colorScheme="purple"
          >
            Admin Panel
          </Button>
        )}
        
        <Button
          colorScheme="red"
          variant="outline"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Flex>
    </Box>
  );
};

export default Navbar;
