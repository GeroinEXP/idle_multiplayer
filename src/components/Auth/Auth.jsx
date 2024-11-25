import React, { useState } from 'react';
import { auth } from '../../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  Box,
  Button,
  Input,
  VStack,
  Text,
  useToast,
  Container,
  Heading,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel
} from '@chakra-ui/react';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const db = getFirestore();

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  // Функция для создания документа пользователя
  const createUserDocument = async (user) => {
    const userRef = doc(db, 'users', user.uid);
    const userData = {
      email: user.email,
      createdAt: new Date().toISOString(),
      isAdmin: false, // По умолчанию не админ
      stats: {
        level: 1,
        experience: 0,
        nextLevelExp: 100,
        gold: 0,
      },
      skills: {
        woodcutting: {
          level: 1,
          experience: 0,
          nextLevelExp: 100,
        },
        mining: {
          level: 1,
          experience: 0,
          nextLevelExp: 100,
        },
        fishing: {
          level: 1,
          experience: 0,
          nextLevelExp: 100,
        }
      }
    };

    try {
      await setDoc(userRef, userData);
    } catch (error) {
      console.error("Error creating user document:", error);
      throw error;
    }
  };

  const checkBanStatus = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return false;

      const userData = userDoc.data();
      if (!userData.ban) return false;

      // Проверяем срок бана
      if (userData.ban.banEndTime) {
        const endTime = userData.ban.banEndTime.toDate();
        if (endTime <= new Date()) {
          return false;
        }
      }

      setBanInfo(userData.ban);
      return true;
    } catch (error) {
      console.error('Error checking ban status:', error);
      return false;
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserDocument(userCredential.user);
      
      toast({
        title: "Account created successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
    setIsLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const isBanned = await checkBanStatus(userCredential.user.uid);
      
      if (isBanned) {
        await signOut(auth);
        setIsBanModalOpen(true);
        return;
      }

      toast({
        title: 'Signed in successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error signing in',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const isBanned = await checkBanStatus(result.user.uid);
      
      if (isBanned) {
        await signOut(auth);
        setIsBanModalOpen(true);
        return;
      }

      // Проверяем, существует ли документ пользователя
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await createUserDocument(result.user);
      }

      toast({
        title: 'Signed in successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error signing in with Google',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.sm" py={10}>
      <VStack spacing={8}>
        <Box p={8} borderWidth={1} borderRadius={8} boxShadow="lg" w="100%">
          <VStack spacing={4}>
            <Heading>Sign In</Heading>
            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormControl>
            <Button
              colorScheme="blue"
              width="100%"
              onClick={handleSignIn}
              isLoading={isLoading}
            >
              Sign In
            </Button>
            <Button
              colorScheme="red"
              width="100%"
              onClick={handleGoogleSignIn}
              isLoading={isLoading}
            >
              Sign in with Google
            </Button>
          </VStack>
        </Box>
      </VStack>
      <Modal isOpen={isBanModalOpen} onClose={() => setIsBanModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Account Banned</ModalHeader>
          <ModalBody>
            {banInfo && (
              <>
                <Text>
                  Your account has been banned.
                  {banInfo.banReason && ` Reason: ${banInfo.banReason}`}
                </Text>
                {banInfo.banEndTime && (
                  <Text>
                    Ban expires: {banInfo.banEndTime.toDate().toLocaleString()}
                  </Text>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setIsBanModalOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default Auth;
