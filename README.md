# Idle_Multiplayer

Многопользовательская idle-игра с элементами социального взаимодействия и прогрессии персонажа.

## Описание проекта

Idle_Multiplayer - это веб-приложение, сочетающее в себе механики idle-игр с многопользовательским взаимодействием. Игроки могут развивать своих персонажей, общаться друг с другом и соревноваться в различных аспектах игры.

### Основные возможности

- **Многопользовательское взаимодействие**: Чат, торговля и совместные активности
- **Система профилей**: Уникальные профили игроков с достижениями и статистикой
- **Модерация**: Инструменты для поддержания здорового игрового сообщества
- **Административная панель**: Управление игрой и мониторинг активности

## Технологический стек

### Frontend
- React.js - основной фреймворк
- Firebase Authentication - система аутентификации
- WebSocket - real-time коммуникация
- HTML5/CSS3 - верстка и стилизация

### Backend
- Node.js - серверная часть
- Firebase - база данных и хостинг
- WebSocket Server - обработка real-time соединений

## Установка и запуск

### Предварительные требования
- Node.js (версия 14.0.0 или выше)
- npm (версия 6.0.0 или выше)
- Git

### Шаги установки

1. Клонирование репозитория:
```bash
git clone [URL репозитория]
cd Idle_Multiplayer
```

2. Установка зависимостей:
```bash
npm install
```

3. Настройка Firebase:
Для настройки Firebase создайте файл `src/config/firebase.js` со следующим содержимым:

```javascript
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const db = getFirestore(app);

// Подключаем эмулятор для локальной разработки
if (process.env.NODE_ENV === 'development') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;

4. Запуск проекта:
```bash
npm start
```

## Структура проекта

```
src/
├── components/         # React компоненты
│   ├── Admin/         # Административные компоненты
│   ├── Auth/          # Компоненты аутентификации
│   ├── Chat/          # Чат система
│   ├── Game/          # Игровые компоненты
│   ├── Profile/       # Профили игроков
│   └── Navigation/    # Навигационные элементы
├── config/            # Конфигурационные файлы
├── gameData/          # Игровые данные и механики
└── utils/             # Вспомогательные функции
```
