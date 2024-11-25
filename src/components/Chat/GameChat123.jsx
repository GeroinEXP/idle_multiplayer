import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Input, 
  Button, 
  Text, 
  Select,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  IconButton,
  Tooltip,
  Badge,
  useToast,
} from '@chakra-ui/react';
import { 
  CheckIcon,
  BellIcon,
  SettingsIcon
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
  getDoc 
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

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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

  // Load messages for current channel
  useEffect(() => {
    if (!currentChannel) return;

    const q = query(
      collection(db, `chatChannels/${currentChannel}/messages`),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messageList = [];
      
      for (const docSnap of snapshot.docs) {
        const messageData = docSnap.data();
        
        // Проверяем, есть ли уже информация о роли пользователя и userId существует
        if (messageData.userId && !userRoles[messageData.userId]) {
          try {
            const userRef = doc(db, 'users', messageData.userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUserRoles(prev => ({
                ...prev,
                [messageData.userId]: {
                  isAdmin: userData.isAdmin || false,
                  isModerator: userData.isModerator || false
                }
              }));
            }
          } catch (error) {
            console.error('Error loading user role:', error);
          }
        }
        
        messageList.push({
          id: docSnap.id,
          ...messageData
        });
      }

      setMessages(messageList.reverse());
    });

    return () => unsubscribe();
  }, [currentChannel]);

  // Загружаем статус текущего пользователя в реальном времени
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const userRef = doc(db, 'users', auth.currentUser.uid);
    
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const currentTime = Date.now();
        
        // Фильтруем активные варны
        const activeWarns = (userData.warns || []).filter(warn => 
          warn.endTime > currentTime
        );
        
        setUserStatus({
          isMuted: userData.isMuted && userData.muteEndTime > currentTime,
          isWarned: activeWarns.length > 0,
          isBanned: userData.isBanned && userData.banEndTime > currentTime,
          muteEndTime: userData.muteEndTime || null,
          banEndTime: userData.banEndTime || null,
          muteReason: userData.muteReason || '',
          banReason: userData.banReason || '',
          warns: activeWarns,
        });
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !auth.currentUser || !currentChannel) return;

    // Проверяем, не замучен ли пользователь
    if (userStatus?.isMuted && userStatus.muteEndTime > Date.now()) {
      toast({
        title: 'Error',
        description: `You are muted until ${new Date(userStatus.muteEndTime).toLocaleString()}. Reason: ${userStatus.muteReason}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Проверяем, не забанен ли пользователь
    if (userStatus?.isBanned && userStatus.banEndTime > Date.now()) {
      toast({
        title: 'Error',
        description: `You are banned until ${new Date(userStatus.banEndTime).toLocaleString()}. Reason: ${userStatus.banReason}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const messageData = {
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
      };

      // Если это не broadcast сообщение, добавляем информацию о пользователе
      if (!isBroadcast) {
        messageData.userId = auth.currentUser.uid;
        messageData.username = playerName;
      } else {
        // Проверяем, является ли пользователь админом
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists() || !userDoc.data().isAdmin) {
          toast({
            title: 'Error',
            description: 'Only administrators can send broadcast messages',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return;
        }

        messageData.isBroadcast = true;
      }

      await addDoc(collection(db, `chatChannels/${currentChannel}/messages`), messageData);
      setNewMessage('');
      
      // Сбрасываем режим broadcast после отправки
      if (isBroadcast) {
        setIsBroadcast(false);
      }
    } catch (error) {
      toast({
        title: 'Error sending message',
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

  return (
    <Box h="100%" maxH="600px" w="100%" borderWidth="1px" borderRadius="lg" overflow="hidden">
      <VStack
        flex={1}
        h="100%"
        spacing={4}
        align="stretch"
        p={4}
        bg="white"
        borderRadius="md"
        boxShadow="sm"
      >
        <HStack>
          <Select
            value={currentChannel}
            onChange={(e) => setCurrentChannel(e.target.value)}
            bg="white"
            borderColor="gray.300"
            _hover={{ borderColor: "gray.400" }}
          >
            <option value="">Общий</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
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

        <VStack
          flex={1}
          overflowY="auto"
          spacing={2}
          align="stretch"
          p={4}
          bg="gray.50"
          borderRadius="md"
        >
          {messages.map((message) => {
            const isAdmin = userRoles[message.userId] && userRoles[message.userId].isAdmin;
            
            // Если это broadcast сообщение
            if (message.isBroadcast) {
              return (
                <Box
                  key={message.id}
                  p={2}
                  bg="blue.50"
                  borderRadius="md"
                  borderLeft="4px"
                  borderLeftColor="blue.400"
                >
                  <Text color="gray.800">
                    <Text as="span" fontWeight="bold" color="blue.600">
                      Объявление:
                    </Text>{" "}
                    {message.text}
                  </Text>
                </Box>
              );
            }

            return (
              <HStack
                key={message.id}
                p={2}
                bg={isAdmin ? "purple.50" : "white"}
                borderRadius="md"
                borderWidth="1px"
                borderColor={isAdmin ? "purple.200" : "gray.200"}
                _hover={{
                  borderColor: isAdmin ? "purple.300" : "gray.300",
                  boxShadow: "sm"
                }}
              >
                <VStack align="start" flex={1} spacing={0}>
                  <HStack>
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      color={isAdmin ? "purple.700" : "gray.700"}
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
                      <Badge colorScheme="purple" variant="subtle">
                        Admin
                      </Badge>
                    )}
                  </HStack>
                  <Text color="gray.800">{message.text}</Text>
                </VStack>
                {(userRoles[auth.currentUser?.uid]?.isAdmin || userRoles[auth.currentUser?.uid]?.isModerator) && message.userId !== auth.currentUser?.uid && (
                  <IconButton
                    icon={<SettingsIcon />}
                    variant="ghost"
                    size="sm"
                    colorScheme="gray"
                    onClick={() => {
                      setSelectedUserId(message.userId);
                      setSelectedUsername(message.username);
                      onModerationOpen();
                    }}
                  />
                )}
              </HStack>
            );
          })}
          <div ref={messagesEndRef} />
        </VStack>

        <HStack spacing={2}>
          <Input
            placeholder={userStatus?.isMuted ? "Вы не можете отправлять сообщения" : "Введите сообщение..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={userStatus?.isMuted}
            bg="white"
            borderColor="gray.300"
            _hover={{ borderColor: "gray.400" }}
            _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
          />
          <Button
            onClick={handleSendMessage}
            isDisabled={userStatus?.isMuted}
            colorScheme="blue"
            variant="solid"
          >
            Отправить
          </Button>
        </HStack>

        {userStatus?.isMuted && (
          <Text color="red.500" fontSize="sm">
            Вы не можете отправлять сообщения до {new Date(userStatus.muteEndTime).toLocaleString()}
            {userStatus.muteReason && ` (Причина: ${userStatus.muteReason})`}
          </Text>
        )}
      </VStack>

      {/* Profile Modal */}
      <Modal isOpen={isProfileOpen} onClose={onProfileClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Player Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <PlayerProfile userId={selectedUserId} />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Moderation Modal */}
      <ModerationModal
        isOpen={isModerationOpen}
        onClose={onModerationClose}
        targetUserId={selectedUserId}
        targetUsername={selectedUsername}
      />
    </Box>
  );
};

export default GameChat;
