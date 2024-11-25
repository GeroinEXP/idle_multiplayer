import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  useToast,
  IconButton,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Badge,
  Icon,
  Select,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Tooltip,
} from '@chakra-ui/react';
import {
  SettingsIcon,
  WarningIcon,
  NotAllowedIcon,
  CheckIcon,
  BellIcon,
} from '@chakra-ui/icons';
import {
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  getDoc, 
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import PlayerProfile from '../Profile/PlayerProfile';
import ModerationModal from '../Moderation/ModerationModal';

const GameChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [userRoles, setUserRoles] = useState({});
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [moderationReason, setModerationReason] = useState('');
  const [remainingTime, setRemainingTime] = useState('');
  const messagesEndRef = useRef(null);
  const toast = useToast();
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();
  const { isOpen: isModerationOpen, onOpen: onModerationOpen, onClose: onModerationClose } = useDisclosure();

  // Load player name
  useEffect(() => {
    const loadPlayerName = async () => {
      if (!auth.currentUser) return;
      
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          setPlayerName(userDoc.data().name || '');
        }
      } catch (error) {
        console.error('Error loading player name:', error);
      }
    };

    loadPlayerName();
  }, [auth.currentUser]);

  // Load player profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!auth.currentUser) return;
      const profileRef = doc(db, 'players', auth.currentUser.uid);
      const profileDoc = await getDoc(profileRef);
      if (profileDoc.exists()) {
        setPlayerProfile(profileDoc.data());
      }
    };
    loadProfile();
  }, [auth.currentUser]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
      });
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Load channels
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'chatChannels'), (snapshot) => {
      const channelList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChannels(channelList);
      
      // If we don't have a current channel and there are channels available,
      // set the first one as current
      if (!currentChannel && channelList.length > 0) {
        setCurrentChannel(channelList[0].id);
      }
    });

    return () => unsubscribe();
  }, [currentChannel]);

  // Load messages
  useEffect(() => {
    if (!currentChannel) return;

    const q = query(
      collection(db, 'chatMessages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = [];
      snapshot.forEach((doc) => {
        const messageData = doc.data();
        // Проверяем, соответствует ли сообщение текущему каналу или это broadcast
        if (messageData.channel === currentChannel || messageData.isBroadcast) {
          messageList.push({ id: doc.id, ...messageData });
        }
      });
      setMessages(messageList.reverse());
    });

    return () => unsubscribe();
  }, [currentChannel]);

  // Load user roles
  useEffect(() => {
    const loadUserRoles = async () => {
      const usersToLoad = new Set();
      
      // Collect all unique user IDs from messages
      messages.forEach(message => {
        if (message.userId) {
          usersToLoad.add(message.userId);
        }
      });

      // Add current user if available
      if (auth.currentUser?.uid) {
        usersToLoad.add(auth.currentUser.uid);
      }

      // Load roles for all users
      const roles = {};
      for (const userId of usersToLoad) {
        try {
          const userRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            roles[userId] = {
              isAdmin: userDoc.data().isAdmin || false,
              isModerator: userDoc.data().isModerator || false
            };
          }
        } catch (error) {
          console.error('Error loading user roles:', error);
        }
      }

      setUserRoles(roles);
    };

    loadUserRoles();
  }, [messages]);

  // Load user status
  useEffect(() => {
    if (!auth.currentUser) return;

    const loadUserStatus = async () => {
      const userStatusRef = doc(db, 'userStatus', auth.currentUser.uid);
      const statusDoc = await getDoc(userStatusRef);
      if (statusDoc.exists()) {
        setUserStatus(statusDoc.data());
      }
    };

    // Слушаем изменения статуса в реальном времени
    const unsubscribe = onSnapshot(doc(db, 'userStatus', auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        setUserStatus(doc.data());
      } else {
        setUserStatus(null);
      }
    });

    loadUserStatus();
    return () => unsubscribe();
  }, [auth.currentUser]);

  // Слушатель изменений статуса пользователя
  useEffect(() => {
    if (!auth.currentUser) return;

    const userStatusRef = doc(db, 'userStatus', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userStatusRef, (doc) => {
      if (doc.exists()) {
        const status = doc.data();
        setUserStatus(status);
        
        // Показываем уведомления при изменении статуса
        if (status.isWarned) {
          toast({
            title: "⚠️ Предупреждение",
            description: `Вы получили предупреждение от модератора: ${status.warnReason || 'Нарушение правил'}`,
            status: "warning",
            duration: 10000,
            isClosable: true,
            position: "top",
          });
        }
        
        if (status.isMuted) {
          toast({
            title: "🔇 Мут",
            description: `Вы получили мут на ${status.muteDuration || 'некоторое время'}. Причина: ${status.muteReason || 'Нарушение правил'}`,
            status: "error",
            duration: 10000,
            isClosable: true,
            position: "top",
          });
        }
        
        if (status.isBanned) {
          toast({
            title: "🚫 Бан",
            description: `Вы получили бан${status.banDuration ? ` на ${status.banDuration}` : ' навсегда'}. Причина: ${status.banReason || 'Нарушение правил'}`,
            status: "error",
            duration: null,
            isClosable: true,
            position: "top",
          });
        }
      } else {
        setUserStatus(null);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser, toast]);

  // Преобразуем строку длительности в минуты
  const getDurationInMinutes = (durationStr) => {
    if (!durationStr) return 0;
    const match = durationStr.match(/(\d+)\s*(hour|hours|minute|minutes|day|days)/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch(unit) {
      case 'hour':
      case 'hours':
        return value * 60;
      case 'day':
      case 'days':
        return value * 24 * 60;
      case 'minute':
      case 'minutes':
        return value;
      default:
        return 0;
    }
  };

  // Добавляем эффект для обновления оставшегося времени
  useEffect(() => {
    let intervalId;

    if (userStatus?.isMuted || userStatus?.isBanned) {
      console.log('Current user status:', userStatus);

      const updateRemainingTime = () => {
        const now = Date.now();
        let endTime;
        let reason;
        let type;

        if (userStatus.isMuted) {
          const mutedAtMillis = userStatus.mutedAt?.seconds ? 
            userStatus.mutedAt.seconds * 1000 : 
            userStatus.mutedAt?.toMillis?.() || 0;
          
          const durationMinutes = getDurationInMinutes(userStatus.muteDuration);
          endTime = mutedAtMillis + (durationMinutes * 60 * 1000);
          reason = userStatus.muteReason;
          type = 'мута';
          console.log('Mute details:', { 
            mutedAtMillis, 
            duration: userStatus.muteDuration, 
            durationMinutes,
            endTime,
            now 
          });
        } else if (userStatus.isBanned) {
          const bannedAtMillis = userStatus.bannedAt?.seconds ? 
            userStatus.bannedAt.seconds * 1000 : 
            userStatus.bannedAt?.toMillis?.() || 0;
          
          const durationMinutes = getDurationInMinutes(userStatus.banDuration);
          endTime = bannedAtMillis + (durationMinutes * 60 * 1000);
          reason = userStatus.banReason;
          type = 'бана';
          console.log('Ban details:', { 
            bannedAtMillis, 
            duration: userStatus.banDuration,
            durationMinutes,
            endTime,
            now 
          });
        }

        if (endTime) {
          const remaining = endTime - now;
          console.log('Remaining time:', { remaining, now, endTime });
          
          if (remaining <= 0) {
            setRemainingTime('');
            clearInterval(intervalId);
          } else {
            const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            let timeString = "";
            if (days > 0) timeString += `${days}д `;
            if (hours > 0) timeString += `${hours}ч `;
            if (minutes > 0) timeString += `${minutes}м `;
            timeString += `${seconds}с`;

            const message = `Вы не можете отправлять сообщения из-за ${type}. Осталось: ${timeString}${reason ? `. Причина: ${reason}` : ''}`;
            console.log('Setting remaining time:', message);
            setRemainingTime(message);
          }
        }
      };

      updateRemainingTime();
      intervalId = setInterval(updateRemainingTime, 1000);

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    } else {
      setRemainingTime('');
    }
  }, [userStatus]);

  // Функция для форматирования оставшегося времени
  const formatRemainingTime = (endTime) => {
    const now = Date.now();
    const remaining = endTime - now;
    
    if (remaining <= 0) return "0 минут";
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeString = "";
    if (days > 0) timeString += `${days} дн. `;
    if (hours > 0) timeString += `${hours} ч. `;
    if (minutes > 0) timeString += `${minutes} мин.`;
    
    return timeString.trim();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !auth.currentUser) return;
    
    // Проверяем статус перед отправкой
    const userStatusRef = doc(db, 'userStatus', auth.currentUser.uid);
    const statusDoc = await getDoc(userStatusRef);
    const currentStatus = statusDoc.exists() ? statusDoc.data() : null;
    
    const now = Date.now();
    
    if (currentStatus?.isMuted) {
      const muteEndTime = currentStatus.mutedAt?.toMillis() + (currentStatus.muteDuration * 60 * 1000);
      const remainingTime = formatRemainingTime(muteEndTime);
      toast({
        title: "Ошибка отправки",
        description: `Вы не можете отправлять сообщения ещё ${remainingTime}. Причина: ${currentStatus.muteReason || 'не указана'}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    if (currentStatus?.isBanned) {
      const banEndTime = currentStatus.bannedAt?.toMillis() + (currentStatus.banDuration * 60 * 1000);
      const remainingTime = formatRemainingTime(banEndTime);
      toast({
        title: "Ошибка отправки",
        description: `Вы забанены ещё на ${remainingTime}. Причина: ${currentStatus.banReason || 'не указана'}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const messageData = {
        text: newMessage.trim(),
        userId: auth.currentUser.uid,
        username: playerProfile?.name || auth.currentUser.email?.split('@')[0] || 'Anonymous',
        timestamp: serverTimestamp(),
        channel: currentChannel || '',
        isBroadcast: isBroadcast && userRoles[auth.currentUser.uid]?.isAdmin
      };

      await addDoc(collection(db, 'chatMessages'), messageData);
      setNewMessage('');
      scrollToBottom();
      
      // Если это broadcast сообщение, показываем уведомление
      if (messageData.isBroadcast) {
        toast({
          title: 'Объявление отправлено',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка отправки сообщения',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleUsernameClick = (userId) => {
    setSelectedUserId(userId);
    onProfileOpen();
  };

  const handleModerationAction = async (action, duration = null) => {
    if (!selectedUserId) return;

    try {
      const userStatusRef = doc(db, 'userStatus', selectedUserId);
      const statusDoc = await getDoc(userStatusRef);
      const currentStatus = statusDoc.exists() ? statusDoc.data() : {};
      
      let updateData = {};
      let notificationMessage = "";

      switch (action) {
        case 'warn':
          updateData = {
            isWarned: true,
            warnedAt: serverTimestamp(),
            warnReason: moderationReason,
            warnedBy: auth.currentUser.uid
          };
          notificationMessage = "⚠️ Выдано предупреждение";
          break;
        case 'mute':
          updateData = {
            isMuted: true,
            mutedAt: serverTimestamp(),
            muteDuration: duration,
            muteReason: moderationReason,
            mutedBy: auth.currentUser.uid
          };
          notificationMessage = "🔇 Игрок получил мут";
          break;
        case 'ban':
          updateData = {
            isBanned: true,
            bannedAt: serverTimestamp(),
            banDuration: duration,
            banReason: moderationReason,
            bannedBy: auth.currentUser.uid
          };
          notificationMessage = "🚫 Игрок забанен";
          break;
        case 'unmute':
          updateData = {
            isMuted: false,
            mutedAt: null,
            muteDuration: null,
            muteReason: null,
            mutedBy: null
          };
          notificationMessage = "🔊 Мут снят";
          break;
        case 'unwarn':
          updateData = {
            isWarned: false,
            warnedAt: null,
            warnReason: null,
            warnedBy: null
          };
          notificationMessage = "✅ Предупреждение снято";
          break;
        case 'unban':
          updateData = {
            isBanned: false,
            bannedAt: null,
            banDuration: null,
            banReason: null,
            bannedBy: null
          };
          notificationMessage = "✅ Бан снят";
          break;
        default:
          return;
      }

      await setDoc(userStatusRef, { ...currentStatus, ...updateData }, { merge: true });

      // Отправляем системное сообщение в чат
      const systemMessage = {
        text: `${notificationMessage}: ${selectedUsername}${duration ? ` на ${duration}` : ''}${moderationReason ? `. Причина: ${moderationReason}` : ''}`,
        timestamp: serverTimestamp(),
        isSystem: true,
        channel: currentChannel,
      };
      
      await addDoc(collection(db, 'chatMessages'), systemMessage);

      toast({
        title: "Действие выполнено",
        description: `${notificationMessage}: ${selectedUsername}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onModerationClose();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box 
      h="100%" 
      maxH="600px" 
      w="100%" 
      borderWidth="1px" 
      borderRadius="lg" 
      bg="white"
      display="flex"
      flexDirection="column"
    >
      {/* Переключатель каналов - фиксированная высота */}
      <Box 
        p={4} 
        borderBottomWidth="1px" 
        borderColor="gray.200"
        bg="white"
        position="sticky"
        top={0}
        zIndex={1}
      >
        <HStack>
          <Select
            value={currentChannel}
            onChange={(e) => {
              setMessages([]);
              setCurrentChannel(e.target.value);
            }}
            bg="white"
            borderColor="gray.300"
            _hover={{ borderColor: "gray.400" }}
          >
            <option value="">Общий</option>
            {Array.isArray(channels) && channels.map((channel) => (
              <option key={channel.id || 'default'} value={channel.id || ''}>
                {channel.name || channel.id || 'Канал'}
              </option>
            ))}
          </Select>
          {userRoles[auth.currentUser?.uid]?.isAdmin && (
            <IconButton
              icon={isBroadcast ? <CheckIcon /> : <BellIcon />}
              onClick={() => setIsBroadcast(!isBroadcast)}
              colorScheme={isBroadcast ? "green" : "gray"}
              variant="outline"
            />
          )}
        </HStack>
      </Box>

      {/* Область сообщений - прокручиваемая */}
      <Box 
        flex={1}
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#c1c1c1',
            borderRadius: '24px',
            '&:hover': {
              background: '#a1a1a1',
            },
          },
        }}
      >
        <VStack spacing={2} p={4} align="stretch">
          {messages.map((message) => {
            const isAdmin = userRoles[message.userId] && userRoles[message.userId].isAdmin;
            
            if (message.isBroadcast) {
              return (
                <Box
                  key={message.id}
                  p={3}
                  bg="orange.50"
                  borderRadius="md"
                  borderWidth="2px"
                  borderColor="orange.400"
                  boxShadow="md"
                >
                  <Text fontWeight="bold" color="orange.800">
                    📢 Объявление
                  </Text>
                  <Text mt={1}>{message.text}</Text>
                </Box>
              );
            }

            if (message.isSystem) {
              return (
                <Box
                  key={message.id}
                  p={2}
                  bg="gray.100"
                  borderRadius="md"
                >
                  <Text color="gray.600" fontSize="sm">
                    {message.text}
                  </Text>
                </Box>
              );
            }

            return (
              <HStack
                key={message.id}
                p={2}
                bg="white"
                borderRadius="md"
                boxShadow="sm"
                _hover={{ bg: "gray.50" }}
              >
                <Box flex="1">
                  <HStack spacing={2} mb={1}>
                    <Text
                      fontWeight="bold"
                      color={isAdmin ? "red.500" : "blue.500"}
                      cursor="pointer"
                      onClick={() => {
                        setSelectedUserId(message.userId);
                        setSelectedUsername(message.username);
                        onProfileOpen();
                      }}
                      _hover={{ textDecoration: "underline" }}
                    >
                      {message.username}
                    </Text>
                    {isAdmin && (
                      <Badge colorScheme="red" variant="subtle">
                        Admin
                      </Badge>
                    )}
                    {userRoles[message.userId]?.isModerator && (
                      <Badge colorScheme="purple" variant="subtle">
                        Mod
                      </Badge>
                    )}
                  </HStack>
                  <Text>{message.text}</Text>
                </Box>
                {(userRoles[auth.currentUser?.uid]?.isAdmin || userRoles[auth.currentUser?.uid]?.isModerator) && (
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<SettingsIcon />}
                      variant="ghost"
                      size="sm"
                    />
                    <MenuList>
                      <MenuItem
                        icon={<WarningIcon />}
                        onClick={() => {
                          setSelectedUserId(message.userId);
                          setSelectedUsername(message.username);
                          onModerationOpen();
                        }}
                      >
                        Модерация
                      </MenuItem>
                    </MenuList>
                  </Menu>
                )}
              </HStack>
            );
          })}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Поле ввода сообщения - фиксированная высота */}
      <Box 
        p={4} 
        borderTopWidth="1px" 
        borderColor="gray.200"
        bg="white"
        position="sticky"
        bottom={0}
        zIndex={1}
      >
        {(userStatus?.isMuted || userStatus?.isBanned) ? (
          <Box p={2} bg="gray.100" borderRadius="md">
            <Text color="orange.500">{remainingTime || "Вы не можете отправлять сообщения"}</Text>
          </Box>
        ) : (
          <HStack>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={!!remainingTime}
              placeholder="Введите сообщение..."
              bg="white"
              borderColor="gray.300"
              _hover={{ borderColor: "gray.400" }}
            />
            <Button 
              onClick={handleSendMessage} 
              colorScheme="blue"
              isDisabled={!newMessage.trim()}
            >
              Отправить
            </Button>
          </HStack>
        )}
      </Box>

      {/* Profile Modal */}
      <Modal isOpen={isProfileOpen} onClose={onProfileClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Профиль игрока</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <PlayerProfile userId={selectedUserId} username={selectedUsername} />
          </ModalBody>
        </ModalContent>
      </Modal>

      <ModerationModal
        isOpen={isModerationOpen}
        onClose={onModerationClose}
        targetUserId={selectedUserId}
        targetUsername={selectedUsername}
        onModerationAction={handleModerationAction}
        setModerationReason={setModerationReason}
      />
    </Box>
  );
};

export default GameChat;
