import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Input,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  IconButton,
  Textarea,
  Switch,
  FormHelperText,
  Select,
  Grid,
  Card,
  CardBody,
  Image,
  Text,
  Heading,
  Badge,
} from '@chakra-ui/react';
import { DeleteIcon, AddIcon, EditIcon } from '@chakra-ui/icons';
import { auth } from '../../config/firebase';
import { 
  getFirestore, 
  doc, 
  updateDoc, 
  Timestamp,
  collection,
  onSnapshot,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Select as ChakraSelect } from 'chakra-react-select';

const db = getFirestore();

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [gameSettings, setGameSettings] = useState({
    expMultiplier: 1,
    goldMultiplier: 1,
    maxLevel: 99
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [banDuration, setBanDuration] = useState('permanent');
  const [customDuration, setCustomDuration] = useState('');
  const [banReason, setBanReason] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState({
    id: '',
    name: '',
    description: '',
    baseExp: 10,
    icon: '',
    timerSeconds: 60,
    commonDrops: [],
    rareDrops: [],
  });
  const [editingSkill, setEditingSkill] = useState(null);
  const [newItemId, setNewItemId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    id: '',
    name: '',
    description: '',
    type: 'resource', // resource, equipment, consumable
    icon: '',
    stats: {
      attack: 0,
      defense: 0,
      health: 0
    },
    slot: 'head'
  });
  const [editingItem, setEditingItem] = useState(null);
  const [editItemModalOpen, setEditItemModalOpen] = useState(false);
  const [newStatName, setNewStatName] = useState('');
  const [newStatValue, setNewStatValue] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isSkillModalOpen,
    onOpen: onSkillModalOpen,
    onClose: onSkillModalClose
  } = useDisclosure();
  const {
    isOpen: isEditSkillModalOpen,
    onOpen: onEditSkillModalOpen,
    onClose: onEditSkillModalClose
  } = useDisclosure();
  const {
    isOpen: isItemModalOpen,
    onOpen: onItemModalOpen,
    onClose: onItemModalClose
  } = useDisclosure();
  const toast = useToast();
  const [channels, setChannels] = useState([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');

  // Загрузка пользователей
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    });

    return () => unsubscribe();
  }, []);

  // Функция для открытия модального окна блокировки
  const openBanModal = (user) => {
    setSelectedUser(user);
    setBanDuration('permanent');
    setCustomDuration('');
    setBanReason('');
    setIsBanModalOpen(true);
  };

  // Функция для блокировки пользователя
  const handleBanUser = async () => {
    try {
      if (!selectedUser) return;

      let banEndTime = null;
      if (banDuration !== 'permanent') {
        const duration = banDuration === 'custom' 
          ? parseInt(customDuration) 
          : parseInt(banDuration);
        
        if (isNaN(duration)) {
          toast({
            title: 'Invalid duration',
            status: 'error',
            duration: 3000,
          });
          return;
        }

        banEndTime = Timestamp.fromDate(
          new Date(Date.now() + duration * 60 * 60 * 1000)
        );
      }

      const banData = {
        isBanned: true,
        banReason,
        banStartTime: Timestamp.now(),
        banEndTime,
        bannedBy: auth.currentUser.uid,
      };

      // Обновляем документ пользователя
      await updateDoc(doc(db, 'users', selectedUser.id), {
        ban: banData
      });

      // Обновляем локальное состояние пользователей
      setUsers(users.map(user => 
        user.id === selectedUser.id 
          ? { ...user, ban: banData }
          : user
      ));

      toast({
        title: 'User banned successfully',
        status: 'success',
        duration: 3000,
      });

      setIsBanModalOpen(false);
    } catch (error) {
      console.error('Error banning user:', error);
      toast({
        title: 'Error banning user',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Функция для разблокировки пользователя
  const handleUnbanUser = async (userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ban: null
      });

      // Обновляем локальное состояние пользователей
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, ban: null }
          : user
      ));

      toast({
        title: 'User unbanned successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast({
        title: 'Error unbanning user',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Функция для форматирования времени бана
  const formatBanTime = (ban) => {
    if (!ban) return '';
    if (!ban.banEndTime) return 'Permanent';
    
    const endTime = ban.banEndTime.toDate();
    const now = new Date();
    
    if (endTime <= now) return 'Expired';
    
    const hours = Math.ceil((endTime - now) / (1000 * 60 * 60));
    return `${hours} hours remaining`;
  };

  // Загрузка скиллов
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const skillsDoc = await getDoc(doc(db, 'gameData', 'skills'));
        if (skillsDoc.exists()) {
          setSkills(Object.values(skillsDoc.data()));
        }
      } catch (error) {
        toast({
          title: 'Error loading skills',
          description: error.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };

    loadSkills();
  }, []);

  // Загрузка предметов
  const loadItems = async () => {
    try {
      const gameDataRef = doc(db, 'gameData', 'items');
      const gameDataDoc = await getDoc(gameDataRef);
      
      if (gameDataDoc.exists()) {
        const itemsData = gameDataDoc.data();
        const loadedItems = Object.entries(itemsData).map(([id, data]) => ({
          id,
          ...data
        }));
        setItems(loadedItems);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load items',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Загружаем предметы при монтировании компонента
  useEffect(() => {
    loadItems();
  }, []);

  // Загрузка настроек при монтировании компонента
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'gameData', 'settings'));
        if (settingsDoc.exists()) {
          setGameSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Загрузка истории блокировок чата
  const loadChatHistory = async (userId) => {
    try {
      const userStatusRef = doc(db, 'userStatus', userId);
      const userStatusDoc = await getDoc(userStatusRef);
      
      if (userStatusDoc.exists()) {
        const statusData = userStatusDoc.data();
        const history = statusData.moderationHistory || [];
        setChatHistory(history.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setChatHistory([]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      toast({
        title: 'Error loading chat history',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Обработка блокировки чата
  const handleChatBlock = async (action) => {
    try {
      const userStatusRef = doc(db, 'userStatus', selectedUser.id);
      const timestamp = Timestamp.now();
      
      // Получаем никнейм модератора
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const moderatorNickname = userDoc.data()?.nickname || auth.currentUser.email;
      
      let updateData = {
        isBanned: action === 'ban',
        isMuted: action === 'mute',
        lastModifiedBy: auth.currentUser.uid,
        lastModifiedAt: timestamp,
      };

      if (action === 'ban') {
        updateData.banReason = selectedUser.chatBlockReason;
        updateData.banStart = timestamp;
      } else if (action === 'mute') {
        updateData.muteReason = selectedUser.chatBlockReason;
        updateData.muteStart = timestamp;
        // Мут на 30 минут по умолчанию
        const muteEnd = new Date();
        muteEnd.setMinutes(muteEnd.getMinutes() + 30);
        updateData.muteEnd = Timestamp.fromDate(muteEnd);
      }

      // Получаем текущую историю модерации
      const userStatusDoc = await getDoc(userStatusRef);
      const currentHistory = userStatusDoc.exists() ? (userStatusDoc.data().moderationHistory || []) : [];

      // Добавляем новую запись в историю
      const historyEntry = {
        action: action,
        reason: selectedUser.chatBlockReason,
        moderator: moderatorNickname,
        moderatorId: auth.currentUser.uid,
        timestamp: timestamp,
      };

      updateData.moderationHistory = [...currentHistory, historyEntry];

      await setDoc(userStatusRef, updateData, { merge: true });

      toast({
        title: 'Success',
        description: `User ${action === 'ban' ? 'banned' : 'muted'} successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Обновляем локальное состояние
      setSelectedUser({
        ...selectedUser,
        chatBlocked: action === 'ban',
        chatMuted: action === 'mute',
      });

      // Перезагружаем историю
      loadChatHistory(selectedUser.id);
    } catch (error) {
      console.error('Error updating chat status:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Обработка разблокировки чата
  const handleChatUnblock = async (action) => {
    try {
      const userStatusRef = doc(db, 'userStatus', selectedUser.id);
      const timestamp = Timestamp.now();
      
      // Получаем никнейм модератора
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const moderatorNickname = userDoc.data()?.nickname || auth.currentUser.email;
      
      let updateData = {
        isBanned: action === 'unban' ? false : selectedUser.chatBlocked,
        isMuted: action === 'unmute' ? false : selectedUser.chatMuted,
        lastModifiedBy: auth.currentUser.uid,
        lastModifiedAt: timestamp,
      };

      // Получаем текущую историю модерации
      const userStatusDoc = await getDoc(userStatusRef);
      const currentHistory = userStatusDoc.exists() ? (userStatusDoc.data().moderationHistory || []) : [];

      // Добавляем новую запись в историю
      const historyEntry = {
        action: action,
        moderator: moderatorNickname,
        moderatorId: auth.currentUser.uid,
        timestamp: timestamp,
      };

      updateData.moderationHistory = [...currentHistory, historyEntry];

      await setDoc(userStatusRef, updateData, { merge: true });

      toast({
        title: 'Success',
        description: `User ${action === 'unban' ? 'unbanned' : 'unmuted'} successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Обновляем локальное состояние
      setSelectedUser({
        ...selectedUser,
        chatBlocked: action === 'unban' ? false : selectedUser.chatBlocked,
        chatMuted: action === 'unmute' ? false : selectedUser.chatMuted,
      });

      // Перезагружаем историю
      loadChatHistory(selectedUser.id);
    } catch (error) {
      console.error('Error updating chat status:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Редактирование пользователя
  const handleEditUser = (user) => {
    setSelectedUser(user);
    onOpen();
  };

  // Сохранение изменений пользователя
  const handleSaveUser = async () => {
    try {
      if (!selectedUser) return;

      const userRef = doc(db, 'users', selectedUser.id);
      const userUpdate = {
        email: selectedUser.email,
        username: selectedUser.username,
        role: selectedUser.role,
        chatBlocked: selectedUser.chatBlocked,
        chatMuted: selectedUser.chatMuted,
        chatBlockReason: selectedUser.chatBlockReason,
      };

      await updateDoc(userRef, userUpdate);
      
      // Обновляем локальное состояние пользователей
      setUsers(users.map(user => 
        user.id === selectedUser.id 
          ? { ...user, ...userUpdate }
          : user
      ));
      
      toast({
        title: 'User updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onClose();
    } catch (error) {
      toast({
        title: 'Error updating user',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Удаление пользователя
  const handleDeleteUser = async (userId) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(user => user.id !== userId));
      
      toast({
        title: 'User deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error deleting user',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Сохранение настроек
  const handleSaveSettings = async () => {
    try {
      const settingsRef = doc(db, 'gameData', 'settings');
      const settingsDoc = await getDoc(settingsRef);

      if (!settingsDoc.exists()) {
        // Если документ не существует, создаем его
        await setDoc(settingsRef, gameSettings);
      } else {
        // Если документ существует, обновляем его
        await updateDoc(settingsRef, gameSettings);
      }

      toast({
        title: 'Settings saved',
        description: 'Game settings have been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error saving settings',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Добавление нового скилла
  const handleAddSkill = async () => {
    try {
      const skillsRef = doc(db, 'gameData', 'skills');
      const skillsDoc = await getDoc(skillsRef);
      const currentSkills = skillsDoc.exists() ? skillsDoc.data() : {};

      // Добавляем новый скилл
      const updatedSkills = {
        ...currentSkills,
        [newSkill.id]: newSkill
      };

      await setDoc(skillsRef, updatedSkills);

      // Обновляем список скиллов
      setSkills([...skills, newSkill]);

      // Очищаем форму
      setNewSkill({
        id: '',
        name: '',
        description: '',
        baseExp: 10,
        icon: '',
        timerSeconds: 60,
        commonDrops: [],
        rareDrops: [],
      });

      // Обновляем всех пользователей, добавляя им новый скилл
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const batch = [];
      usersSnapshot.docs.forEach(userDoc => {
        const userData = userDoc.data();
        if (!userData.skills) userData.skills = {};
        userData.skills[newSkill.id] = {
          level: 1,
          experience: 0,
          nextLevelExp: 100,
        };
        batch.push(updateDoc(doc(db, 'users', userDoc.id), { skills: userData.skills }));
      });
      await Promise.all(batch);

      toast({
        title: 'Skill added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onSkillModalClose();
    } catch (error) {
      toast({
        title: 'Error adding skill',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Редактирование скилла
  const handleEditSkill = async () => {
    try {
      const skillsRef = doc(db, 'gameData', 'skills');
      const skillsDoc = await getDoc(skillsRef);
      const currentSkills = skillsDoc.exists() ? skillsDoc.data() : {};

      // Обновляем скилл
      const updatedSkills = {
        ...currentSkills,
        [editingSkill.id]: editingSkill
      };

      await setDoc(skillsRef, updatedSkills);

      // Обновляем список скиллов
      setSkills(Object.values(updatedSkills));

      toast({
        title: 'Skill updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onEditSkillModalClose();
    } catch (error) {
      toast({
        title: 'Error updating skill',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Удаление скилла
  const handleDeleteSkill = async (skillId) => {
    if (!window.confirm('Are you sure you want to delete this skill? This action cannot be undone.')) {
      return;
    }

    try {
      const skillsRef = doc(db, 'gameData', 'skills');
      const skillsDoc = await getDoc(skillsRef);
      const currentSkills = skillsDoc.data();

      // Удаляем скилл
      delete currentSkills[skillId];
      await setDoc(skillsRef, currentSkills);

      // Обновляем список скиллов
      setSkills(skills.filter(skill => skill.id !== skillId));

      // Удаляем скилл у всех пользователей
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const batch = [];
      usersSnapshot.docs.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.skills && userData.skills[skillId]) {
          delete userData.skills[skillId];
          batch.push(updateDoc(doc(db, 'users', userDoc.id), { skills: userData.skills }));
        }
      });
      await Promise.all(batch);

      toast({
        title: 'Skill deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error deleting skill',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Добавление нового предмета
  const handleAddItem = async () => {
    try {
      // Проверяем обязательные поля
      if (!newItem.id || !newItem.name || !newItem.type) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Проверяем наличие слота для equipment
      if (newItem.type === 'equipment' && !newItem.slot) {
        toast({
          title: 'Error',
          description: 'Please select an equipment slot',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const gameDataRef = doc(db, 'gameData', 'items');
      const gameDataDoc = await getDoc(gameDataRef);
      const currentItems = gameDataDoc.exists() ? gameDataDoc.data() : {};

      // Создаем предмет
      const itemData = {
        ...newItem,
        // Удаляем слот, если тип не equipment
        ...(newItem.type !== 'equipment' && { slot: null }),
        // Удаляем статистики, если тип не equipment
        ...(newItem.type !== 'equipment' && { stats: {} })
      };

      // Добавляем новый предмет к существующим
      currentItems[newItem.id] = itemData;
      await setDoc(gameDataRef, currentItems);

      toast({
        title: 'Success',
        description: 'Item created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Сбрасываем форму
      setNewItem({
        id: '',
        name: '',
        description: '',
        type: 'resource',
        icon: '',
        stats: {},
        slot: 'head'
      });
      setNewStatName('');
      setNewStatValue('');
      
      // Перезагружаем список предметов
      loadItems();
    } catch (error) {
      console.error('Error creating item:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Редактирование предмета
  const handleEditItem = (item) => {
    setEditingItem({
      ...item,
      stats: item.stats || {}
    });
    setEditItemModalOpen(true);
  };

  // Сохранение изменений предмета
  const handleSaveItem = async () => {
    try {
      if (!editingItem.id || !editingItem.name || !editingItem.type) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (editingItem.type === 'equipment' && !editingItem.slot) {
        toast({
          title: 'Error',
          description: 'Please select an equipment slot',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const gameDataRef = doc(db, 'gameData', 'items');
      const gameDataDoc = await getDoc(gameDataRef);
      const currentItems = gameDataDoc.exists() ? gameDataDoc.data() : {};

      const itemData = {
        ...editingItem,
        ...(editingItem.type !== 'equipment' && { slot: null, stats: {} })
      };

      // Обновляем предмет
      currentItems[editingItem.id] = itemData;
      await setDoc(gameDataRef, currentItems);

      toast({
        title: 'Success',
        description: 'Item updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setEditItemModalOpen(false);
      setEditingItem(null);
      loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Удаление предмета
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      const gameDataRef = doc(db, 'gameData', 'items');
      const gameDataDoc = await getDoc(gameDataRef);
      const currentItems = gameDataDoc.exists() ? gameDataDoc.data() : {};

      // Удаляем предмет
      delete currentItems[itemId];
      await setDoc(gameDataRef, currentItems);
      
      toast({
        title: 'Success',
        description: 'Item deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Обновляем пользователя при выборе
  const handleUserSelect = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Инициализируем инвентарь, если его нет
        if (!userData.inventory) {
          userData.inventory = {};
          await updateDoc(doc(db, 'users', userId), { inventory: {} });
        }
        setSelectedUser({ id: userId, ...userData });
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleInventoryChange = async (itemId, quantity) => {
    try {
      if (!selectedUser?.inventory) {
        selectedUser.inventory = {};
      }

      const updatedInventory = {
        ...selectedUser.inventory,
        [itemId]: quantity
      };

      // Удаляем предмет из инвентаря, если количество 0
      if (quantity === 0) {
        delete updatedInventory[itemId];
      }

      await updateDoc(doc(db, 'users', selectedUser.id), {
        inventory: updatedInventory
      });

      setSelectedUser({
        ...selectedUser,
        inventory: updatedInventory
      });

      toast({
        title: 'Inventory updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast({
        title: 'Error updating inventory',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      if (!selectedUser?.inventory) {
        return;
      }

      const updatedInventory = { ...selectedUser.inventory };
      delete updatedInventory[itemId];

      await updateDoc(doc(db, 'users', selectedUser.id), {
        inventory: updatedInventory
      });

      setSelectedUser({
        ...selectedUser,
        inventory: updatedInventory
      });

      toast({
        title: 'Item removed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        title: 'Error removing item',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAddItemToInventory = async () => {
    try {
      if (!selectedUser || !newItemId) {
        return;
      }

      if (!selectedUser.inventory) {
        selectedUser.inventory = {};
      }

      const updatedInventory = {
        ...selectedUser.inventory,
        [newItemId]: newItemQuantity
      };

      await updateDoc(doc(db, 'users', selectedUser.id), {
        inventory: updatedInventory
      });

      setSelectedUser({
        ...selectedUser,
        inventory: updatedInventory
      });

      setNewItemId('');
      setNewItemQuantity(1);

      toast({
        title: 'Item added to inventory',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding item to inventory:', error);
      toast({
        title: 'Error adding item',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Обновляем useEffect для загрузки данных пользователя
  useEffect(() => {
    if (selectedUser) {
      loadChatHistory(selectedUser.id);
    }
  }, [selectedUser?.id]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'chatChannels'), (snapshot) => {
      const channelsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChannels(channelsData);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      await addDoc(collection(db, 'chatChannels'), {
        name: newChannelName.trim(),
        description: channelDescription.trim(),
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });

      setNewChannelName('');
      setChannelDescription('');
      toast({
        title: 'Channel created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error creating channel',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!window.confirm('Are you sure you want to delete this channel?')) return;

    try {
      await deleteDoc(doc(db, 'chatChannels', channelId));
      toast({
        title: 'Channel deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error deleting channel',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p={4}>
      <Tabs>
        <TabList>
          <Tab>Users</Tab>
          <Tab>Game Settings</Tab>
          <Tab>Skills</Tab>
          <Tab>Items</Tab>
          <Tab>Channels</Tab>
        </TabList>

        <TabPanels>
          {/* Users Tab */}
          <TabPanel>
            <VStack spacing={5} align="stretch">
              <HStack justify="space-between">
                <Heading size="md">Users Management</Heading>
              </HStack>

              <TableContainer>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Email</Th>
                      <Th>Username</Th>
                      <Th>Status</Th>
                      <Th>Ban Info</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {users.map(user => (
                      <Tr key={user.id}>
                        <Td>{user.email}</Td>
                        <Td>{user.username}</Td>
                        <Td>
                          {user.ban ? (
                            <Badge colorScheme="red">Banned</Badge>
                          ) : (
                            <Badge colorScheme="green">Active</Badge>
                          )}
                        </Td>
                        <Td>
                          {user.ban && (
                            <VStack align="start" spacing={1}>
                              <Text fontSize="sm">{formatBanTime(user.ban)}</Text>
                              <Text fontSize="sm" color="gray.500">
                                Reason: {user.ban.banReason}
                              </Text>
                            </VStack>
                          )}
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button
                              leftIcon={<EditIcon />}
                              size="sm"
                              colorScheme="blue"
                              onClick={() => handleEditUser(user)}
                            >
                              Edit
                            </Button>
                            {user.ban ? (
                              <Button
                                size="sm"
                                colorScheme="green"
                                onClick={() => handleUnbanUser(user.id)}
                              >
                                Unban
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                colorScheme="red"
                                onClick={() => openBanModal(user)}
                              >
                                Ban
                              </Button>
                            )}
                            <Button
                              leftIcon={<DeleteIcon />}
                              size="sm"
                              colorScheme="red"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              Delete
                            </Button>
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </VStack>
          </TabPanel>

          {/* Game Settings Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Experience Multiplier</FormLabel>
                <NumberInput 
                  value={gameSettings.expMultiplier} 
                  onChange={(value) => setGameSettings({
                    ...gameSettings,
                    expMultiplier: parseFloat(value)
                  })}
                  min={0.1}
                  max={10}
                  step={0.1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Gold Multiplier</FormLabel>
                <NumberInput 
                  value={gameSettings.goldMultiplier} 
                  onChange={(value) => setGameSettings({
                    ...gameSettings,
                    goldMultiplier: parseFloat(value)
                  })}
                  min={0.1}
                  max={10}
                  step={0.1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Max Level</FormLabel>
                <NumberInput 
                  value={gameSettings.maxLevel} 
                  onChange={(value) => setGameSettings({
                    ...gameSettings,
                    maxLevel: parseInt(value)
                  })}
                  min={1}
                  max={999}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <Button colorScheme="blue" onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </VStack>
          </TabPanel>

          {/* Skills Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Button leftIcon={<AddIcon />} colorScheme="green" onClick={onSkillModalOpen}>
                Add New Skill
              </Button>

              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>ID</Th>
                    <Th>Name</Th>
                    <Th>Description</Th>
                    <Th>Base Exp</Th>
                    <Th>Timer (sec)</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {skills.map(skill => (
                    <Tr key={skill.id}>
                      <Td>{skill.id}</Td>
                      <Td>{skill.name}</Td>
                      <Td>{skill.description}</Td>
                      <Td>{skill.baseExp}</Td>
                      <Td>{skill.timerSeconds}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton
                            aria-label="Edit skill"
                            icon={<EditIcon />}
                            colorScheme="blue"
                            size="sm"
                            onClick={() => {
                              setEditingSkill(skill);
                              onEditSkillModalOpen();
                            }}
                          />
                          <IconButton
                            aria-label="Delete skill"
                            icon={<DeleteIcon />}
                            colorScheme="red"
                            size="sm"
                            onClick={() => handleDeleteSkill(skill.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </VStack>
          </TabPanel>

          {/* Items Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Heading size="md">Items</Heading>
              
              {/* Список предметов */}
              <Grid templateColumns="repeat(4, 1fr)" gap={4}>
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardBody>
                      <VStack spacing={2}>
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
                        {item.type === 'equipment' && (
                          <Text fontSize="sm" color="blue.500">Slot: {item.slot}</Text>
                        )}
                        {item.stats && Object.keys(item.stats).length > 0 && (
                          <VStack spacing={0} fontSize="sm">
                            {Object.entries(item.stats).map(([stat, value]) => (
                              <Text key={stat}>{stat}: {value}</Text>
                            ))}
                          </VStack>
                        )}
                        <HStack spacing={2}>
                          <Button
                            size="sm"
                            colorScheme="blue"
                            onClick={() => handleEditItem(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="red"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </Grid>

              {/* Модальное окно редактирования предмета */}
              <Modal isOpen={editItemModalOpen} onClose={() => setEditItemModalOpen(false)}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Edit Item</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <VStack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel>ID</FormLabel>
                        <Input
                          value={editingItem?.id || ''}
                          isReadOnly
                        />
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel>Name</FormLabel>
                        <Input
                          value={editingItem?.name || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Description</FormLabel>
                        <Textarea
                          value={editingItem?.description || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                        />
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel>Type</FormLabel>
                        <Select
                          value={editingItem?.type || 'resource'}
                          onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                        >
                          <option value="resource">Resource</option>
                          <option value="equipment">Equipment</option>
                          <option value="consumable">Consumable</option>
                        </Select>
                      </FormControl>

                      {editingItem?.type === 'equipment' && (
                        <FormControl isRequired>
                          <FormLabel>Equipment Slot</FormLabel>
                          <Select
                            value={editingItem?.slot || 'head'}
                            onChange={(e) => setEditingItem({ ...editingItem, slot: e.target.value })}
                          >
                            <option value="head">Head</option>
                            <option value="chest">Chest</option>
                            <option value="legs">Legs</option>
                            <option value="feet">Feet</option>
                            <option value="weapon">Weapon</option>
                          </Select>
                        </FormControl>
                      )}

                      <FormControl>
                        <FormLabel>Icon URL</FormLabel>
                        <Input
                          value={editingItem?.icon || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, icon: e.target.value })}
                        />
                      </FormControl>

                      {editingItem?.type === 'equipment' && (
                        <FormControl>
                          <FormLabel>Stats</FormLabel>
                          <VStack spacing={2}>
                            <HStack>
                              <Input
                                placeholder="Stat name"
                                value={newStatName}
                                onChange={(e) => setNewStatName(e.target.value)}
                              />
                              <Input
                                placeholder="Value"
                                type="number"
                                value={newStatValue}
                                onChange={(e) => setNewStatValue(e.target.value)}
                              />
                              <Button onClick={() => {
                                if (newStatName && newStatValue) {
                                  setEditingItem({
                                    ...editingItem,
                                    stats: {
                                      ...editingItem.stats,
                                      [newStatName]: Number(newStatValue)
                                    }
                                  });
                                  setNewStatName('');
                                  setNewStatValue('');
                                }
                              }}>Add</Button>
                            </HStack>
                            {Object.entries(editingItem?.stats || {}).map(([stat, value]) => (
                              <HStack key={stat} width="100%" justify="space-between">
                                <Text>{stat}: {value}</Text>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const newStats = { ...editingItem.stats };
                                    delete newStats[stat];
                                    setEditingItem({ ...editingItem, stats: newStats });
                                  }}
                                >
                                  Remove
                                </Button>
                              </HStack>
                            ))}
                          </VStack>
                        </FormControl>
                      )}
                    </VStack>
                  </ModalBody>

                  <ModalFooter>
                    <Button colorScheme="blue" mr={3} onClick={handleSaveItem}>
                      Save Changes
                    </Button>
                    <Button onClick={() => setEditItemModalOpen(false)}>Cancel</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </VStack>
          </TabPanel>

          {/* Channels Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Box p={4} borderWidth="1px" borderRadius="lg">
                <form onSubmit={handleCreateChannel}>
                  <VStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel>Channel Name</FormLabel>
                      <Input
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        placeholder="Enter channel name"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Channel Description</FormLabel>
                      <Input
                        value={channelDescription}
                        onChange={(e) => setChannelDescription(e.target.value)}
                        placeholder="Enter channel description"
                      />
                    </FormControl>
                    <Button type="submit" colorScheme="blue">
                      Create Channel
                    </Button>
                  </VStack>
                </form>
              </Box>

              <TableContainer>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Channel Name</Th>
                      <Th>Description</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {channels.map((channel) => (
                      <Tr key={channel.id}>
                        <Td>{channel.name}</Td>
                        <Td>{channel.description}</Td>
                        <Td>
                          <Button
                            colorScheme="red"
                            size="sm"
                            onClick={() => handleDeleteChannel(channel.id)}
                          >
                            Delete
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Модальное окно бана пользователя */}
      <Modal isOpen={isBanModalOpen} onClose={() => setIsBanModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Ban User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Ban Duration</FormLabel>
                <Select value={banDuration} onChange={(e) => setBanDuration(e.target.value)}>
                  <option value="permanent">Permanent</option>
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="custom">Custom</option>
                </Select>
              </FormControl>

              {banDuration === 'custom' && (
                <FormControl>
                  <FormLabel>Custom Duration (hours)</FormLabel>
                  <Input
                    type="number"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="Enter hours"
                  />
                </FormControl>
              )}

              <FormControl>
                <FormLabel>Ban Reason</FormLabel>
                <Textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Enter reason for ban"
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleBanUser}>
              Ban User
            </Button>
            <Button variant="ghost" onClick={() => setIsBanModalOpen(false)}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Модальное окно редактирования пользователя */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit User</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  value={selectedUser?.email || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Username</FormLabel>
                <Input
                  value={selectedUser?.username || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Role</FormLabel>
                <Select
                  value={selectedUser?.role || 'user'}
                  onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Chat Blocked</FormLabel>
                <Switch
                  isChecked={selectedUser?.chatBlocked || false}
                  onChange={(e) => setSelectedUser({ ...selectedUser, chatBlocked: e.target.checked })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Chat Muted</FormLabel>
                <Switch
                  isChecked={selectedUser?.chatMuted || false}
                  onChange={(e) => setSelectedUser({ ...selectedUser, chatMuted: e.target.checked })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Chat Block Reason</FormLabel>
                <Textarea
                  value={selectedUser?.chatBlockReason || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, chatBlockReason: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleSaveUser}>
              Save Changes
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Skill Modal */}
      <Modal isOpen={isSkillModalOpen} onClose={onSkillModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Skill</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Skill ID</FormLabel>
                <Input
                  value={newSkill.id}
                  onChange={(e) => setNewSkill({ ...newSkill, id: e.target.value.toLowerCase() })}
                  placeholder="e.g., cooking"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={newSkill.name}
                  onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                  placeholder="e.g., Cooking"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={newSkill.description}
                  onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                  placeholder="Describe the skill..."
                />
              </FormControl>

              <FormControl>
                <FormLabel>Base Experience</FormLabel>
                <NumberInput
                  value={newSkill.baseExp}
                  onChange={(value) => setNewSkill({ ...newSkill, baseExp: parseInt(value) })}
                  min={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Timer Duration (seconds)</FormLabel>
                <NumberInput
                  value={newSkill.timerSeconds}
                  onChange={(value) => setNewSkill({ ...newSkill, timerSeconds: parseInt(value) })}
                  min={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Icon URL</FormLabel>
                <Input
                  value={newSkill.icon}
                  onChange={(e) => setNewSkill({ ...newSkill, icon: e.target.value })}
                  placeholder="URL to skill icon"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Common Drops</FormLabel>
                <ChakraSelect
                  isMulti
                  value={items
                    .filter(item => newSkill.commonDrops?.includes(item.id))
                    .map(item => ({
                      value: item.id,
                      label: item.name
                    }))
                  }
                  onChange={(selectedOptions) => {
                    const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
                    setNewSkill({
                      ...newSkill,
                      commonDrops: selectedIds
                    });
                  }}
                  options={items.map(item => ({
                    value: item.id,
                    label: item.name
                  }))}
                  placeholder="Select common drops"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Rare Drops</FormLabel>
                <ChakraSelect
                  isMulti
                  value={items
                    .filter(item => newSkill.rareDrops?.includes(item.id))
                    .map(item => ({
                      value: item.id,
                      label: item.name
                    }))
                  }
                  onChange={(selectedOptions) => {
                    const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
                    setNewSkill({
                      ...newSkill,
                      rareDrops: selectedIds
                    });
                  }}
                  options={items.map(item => ({
                    value: item.id,
                    label: item.name
                  }))}
                  placeholder="Select rare drops"
                />
              </FormControl>

              <Button colorScheme="blue" onClick={handleAddSkill} width="100%">
                Add Skill
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Edit Skill Modal */}
      <Modal isOpen={isEditSkillModalOpen} onClose={onEditSkillModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Skill</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={editingSkill?.name || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  placeholder="e.g., Cooking"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={editingSkill?.description || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                  placeholder="Describe the skill..."
                />
              </FormControl>

              <FormControl>
                <FormLabel>Base Experience</FormLabel>
                <NumberInput
                  value={editingSkill?.baseExp || 10}
                  onChange={(value) => setEditingSkill({ ...editingSkill, baseExp: parseInt(value) })}
                  min={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Timer Duration (seconds)</FormLabel>
                <NumberInput
                  value={editingSkill?.timerSeconds || 60}
                  onChange={(value) => setEditingSkill({ ...editingSkill, timerSeconds: parseInt(value) })}
                  min={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Icon URL</FormLabel>
                <Input
                  value={editingSkill?.icon || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, icon: e.target.value })}
                  placeholder="URL to skill icon"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Common Drops</FormLabel>
                <ChakraSelect
                  isMulti
                  value={items
                    .filter(item => editingSkill?.commonDrops?.includes(item.id))
                    .map(item => ({
                      value: item.id,
                      label: item.name
                    }))
                  }
                  onChange={(selectedOptions) => {
                    const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
                    setEditingSkill({
                      ...editingSkill,
                      commonDrops: selectedIds
                    });
                  }}
                  options={items.map(item => ({
                    value: item.id,
                    label: item.name
                  }))}
                  placeholder="Select common drops"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Rare Drops</FormLabel>
                <ChakraSelect
                  isMulti
                  value={items
                    .filter(item => editingSkill?.rareDrops?.includes(item.id))
                    .map(item => ({
                      value: item.id,
                      label: item.name
                    }))
                  }
                  onChange={(selectedOptions) => {
                    const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
                    setEditingSkill({
                      ...editingSkill,
                      rareDrops: selectedIds
                    });
                  }}
                  options={items.map(item => ({
                    value: item.id,
                    label: item.name
                  }))}
                  placeholder="Select rare drops"
                />
              </FormControl>

              <Button colorScheme="blue" onClick={handleEditSkill} width="100%">
                Save Changes
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AdminPanel;
