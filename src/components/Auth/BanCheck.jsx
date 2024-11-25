import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Text,
  VStack,
  Button,
  useToast
} from '@chakra-ui/react';

const BanCheck = ({ children }) => {
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!auth.currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        if (!userData.ban) return;

        // Проверяем, не истек ли временный бан
        if (userData.ban.banEndTime) {
          const endTime = userData.ban.banEndTime.toDate();
          if (endTime <= new Date()) {
            console.log('Ban expired, user can access the game');
            return;
          }
        }

        console.log('User is banned:', userData.ban);
        setIsBanned(true);
        setBanInfo(userData.ban);
      } catch (error) {
        console.error('Error checking ban status:', error);
        toast({
          title: 'Error checking account status',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    checkBanStatus();
  }, [auth.currentUser, toast]);

  const formatBanDuration = (ban) => {
    if (!ban.banEndTime) return 'Permanent';
    
    const endTime = ban.banEndTime.toDate();
    const now = new Date();
    const hours = Math.ceil((endTime - now) / (1000 * 60 * 60));
    
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    } else {
      const days = Math.ceil(hours / 24);
      return `${days} day${days === 1 ? '' : 's'}`;
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  if (!isBanned) {
    return children;
  }

  return (
    <Modal isOpen={true} onClose={() => {}} closeOnOverlayClick={false} closeOnEsc={false}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="red.500">Account Suspended</ModalHeader>
        <ModalBody>
          <VStack spacing={4} align="stretch" pb={4}>
            <Text>Your account has been suspended.</Text>
            
            <Text fontWeight="bold">Reason:</Text>
            <Text>{banInfo?.banReason || 'No reason provided'}</Text>
            
            <Text fontWeight="bold">Duration:</Text>
            <Text>{formatBanDuration(banInfo)}</Text>
            
            {banInfo?.banEndTime && (
              <>
                <Text fontWeight="bold">Ban will be lifted:</Text>
                <Text>{banInfo.banEndTime.toDate().toLocaleString()}</Text>
              </>
            )}

            <Button colorScheme="blue" onClick={handleLogout} mt={4}>
              Logout
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default BanCheck;
