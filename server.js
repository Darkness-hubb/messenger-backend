const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Подключение к базе данных MongoDB Atlas через переменную окружения MONGO_URI
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('Успешно подключились к MongoDB Atlas!'))
    .catch(err => console.error('Ошибка подключения к базе данных:', err));
} else {
  console.log('Внимание: MONGO_URI не найден в Environment Variables!');
}

// Схема и модель для сообщений
const messageSchema = new mongoose.Schema({
  username: String,
  text: String,
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Раздача статических файлов (index.html и др.) из текущей папки
app.use(express.static(path.join(__dirname)));

io.on('connection', async (socket) => {
  console.log('Пользователь подключился');

  // 1. Отправляем историю последних 50 сообщений новому пользователю
  try {
    const history = await Message.find().sort({ time: 1 }).limit(50);
    socket.emit('chat history', history);
  } catch (err) {
    console.error('Ошибка при загрузке истории:', err);
  }

  // 2. Слушаем новые сообщения от клиентов
  socket.on('chatMessage', async (data) => {
    try {
      const username = data.username || 'Аноним';
      const text = data.text;

      if (!text) return;

      // Сохраняем сообщение в базу данных
      const newMessage = new Message({ username, text });
      await newMessage.save();

      // Рассылаем всем подключенным пользователям
      io.emit('chatMessage', {
        username: newMessage.username,
        text: newMessage.text
      });
    } catch (err) {
      console.error('Ошибка при сохранении сообщения:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился');
  });
});

// Запуск сервера на порту от Render или 3000 локально
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
