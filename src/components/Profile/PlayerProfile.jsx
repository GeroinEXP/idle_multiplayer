import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  useToast,
  Avatar,
  Heading,
  FormControl,
  FormLabel,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Divider,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Grid,
  GridItem,
  Image,
  Tooltip,
} from '@chakra-ui/react';
import { auth } from '../../config/firebase';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const db = getFirestore();

const PlayerProfile = ({ userId }) => {
  const [profile, setProfile] = useState(null);
  const [editName, setEditName] = useState('');
  const [equipment, setEquipment] = useState(null);
  const [items, setItems] = useState({});
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const currentUser = auth.currentUser;
  const isOwnProfile = !userId || userId === currentUser?.uid;

  // Define all possible equipment slots
  const equipmentSlots = {
    head: "Голова",
    chest: "Грудь",
    legs: "Ноги",
    feet: "Ботинки",
    weapon: "Оружие"
  };

  // Загрузка профиля и экипировки
  const loadProfile = async () => {
    const targetUserId = userId || currentUser?.uid;
    if (!targetUserId) return;

    try {
      // Загружаем профиль игрока
      const profileRef = doc(db, 'players', targetUserId);
      const profileDoc = await getDoc(profileRef);

      // Загружаем данные пользователя (включая экипировку)
      const userRef = doc(db, 'users', targetUserId);
      const userDoc = await getDoc(userRef);

      // Загружаем данные о предметах
      const itemsRef = doc(db, 'gameData', 'items');
      const itemsDoc = await getDoc(itemsRef);

      if (profileDoc.exists()) {
        setProfile(profileDoc.data());
        setEditName(profileDoc.data().name || '');
      } else if (isOwnProfile) {
        const defaultProfile = {
          name: '',
          userId: targetUserId,
          createdAt: new Date().toISOString(),
          stats: {
            totalPlayTime: 0,
            itemsCollected: 0,
            skillsLearned: 0
          }
        };
        await setDoc(profileRef, defaultProfile);
        setProfile(defaultProfile);
        setEditName('');
        onOpen();
      }

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('Loading equipment:', userData.equipment);
        setEquipment(userData.equipment || {});
      }

      if (itemsDoc.exists()) {
        console.log('Loading items data:', itemsDoc.data());
        setItems(itemsDoc.data());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  // Сохранение имени (только для своего профиля)
  const handleSaveName = async () => {
    if (!isOwnProfile) return;
    if (!editName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const profileRef = doc(db, 'players', currentUser.uid);
      await setDoc(profileRef, {
        ...profile,
        name: editName.trim()
      }, { merge: true });
      onClose();
      toast({
        title: 'Success',
        description: 'Name updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update name',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (!profile || !equipment || !items) {
    return <Box>Loading...</Box>;
  }

  return (
    <VStack spacing={4} align="stretch">
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between">
              <Avatar size="xl" name={profile.name} />
              <Box flex="1" ml={4}>
                <Heading size="md">{profile.name || 'Anonymous'}</Heading>
                {isOwnProfile && (
                  <Button size="sm" onClick={onOpen} mt={2}>
                    Edit Name
                  </Button>
                )}
              </Box>
            </HStack>

            <Divider />

            <StatGroup>
              <Stat>
                <StatLabel>Play Time</StatLabel>
                <StatNumber>{profile.stats?.totalPlayTime || 0}h</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Items</StatLabel>
                <StatNumber>{profile.stats?.itemsCollected || 0}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Skills</StatLabel>
                <StatNumber>{profile.stats?.skillsLearned || 0}</StatNumber>
              </Stat>
            </StatGroup>
          </VStack>
        </CardBody>
      </Card>

      {/* Equipment Card */}
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Heading size="md">Экипировка</Heading>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              {Object.entries(equipmentSlots).map(([slot, label]) => {
                const itemId = equipment?.[slot];
                console.log(`Checking slot ${slot}, itemId:`, itemId);
                const equippedItem = itemId ? items[itemId] : null;
                console.log('Found item:', equippedItem);
                
                return (
                  <GridItem key={slot}>
                    <Card variant="outline" bg={equippedItem ? "white" : "gray.100"}>
                      <CardBody>
                        <VStack align="stretch" spacing={2}>
                          <HStack justify="space-between">
                            <Text fontWeight="bold">{label}</Text>
                            {equippedItem && (
                              <Image 
                                src={equippedItem.icon} 
                                fallbackSrc="https://via.placeholder.com/40"
                                boxSize="40px"
                                objectFit="cover"
                              />
                            )}
                          </HStack>
                          
                          {equippedItem ? (
                            <Box>
                              <Text color="blue.600" fontWeight="semibold">
                                {equippedItem.name}
                              </Text>
                              <Text fontSize="sm" color="gray.600" mb={2}>
                                {equippedItem.description}
                              </Text>
                              <VStack align="stretch" mt={2} spacing={1}>
                                {equippedItem.stats && Object.entries(equippedItem.stats).map(([stat, value]) => {
                                  if (stat === 'type') return null;
                                  return (
                                    <HStack key={stat} justify="space-between">
                                      <Text fontSize="sm" textTransform="capitalize">
                                        {stat === 'attack' ? 'Атака' :
                                         stat === 'defense' ? 'Защита' :
                                         stat === 'health' ? 'Здоровье' : stat}:
                                      </Text>
                                      <Text fontSize="sm" fontWeight="semibold">
                                        {value}
                                      </Text>
                                    </HStack>
                                  );
                                })}
                              </VStack>
                            </Box>
                          ) : (
                            <Text color="gray.500" fontSize="sm">Пустой слот</Text>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  </GridItem>
                );
              })}
            </Grid>
          </VStack>
        </CardBody>
      </Card>

      {/* Edit Name Modal */}
      {isOwnProfile && (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Edit Profile Name</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your name"
                />
              </FormControl>
            </ModalBody>

            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={handleSaveName}>
                Save
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </VStack>
  );
};

export default PlayerProfile;
