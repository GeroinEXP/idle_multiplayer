import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Divider,
  Grid,
  Image,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const db = getFirestore();

const PlayerView = ({ playerId, isOpen, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [items, setItems] = useState({});

  // Очистка состояния при закрытии
  const handleClose = () => {
    setProfile(null);
    setEquipment(null);
    setItems({});
    onClose();
  };

  // Сброс состояния при смене игрока
  useEffect(() => {
    if (playerId && isOpen) {
      // Сначала очищаем старые данные
      setProfile(null);
      setEquipment(null);
      setItems({});
      // Затем загружаем новые
      loadProfile();
    }
  }, [playerId, isOpen]);

  // Загрузка профиля игрока
  const loadProfile = async () => {
    try {
      console.log('Loading profile for player:', playerId);
      
      // Загружаем данные пользователя из коллекции users
      const userRef = doc(db, 'users', playerId);
      const userDoc = await getDoc(userRef);

      // Загружаем профиль из коллекции players
      const playerRef = doc(db, 'players', playerId);
      const playerDoc = await getDoc(playerRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const playerData = playerDoc.exists() ? playerDoc.data() : null;
        
        console.log('User data:', userData);
        console.log('Player data:', playerData);
        
        setProfile({
          name: playerData?.name || userData.email.split('@')[0], // Используем имя из профиля или email как запасной вариант
          createdAt: userData.createdAt,
          stats: userData.stats || {},
          skills: userData.skills || {}
        });
        
        // Получаем экипировку
        if (userData.equipment) {
          console.log('Equipment data:', userData.equipment);
          setEquipment(userData.equipment);
        }
      }

      // Загрузка данных о предметах из gameData/items
      const itemsRef = doc(db, 'gameData', 'items');
      const itemsDoc = await getDoc(itemsRef);

      if (itemsDoc.exists()) {
        const itemsData = itemsDoc.data();
        console.log('Loaded items data:', itemsData);
        setItems(itemsData);
      } else {
        console.log('No items data found in gameData/items');
      }

    } catch (error) {
      console.error('Error loading player profile:', error);
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{profile?.name}'s Profile</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={6} align="stretch">
            {/* Основная информация */}
            <Card>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Heading size="md">{profile.name}</Heading>
                  <Text color="gray.500">
                    Player since: {new Date(profile.createdAt).toLocaleDateString()}
                  </Text>

                  <Divider />

                  <StatGroup>
                    <Stat>
                      <StatLabel>Level</StatLabel>
                      <StatNumber>{profile.stats?.level || 1}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>Experience</StatLabel>
                      <StatNumber>{profile.stats?.experience || 0}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>Gold</StatLabel>
                      <StatNumber>{profile.stats?.gold || 0}</StatNumber>
                    </Stat>
                  </StatGroup>

                  <Divider />

                  <VStack align="stretch" spacing={2}>
                    <Heading size="sm">Skills</Heading>
                    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                      {Object.entries(profile.skills || {}).map(([skillName, skillData]) => (
                        <Box key={skillName} p={2} borderWidth={1} borderRadius="md">
                          <Text fontWeight="bold" textTransform="capitalize">{skillName}</Text>
                          <Text>Level: {skillData.level}</Text>
                          <Text>Exp: {skillData.experience}/{skillData.nextLevelExp}</Text>
                        </Box>
                      ))}
                    </Grid>
                  </VStack>
                </VStack>
              </CardBody>
            </Card>

            {/* Экипировка */}
            <Card>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Heading size="md">Equipment</Heading>
                  <Grid
                    templateColumns="repeat(3, 1fr)"
                    gap={4}
                    justifyItems="center"
                  >
                    {['head', 'chest', 'legs', 'feet', 'weapon'].map((slot) => {
                      const itemId = equipment?.[slot];
                      const item = items[itemId];
                      console.log(`Slot ${slot}:`, { itemId, item, allItems: items });

                      return (
                        <Tooltip
                          key={slot}
                          label={
                            item 
                              ? `${item.name}\n${
                                  item.stats 
                                    ? Object.entries(item.stats)
                                        .map(([stat, value]) => `${stat}: ${value}`)
                                        .join('\n')
                                    : 'No stats'
                                }`
                              : 'Empty slot'
                          }
                          placement="top"
                        >
                          <Box
                            w="80px"
                            h="80px"
                            borderWidth={1}
                            borderRadius="md"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            bg="gray.50"
                            position="relative"
                            flexDirection="column"
                          >
                            {item ? (
                              <>
                                <Box
                                  position="absolute"
                                  top="-8px"
                                  left="50%"
                                  transform="translateX(-50%)"
                                  bg="blue.100"
                                  px={2}
                                  py={1}
                                  borderRadius="md"
                                  whiteSpace="nowrap"
                                  fontSize="xs"
                                >
                                  {item.name}
                                </Box>
                                {item.icon ? (
                                  <Image
                                    src={item.icon}
                                    alt={item.name}
                                    maxW="50px"
                                    maxH="50px"
                                  />
                                ) : (
                                  <Box
                                    w="50px"
                                    h="50px"
                                    bg="gray.200"
                                    borderRadius="md"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                  >
                                    <Text fontSize="xs" textAlign="center">
                                      {item.name.substring(0, 2)}
                                    </Text>
                                  </Box>
                                )}
                                {item.stats && (
                                  <Text
                                    position="absolute"
                                    bottom="-8px"
                                    left="50%"
                                    transform="translateX(-50%)"
                                    bg="green.100"
                                    px={2}
                                    py={1}
                                    borderRadius="md"
                                    whiteSpace="nowrap"
                                    fontSize="xs"
                                  >
                                    {Object.entries(item.stats)
                                      .map(([stat, value]) => `${stat}: ${value}`)
                                      .join(', ')}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <>
                                <Text color="gray.400" fontSize="sm">
                                  Empty
                                </Text>
                                <Text
                                  position="absolute"
                                  bottom="-8px"
                                  left="50%"
                                  transform="translateX(-50%)"
                                  bg="gray.100"
                                  px={2}
                                  py={1}
                                  borderRadius="md"
                                  whiteSpace="nowrap"
                                  fontSize="xs"
                                >
                                  {slot}
                                </Text>
                              </>
                            )}
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Grid>
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default PlayerView;
