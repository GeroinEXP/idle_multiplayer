import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  Progress,
  Grid,
  GridItem,
  useToast,
  Heading,
  Card,
  CardBody,
  Image,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Icon
} from '@chakra-ui/react';
import { FaTools, FaBoxOpen } from 'react-icons/fa';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  increment,
  deleteField
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import PlayerProfile from '../Profile/PlayerProfile';
import GameChat from '../Chat/GameChat';

const db = getFirestore();
const auth = getAuth();

const GameInterface = () => {
  const [userStats, setUserStats] = useState(null);
  const [skills, setSkills] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTimers, setActiveTimers] = useState({});
  const [autoTrainingActive, setAutoTrainingActive] = useState({});
  const [gameSettings, setGameSettings] = useState(null);
  const [equipment, setEquipment] = useState({
    head: null,
    chest: null,
    legs: null,
    feet: null,
    weapon: null
  });
  const timerIntervalsRef = useRef({});
  const completingRef = useRef({});  // Для отслеживания состояния завершения
  const autoTrainingRef = useRef({}); // Для хранения актуального состояния автотренировки
  const toast = useToast();

  // Обновляем ref при изменении autoTrainingActive
  useEffect(() => {
    autoTrainingRef.current = autoTrainingActive;
  }, [autoTrainingActive]);

  // Загрузка скиллов из Firestore
  const loadSkills = useCallback(async () => {
    try {
      const skillsDoc = await getDoc(doc(db, 'gameData', 'skills'));
      if (skillsDoc.exists()) {
        const skillsData = skillsDoc.data();
        setSkills(Object.values(skillsData));
      }
    } catch (error) {
      console.error('Error loading skills:', error);
      toast({
        title: 'Error loading skills',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  // Загрузка данных пользователя
  const loadUserStats = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserStats(userData);
        setEquipment(userData.equipment || {
          head: null,
          chest: null,
          legs: null,
          feet: null,
          weapon: null
        });
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
      toast({
        title: 'Error loading user stats',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  // Загрузка настроек игры
  const loadGameSettings = useCallback(async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'gameData', 'settings'));
      if (settingsDoc.exists()) {
        setGameSettings(settingsDoc.data());
      }
    } catch (error) {
      console.error('Error loading game settings:', error);
    }
  }, []);

  // Загрузка предметов
  const loadItems = useCallback(async () => {
    try {
      const itemsDoc = await getDoc(doc(db, 'gameData', 'items'));
      if (itemsDoc.exists()) {
        setItems(Object.values(itemsDoc.data()));
      }
    } catch (error) {
      console.error('Error loading items:', error);
      toast({
        title: 'Error loading items',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  useEffect(() => {
    loadSkills();
    loadUserStats();
    loadGameSettings();
    loadItems();
  }, [loadSkills, loadUserStats, loadGameSettings, loadItems]);

  const calculateExperienceForLevel = (level) => {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  };

  useEffect(() => {
    if (skills.length > 0) {
      const initialTimers = {};
      skills.forEach(skill => {
        initialTimers[skill.id] = {
          remainingSeconds: skill.timerSeconds || 60,
          totalSeconds: skill.timerSeconds || 60,
          progress: 0,
          isActive: false
        };
      });
      setActiveTimers(initialTimers);
    }
  }, [skills]);

  // Функция для добавления предметов в инвентарь
  const addItemsToInventory = async (items) => {
    if (!auth.currentUser || !items || items.length === 0) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentInventory = userData.inventory || {};

      const updatedInventory = { ...currentInventory };
      items.forEach(itemId => {
        updatedInventory[itemId] = (updatedInventory[itemId] || 0) + 1;
      });

      await updateDoc(userRef, { inventory: updatedInventory });
      
      // Обновляем локальное состояние
      setUserStats(prev => ({
        ...prev,
        inventory: updatedInventory
      }));

      toast({
        title: 'Items received!',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding items to inventory:', error);
    }
  };

  // Функция для проверки и выдачи дропа
  const checkAndGiveDrop = (skill) => {
    if (!skill.commonDrops && !skill.rareDrops) return;

    const drops = [];
    
    // Проверяем обычный дроп (50% шанс)
    if (skill.commonDrops && skill.commonDrops.length > 0 && Math.random() < 0.5) {
      const randomItem = skill.commonDrops[Math.floor(Math.random() * skill.commonDrops.length)];
      drops.push(randomItem);
    }

    // Проверяем редкий дроп (5% шанс)
    if (skill.rareDrops && skill.rareDrops.length > 0 && Math.random() < 0.05) {
      const randomItem = skill.rareDrops[Math.floor(Math.random() * skill.rareDrops.length)];
      drops.push(randomItem);
    }

    if (drops.length > 0) {
      addItemsToInventory(drops);
    }
  };

  // Функция для проверки и обновления прогресса тренировки
  const checkAndUpdateTraining = async (skillId, training) => {
    console.log('[checkAndUpdateTraining] Started for skillId:', skillId, {
      trainingData: training,
      currentTimers: activeTimers[skillId],
      isCompleting: completingRef.current[skillId]
    });

    if (!training || completingRef.current[skillId]) return;

    const now = Timestamp.now();
    const startTime = training.startTime.toDate();
    const endTime = training.endTime.toDate();
    const totalTime = endTime.getTime() - startTime.getTime();
    const elapsedTime = now.toDate().getTime() - startTime.getTime();
    const remainingTime = endTime.getTime() - now.toDate().getTime();
    const progress = Math.min((elapsedTime / totalTime) * 100, 100);

    console.log('[checkAndUpdateTraining] Time calculations:', {
      now: now.toDate().toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalTime,
      elapsedTime,
      remainingTime,
      progress
    });

    if (remainingTime <= 0) {
      try {
        // Mark as completing to prevent duplicate processing
        completingRef.current[skillId] = true;

        // Clear any existing interval
        if (timerIntervalsRef.current[skillId]) {
          clearInterval(timerIntervalsRef.current[skillId]);
          delete timerIntervalsRef.current[skillId];
        }

        // Update UI state immediately
        setActiveTimers(prev => ({
          ...prev,
          [skillId]: {
            ...prev[skillId],
            isActive: false,
            progress: 100,
            remainingSeconds: 0
          }
        }));

        // Get current skill level and exp
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) {
          delete completingRef.current[skillId];
          return;
        }

        const userData = userDoc.data();
        const currentSkill = userData.skills?.[skillId];
        
        if (!currentSkill) {
          delete completingRef.current[skillId];
          return;
        }

        // Calculate exp gain
        const baseExp = training.baseExp || 10;
        const expGain = Math.floor(baseExp * (1 + (currentSkill.level || 1) * 0.1));

        // Update exp
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          [`skills.${skillId}.exp`]: increment(expGain)
        });

        // Show completion toast
        toast({
          title: 'Training Complete!',
          description: `Gained ${expGain} exp in ${skillId}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // Clear training entry
        await updateDoc(doc(db, 'activeTraining', auth.currentUser.uid), {
          [skillId]: deleteField()
        });

        // If auto-training is enabled, start a new training session
        if (autoTrainingRef.current[skillId]) {
          console.log('[checkAndUpdateTraining] Auto-training enabled, starting new session');
          const skill = skills.find(s => s.id === skillId);
          if (skill) {
            const timerSeconds = skill.timerSeconds || 60;
            const newStartTime = Timestamp.now();
            const newEndTime = Timestamp.fromMillis(newStartTime.toMillis() + (timerSeconds * 1000));

            // Start new training session
            await updateDoc(doc(db, 'activeTraining', auth.currentUser.uid), {
              [skillId]: {
                startTime: newStartTime,
                endTime: newEndTime,
                skillId,
                baseExp: skill.baseExp
              }
            });

            // Update UI immediately for smoother transition
            setActiveTimers(prev => ({
              ...prev,
              [skillId]: {
                isActive: true,
                progress: 0,
                remainingSeconds: timerSeconds,
                totalSeconds: timerSeconds
              }
            }));
          }
        }
      } catch (error) {
        console.error('[checkAndUpdateTraining] Error:', error);
        toast({
          title: 'Error updating training',
          description: error.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        // Clear completing state
        delete completingRef.current[skillId];
      }
    }
  };

  // Функция для обновления прогресса
  const updateProgress = useCallback((skillId, startTime, endTime) => {
    console.log('[updateProgress] Starting progress updates', {
      skillId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });

    // Clear any existing interval
    if (timerIntervalsRef.current[skillId]) {
      clearInterval(timerIntervalsRef.current[skillId]);
      delete timerIntervalsRef.current[skillId];
    }

    const intervalId = setInterval(() => {
      const newNow = new Date();
      const totalTime = endTime.getTime() - startTime.getTime();
      const elapsedTime = Math.min(newNow.getTime() - startTime.getTime(), totalTime);
      const remainingTime = Math.max(endTime.getTime() - newNow.getTime(), 0);
      const progress = Math.min((elapsedTime / totalTime) * 100, 100);

      // Skip update if training is no longer active
      if (!activeTimers[skillId]?.isActive) {
        clearInterval(intervalId);
        delete timerIntervalsRef.current[skillId];
        return;
      }

      console.log('[updateProgress] Progress calculation:', {
        skillId,
        currentTime: newNow.toISOString(),
        remainingTime,
        progress,
        isActive: activeTimers[skillId]?.isActive
      });

      // Update timer state
      setActiveTimers(prev => {
        const prevTimer = prev[skillId];
        if (!prevTimer?.isActive) {
          clearInterval(intervalId);
          delete timerIntervalsRef.current[skillId];
          return prev;
        }

        // Skip update if values haven't changed significantly
        if (
          prevTimer &&
          Math.abs(prevTimer.progress - progress) < 1 &&
          Math.abs(prevTimer.remainingSeconds - Math.ceil(remainingTime / 1000)) < 1
        ) {
          return prev;
        }

        const newState = {
          ...prev,
          [skillId]: {
            ...prevTimer,
            remainingSeconds: Math.ceil(remainingTime / 1000),
            totalSeconds: Math.ceil(totalTime / 1000),
            progress,
            isActive: true
          }
        };

        // If training is complete
        if (remainingTime <= 0) {
          clearInterval(intervalId);
          delete timerIntervalsRef.current[skillId];
          checkAndUpdateTraining(skillId, {
            startTime: new Timestamp(Math.floor(startTime.getTime() / 1000), 0),
            endTime: new Timestamp(Math.floor(endTime.getTime() / 1000), 0)
          });
          return {
            ...newState,
            [skillId]: {
              ...newState[skillId],
              isActive: false,
              progress: 100,
              remainingSeconds: 0
            }
          };
        }

        return newState;
      });
    }, 1000);

    timerIntervalsRef.current[skillId] = intervalId;
    return intervalId;
  }, []);

  // Training effect
  useEffect(() => {
    if (!auth.currentUser) return;

    console.log('[Training Effect] Starting training subscription');
    
    // Cleanup any existing intervals before starting new subscription
    Object.values(timerIntervalsRef.current).forEach(intervalId => {
      clearInterval(intervalId);
    });
    timerIntervalsRef.current = {};

    const unsubscribe = onSnapshot(doc(db, 'activeTraining', auth.currentUser.uid), async (doc) => {
      const trainingData = doc.data() || {};
      const activeSkills = new Set();

      // Check for missed trainings first
      const currentTime = Timestamp.now();
      for (const [skillId, training] of Object.entries(trainingData)) {
        console.log('[checkMissedTrainings] Checking training:', {
          skillId,
          training,
          currentTime: currentTime.toDate().toISOString()
        });

        if (training && training.endTime.toDate() <= currentTime.toDate()) {
          await checkAndUpdateTraining(skillId, training);
        }
      }

      // Process current trainings
      Object.entries(trainingData).forEach(([skillId, training]) => {
        if (!training) return;
        activeSkills.add(skillId);

        const hasExistingInterval = !!timerIntervalsRef.current[skillId];
        console.log('[Training Effect] Processing training update:', {
          skillId,
          training,
          hasExistingInterval
        });

        // Skip if already has an interval
        if (hasExistingInterval) {
          return;
        }

        // Check if training has already ended
        const now = Timestamp.now();
        if (training.endTime.toDate() <= now.toDate()) {
          checkAndUpdateTraining(skillId, training);
        } else {
          // Start progress tracking for ongoing training
          checkAndUpdateTraining(skillId, training);
          const intervalId = updateProgress(
            skillId,
            training.startTime.toDate(),
            training.endTime.toDate()
          );
          timerIntervalsRef.current[skillId] = intervalId;

          console.log('[Training Effect] New interval created:', {
            skillId,
            intervalId
          });
        }
      });

      // Clear intervals for skills that are no longer training
      Object.keys(timerIntervalsRef.current).forEach(skillId => {
        if (!activeSkills.has(skillId)) {
          clearInterval(timerIntervalsRef.current[skillId]);
          delete timerIntervalsRef.current[skillId];
        }
      });
    });

    // Cleanup function
    return () => {
      console.log('[Training Effect] Cleaning up', {
        activeIntervals: Object.keys(timerIntervalsRef.current)
      });
      
      // Clear all intervals
      Object.values(timerIntervalsRef.current).forEach(intervalId => {
        clearInterval(intervalId);
      });
      timerIntervalsRef.current = {};
      
      unsubscribe();
    };
  }, [auth.currentUser]); // Remove updateProgress from dependencies to prevent recreation

  // Функция старта тренировки
  const startTraining = async (skillId) => {
    const skill = skills.find(s => s.id === skillId);
    if (!skill || activeTimers[skillId]?.isActive) return;

    try {
      const timerSeconds = skill.timerSeconds || 60;
      const now = Timestamp.now();
      const endTime = Timestamp.fromMillis(now.toMillis() + (timerSeconds * 1000));

      // Создаем или обновляем запись о тренировке
      const trainingRef = doc(db, 'activeTraining', auth.currentUser.uid);
      const trainingDoc = await getDoc(trainingRef);
      
      if (!trainingDoc.exists()) {
        await setDoc(trainingRef, {});
      }

      await updateDoc(trainingRef, {
        [skillId]: {
          startTime: now,
          endTime,
          skillId,
          baseExp: skill.baseExp
        }
      });

      // Устанавливаем начальное состояние таймера
      setActiveTimers(prev => ({
        ...prev,
        [skillId]: {
          remainingSeconds: timerSeconds,
          totalSeconds: timerSeconds,
          progress: 0,
          isActive: true
        }
      }));

    } catch (error) {
      console.error('Error starting training:', error);
      toast({
        title: 'Error starting training',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Загружаем состояние автотренировки при монтировании
  useEffect(() => {
    if (!auth.currentUser) return;

    const loadAutoTrainingState = async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        if (userData.autoTraining) {
          setAutoTrainingActive(userData.autoTraining);
          autoTrainingRef.current = userData.autoTraining;
        }
      } catch (error) {
        console.error('Error loading auto training state:', error);
      }
    };

    loadAutoTrainingState();
  }, [auth.currentUser]);

  // Функция переключения автотренировки
  const toggleAutoTraining = async (skillId) => {
    try {
      const newState = {
        ...autoTrainingActive,
        [skillId]: !autoTrainingActive[skillId]
      };

      // Обновляем локальное состояние
      setAutoTrainingActive(newState);
      autoTrainingRef.current = newState;

      // Сохраняем в Firestore
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        autoTraining: newState
      });

      // Если включили автотренировку и нет активного таймера, запускаем тренировку
      if (newState[skillId] && !activeTimers[skillId]?.isActive) {
        startTraining(skillId);
      }
    } catch (error) {
      console.error('Error toggling auto training:', error);
      toast({
        title: 'Error toggling auto training',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Функция экипировки предмета
  const equipItem = async (item, slot) => {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentInventory = userData.inventory || {};
      const currentEquipment = userData.equipment || {};

      // Снимаем текущий предмет если есть
      if (currentEquipment[slot]) {
        currentInventory[currentEquipment[slot]] = (currentInventory[currentEquipment[slot]] || 0) + 1;
      }

      // Снимаем предмет из инвентаря
      if (currentInventory[item.id] > 1) {
        currentInventory[item.id]--;
      } else {
        delete currentInventory[item.id];
      }

      // Экипируем новый предмет
      const newEquipment = {
        ...currentEquipment,
        [slot]: item.id
      };

      // Обновляем в базе данных
      await updateDoc(userRef, {
        inventory: currentInventory,
        equipment: newEquipment
      });

      // Обновляем локальное состояние
      setUserStats(prev => ({
        ...prev,
        inventory: currentInventory
      }));
      setEquipment(newEquipment);

      toast({
        title: 'Item equipped',
        description: `${item.name} equipped in ${slot} slot`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error equipping item:', error);
      toast({
        title: 'Error equipping item',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Функция снятия предмета
  const unequipItem = async (slot) => {
    if (!auth.currentUser || !equipment[slot]) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentInventory = userData.inventory || {};
      const currentEquipment = userData.equipment || {};

      // Возвращаем предмет в инвентарь
      const itemId = currentEquipment[slot];
      currentInventory[itemId] = (currentInventory[itemId] || 0) + 1;

      // Очищаем слот
      const newEquipment = {
        ...currentEquipment,
        [slot]: null
      };

      // Обновляем в базе данных
      await updateDoc(userRef, {
        inventory: currentInventory,
        equipment: newEquipment
      });

      // Обновляем локальное состояние
      setUserStats(prev => ({
        ...prev,
        inventory: currentInventory
      }));
      setEquipment(newEquipment);

      toast({
        title: 'Item unequipped',
        description: `Item unequipped from ${slot} slot`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error unequipping item:', error);
      toast({
        title: 'Error unequipping item',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p={5}>
      <Tabs variant="enclosed" colorScheme="blue">
        <TabList mb="1em">
          <Tab>Profile</Tab>
          <Tab><Icon as={FaTools} mr={2} /> Skills</Tab>
          <Tab><Icon as={FaBoxOpen} mr={2} /> Inventory</Tab>
          <Tab>Chat</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <PlayerProfile />
          </TabPanel>
          <TabPanel>
            <Grid templateColumns="repeat(3, 1fr)" gap={4}>
              {skills.map((skill) => {
                const userSkill = userStats?.skills?.[skill.id] || {
                  level: 1,
                  experience: 0,
                  nextLevelExp: calculateExperienceForLevel(2)
                };

                const timer = activeTimers[skill.id] || {
                  remainingSeconds: skill.timerSeconds || 60,
                  totalSeconds: skill.timerSeconds || 60,
                  progress: 0,
                  isActive: false
                };

                return (
                  <Card key={skill.id}>
                    <CardBody>
                      <VStack spacing={3}>
                        <HStack justify="space-between" width="100%">
                          {skill.icon && (
                            <Image
                              src={skill.icon}
                              alt={skill.name}
                              boxSize="40px"
                              objectFit="cover"
                            />
                          )}
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="bold">{skill.name}</Text>
                            <Text>Level: {userSkill.level}</Text>
                          </VStack>
                        </HStack>

                        <VStack width="100%" spacing={1}>
                          <Progress
                            value={(userSkill.experience / userSkill.nextLevelExp) * 100}
                            width="100%"
                            size="sm"
                            colorScheme="green"
                          />
                          <Text fontSize="sm">
                            {userSkill.experience} / {userSkill.nextLevelExp} XP
                          </Text>
                        </VStack>

                        <VStack width="100%" spacing={1}>
                          <Progress
                            value={timer.progress}
                            width="100%"
                            size="sm"
                            colorScheme="blue"
                          />
                          <Text fontSize="sm">{timer.remainingSeconds}s</Text>
                        </VStack>

                        <Button
                          colorScheme="blue"
                          size="sm"
                          isLoading={timer.isActive}
                          onClick={() => startTraining(skill.id)}
                          width="100%"
                        >
                          Train
                        </Button>

                        <Button
                          size="sm"
                          colorScheme={autoTrainingActive[skill.id] ? "green" : "gray"}
                          onClick={() => toggleAutoTraining(skill.id)}
                          width="100%"
                        >
                          Auto {autoTrainingActive[skill.id] ? "On" : "Off"}
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>
                );
              })}
            </Grid>
          </TabPanel>

          <TabPanel>
            <Grid templateColumns="1fr 3fr" gap={6}>
              {/* Equipment Section */}
              <Card>
                <CardBody>
                  <VStack spacing={4}>
                    <Heading size="md">Equipment</Heading>
                    <Grid templateRows="repeat(5, 1fr)" gap={4} width="100%">
                      {[
                        { slot: 'head', label: 'Head' },
                        { slot: 'chest', label: 'Chest' },
                        { slot: 'legs', label: 'Legs' },
                        { slot: 'feet', label: 'Feet' },
                        { slot: 'weapon', label: 'Weapon' }
                      ].map(({ slot, label }) => {
                        const equippedItem = equipment[slot] ? items.find(i => i.id === equipment[slot]) : null;

                        return (
                          <Card key={slot} variant="outline">
                            <CardBody>
                              <HStack justify="space-between">
                                <Text fontWeight="bold">{label}:</Text>
                                {equippedItem ? (
                                  <HStack>
                                    {equippedItem.icon && (
                                      <Image
                                        src={equippedItem.icon}
                                        alt={equippedItem.name}
                                        boxSize="30px"
                                        objectFit="cover"
                                      />
                                    )}
                                    <VStack align="start" spacing={0}>
                                      <Text>{equippedItem.name}</Text>
                                      {equippedItem.stats && (
                                        <Text fontSize="xs" color="gray.500">
                                          {Object.entries(equippedItem.stats)
                                            .map(([stat, value]) => `${stat}: ${value}`)
                                            .join(', ')}
                                        </Text>
                                      )}
                                    </VStack>
                                    <Button
                                      size="sm"
                                      colorScheme="red"
                                      onClick={() => unequipItem(slot)}
                                    >
                                      Unequip
                                    </Button>
                                  </HStack>
                                ) : (
                                  <Text color="gray.500">Empty</Text>
                                )}
                              </HStack>
                            </CardBody>
                          </Card>
                        );
                      })}
                    </Grid>
                  </VStack>
                </CardBody>
              </Card>

              {/* Inventory Grid */}
              <VStack align="stretch">
                <Heading size="md">Inventory</Heading>
                <Grid templateColumns="repeat(4, 1fr)" gap={4}>
                  {userStats?.inventory && Object.entries(userStats.inventory).length > 0 ? (
                    Object.entries(userStats.inventory).map(([itemId, quantity]) => {
                      const item = items.find(i => i.id === itemId);
                      if (!item) return null;
                      
                      return (
                        <Card key={itemId}>
                          <CardBody>
                            <VStack>
                              {item.icon && (
                                <Image
                                  src={item.icon}
                                  alt={item.name}
                                  boxSize="50px"
                                  objectFit="cover"
                                />
                              )}
                              <Text fontWeight="bold">{item.name}</Text>
                              <Text fontSize="sm" color="gray.500">{item.type}</Text>
                              <Text>x{quantity}</Text>
                              {item.stats && (
                                <VStack spacing={0} fontSize="sm" color="gray.600">
                                  {Object.entries(item.stats).map(([stat, value]) => (
                                    <Text key={stat}>{stat}: {value}</Text>
                                  ))}
                                </VStack>
                              )}
                              {item.type === 'equipment' && (
                                <Button
                                  size="sm"
                                  colorScheme="blue"
                                  onClick={() => {
                                    const slot = item.slot || (
                                      item.type === 'weapon' ? 'weapon' :
                                      item.type === 'head' ? 'head' :
                                      item.type === 'chest' ? 'chest' :
                                      item.type === 'legs' ? 'legs' :
                                      item.type === 'feet' ? 'feet' : null
                                    );
                                    if (slot) {
                                      equipItem(item, slot);
                                    }
                                  }}
                                >
                                  Equip
                                </Button>
                              )}
                            </VStack>
                          </CardBody>
                        </Card>
                      );
                    })
                  ) : (
                    <GridItem colSpan={4}>
                      <Card>
                        <CardBody>
                          <Text color="gray.500" textAlign="center">Your inventory is empty</Text>
                        </CardBody>
                      </Card>
                    </GridItem>
                  )}
                </Grid>
              </VStack>
            </Grid>
          </TabPanel>

          <TabPanel>
            <GameChat />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default GameInterface;
