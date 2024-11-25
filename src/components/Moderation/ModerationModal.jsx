import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Input,
  Select,
  useToast,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Box
} from '@chakra-ui/react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

const ModerationModal = ({ isOpen, onClose, targetUserId, targetUsername, onModerationAction, setModerationReason }) => {
  const [duration, setDuration] = useState(1);
  const [timeUnit, setTimeUnit] = useState('hours');
  const [reason, setReason] = useState('');
  const [userStatus, setUserStatus] = useState(null);
  const [moderationHistory, setModerationHistory] = useState([]);
  const [activeWarns, setActiveWarns] = useState([]);
  const [moderatorNames, setModeratorNames] = useState({});
  const toast = useToast();

  const getDurationInSeconds = () => {
    const multipliers = {
      minutes: 60,
      hours: 3600,
      days: 86400,
      weeks: 604800,
    };
    return duration * multipliers[timeUnit];
  };

  useEffect(() => {
    if (!targetUserId) return;
    
    const userRef = doc(db, 'users', targetUserId);
    
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const currentTime = Date.now();
        
        const currentWarns = (userData.warns || []).filter(warn => 
          warn.endTime > currentTime
        );

        setActiveWarns(currentWarns);
        
        setUserStatus({
          isMuted: userData.isMuted && userData.muteEndTime > currentTime,
          isWarned: currentWarns.length > 0,
          isBanned: userData.isBanned && userData.banEndTime > currentTime,
          muteEndTime: userData.muteEndTime || null,
          banEndTime: userData.banEndTime || null,
          muteReason: userData.muteReason || '',
          banReason: userData.banReason || '',
        });

        const history = [...(userData.moderationHistory || [])];
        history.sort((a, b) => b.timestamp - a.timestamp);
        setModerationHistory(history);
      }
    });

    return () => unsubscribe();
  }, [targetUserId]);

  useEffect(() => {
    if (!targetUserId) return;
    
    const userStatusRef = doc(db, 'userStatus', targetUserId);
    
    const unsubscribe = onSnapshot(userStatusRef, (doc) => {
      if (doc.exists()) {
        const statusData = doc.data();
        setUserStatus(statusData);
      } else {
        setUserStatus(null);
      }
    });

    return () => unsubscribe();
  }, [targetUserId]);

  useEffect(() => {
    const loadModeratorNames = async () => {
      const moderators = new Set();
      moderationHistory.forEach(entry => {
        if (entry.moderator && entry.moderator !== 'system') {
          moderators.add(entry.moderator);
        }
      });

      const names = { ...moderatorNames };
      for (const modId of moderators) {
        if (!names[modId]) {  // Загружаем только если еще нет в кэше
          try {
            const modRef = doc(db, 'users', modId);
            const modDoc = await getDoc(modRef);
            if (modDoc.exists() && modDoc.data().name) {
              names[modId] = modDoc.data().name;
            }
          } catch (error) {
            console.error('Error loading moderator name:', error);
          }
        }
      }
      setModeratorNames(names);
    };

    if (moderationHistory.length > 0) {
      loadModeratorNames();
    }
  }, [moderationHistory]);

  const handleAction = async (action, warnTimestamp) => {
    if (!targetUserId) return;
    
    // Проверяем причину только для новых действий модерации
    if (['mute', 'warn', 'ban'].includes(action) && !reason.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, укажите причину',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const userRef = doc(db, 'userStatus', targetUserId);
      const statusDoc = await getDoc(userRef);
      const currentStatus = statusDoc.exists() ? statusDoc.data() : {};
      
      let updateData = {};
      
      // Для действий снятия блокировок не нужны duration и reason
      if (['unmute', 'unwarn', 'unban'].includes(action)) {
        if (onModerationAction) {
          await onModerationAction(action, null);
        }
      } else if (onModerationAction && setModerationReason) {
        setModerationReason(reason);
        await onModerationAction(action, `${duration} ${timeUnit}`);
      }

      switch (action) {
        case 'mute':
          updateData = {
            isMuted: true,
            mutedAt: serverTimestamp(),
            muteDuration: `${duration} ${timeUnit}`,
            muteReason: reason,
            mutedBy: auth.currentUser.uid
          };
          break;
        case 'warn':
          updateData = {
            isWarned: true,
            warnedAt: serverTimestamp(),
            warnReason: reason,
            warnedBy: auth.currentUser.uid
          };
          break;
        case 'ban':
          updateData = {
            isBanned: true,
            bannedAt: serverTimestamp(),
            banDuration: `${duration} ${timeUnit}`,
            banReason: reason,
            bannedBy: auth.currentUser.uid
          };
          break;
        case 'unmute':
          updateData = {
            isMuted: false,
            mutedAt: null,
            muteDuration: null,
            muteReason: null,
            mutedBy: null
          };
          break;
        case 'unwarn':
          updateData = {
            isWarned: false,
            warnedAt: null,
            warnReason: null,
            warnedBy: null
          };
          break;
        case 'unban':
          updateData = {
            isBanned: false,
            bannedAt: null,
            banDuration: null,
            banReason: null,
            bannedBy: null
          };
          break;
      }

      await setDoc(userRef, { ...currentStatus, ...updateData }, { merge: true });

      toast({
        title: 'Успешно',
        description: action.startsWith('un') ? 
          `Блокировка "${action.substring(2)}" снята` : 
          `Действие "${action}" выполнено`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Очищаем форму после успешного действия
      if (action.startsWith('un')) {
        setReason('');
        setDuration(1);
        setTimeUnit('hours');
      }

      onClose();
    } catch (error) {
      console.error('Error in handleAction:', error);
      toast({
        title: 'Ошибка',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'mute': return 'orange';
      case 'warn': return 'yellow';
      case 'ban': return 'red';
      case 'unmute':
      case 'unwarn':
      case 'unban':
      case 'clear-all':
        return 'green';
      default: return 'gray';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Модерация: {targetUsername}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Tabs>
            <TabList>
              <Tab>Действия</Tab>
              <Tab>История</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <HStack spacing={2}>
                    <NumberInput
                      value={duration}
                      min={1}
                      onChange={(valueString) => setDuration(parseInt(valueString))}
                      flex={1}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <Select
                      value={timeUnit}
                      onChange={(e) => setTimeUnit(e.target.value)}
                      flex={1}
                    >
                      <option value="minutes">Минут</option>
                      <option value="hours">Часов</option>
                      <option value="days">Дней</option>
                      <option value="weeks">Недель</option>
                    </Select>
                  </HStack>

                  <Input
                    placeholder="Причина"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />

                  {userStatus && (
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight="bold">Текущий статус:</Text>
                      
                      {userStatus.isWarned && (
                        <HStack justify="space-between" bg="yellow.50" p={2} borderRadius="md">
                          <VStack align="start" spacing={0}>
                            <Text color="yellow.600">
                              Предупреждение
                            </Text>
                            <Text fontSize="sm" color="gray.600">
                              Причина: {userStatus.warnReason || 'Не указана'}
                            </Text>
                          </VStack>
                          <Button
                            size="sm"
                            colorScheme="green"
                            onClick={() => handleAction('unwarn')}
                          >
                            Снять предупреждение
                          </Button>
                        </HStack>
                      )}
                      
                      {userStatus.isMuted && (
                        <HStack justify="space-between" bg="orange.50" p={2} borderRadius="md">
                          <VStack align="start" spacing={0}>
                            <Text color="orange.600">
                              Мут {userStatus.muteDuration ? `(${userStatus.muteDuration})` : ''}
                            </Text>
                            <Text fontSize="sm" color="gray.600">
                              Причина: {userStatus.muteReason || 'Не указана'}
                            </Text>
                          </VStack>
                          <Button
                            size="sm"
                            colorScheme="green"
                            onClick={() => handleAction('unmute')}
                          >
                            Снять мут
                          </Button>
                        </HStack>
                      )}

                      {userStatus.isBanned && (
                        <HStack justify="space-between" bg="red.50" p={2} borderRadius="md">
                          <VStack align="start" spacing={0}>
                            <Text color="red.600">
                              Бан {userStatus.banDuration ? `(${userStatus.banDuration})` : ''}
                            </Text>
                            <Text fontSize="sm" color="gray.600">
                              Причина: {userStatus.banReason || 'Не указана'}
                            </Text>
                          </VStack>
                          <Button
                            size="sm"
                            colorScheme="green"
                            onClick={() => handleAction('unban')}
                          >
                            Снять бан
                          </Button>
                        </HStack>
                      )}

                      {!userStatus.isWarned && !userStatus.isMuted && !userStatus.isBanned && (
                        <Text color="green.500">Нет активных ограничений</Text>
                      )}
                    </VStack>
                  )}

                  <Divider />

                  <HStack spacing={2} justify="flex-end">
                    <Button
                      colorScheme="yellow"
                      onClick={() => handleAction('warn')}
                      isDisabled={userStatus?.isWarned}
                    >
                      Предупреждение
                    </Button>
                    <Button
                      colorScheme="orange"
                      onClick={() => handleAction('mute')}
                      isDisabled={userStatus?.isMuted}
                    >
                      Мут
                    </Button>
                    <Button
                      colorScheme="red"
                      onClick={() => handleAction('ban')}
                      isDisabled={userStatus?.isBanned}
                    >
                      Бан
                    </Button>
                  </HStack>
                </VStack>
              </TabPanel>

              <TabPanel>
                <VStack align="stretch" spacing={3}>
                  {moderationHistory.map((entry, index) => (
                    <Box
                      key={index}
                      p={3}
                      borderRadius="md"
                      bg="gray.50"
                      border="1px"
                      borderColor="gray.200"
                    >
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="bold" color="gray.700">
                          {entry.action === 'warn' && '⚠️ Предупреждение'}
                          {entry.action === 'mute' && '🔇 Мут'}
                          {entry.action === 'ban' && '🚫 Бан'}
                          {entry.action === 'unwarn' && '✅ Снятие предупреждения'}
                          {entry.action === 'unmute' && '🔊 Снятие мута'}
                          {entry.action === 'unban' && '✅ Снятие бана'}
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Время не указано'}
                        </Text>
                      </HStack>
                      {entry.reason && (
                        <Text color="gray.600" mb={2}>
                          Причина: {entry.reason}
                        </Text>
                      )}
                      {entry.duration && (
                        <Text color="gray.600" mb={2}>
                          Длительность: {entry.duration}
                        </Text>
                      )}
                      <Text fontSize="sm" color="gray.500">
                        Модератор: {moderatorNames[entry.moderator] || 'Система'}
                      </Text>
                    </Box>
                  ))}
                  {moderationHistory.length === 0 && (
                    <Text color="gray.500" textAlign="center">
                      История модерации пуста
                    </Text>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ModerationModal;
