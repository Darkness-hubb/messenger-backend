const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Подключение к MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('Успешно подключились к MongoDB Atlas!'))
    .catch(err => console.error('Ошибка подключения к базе данных:', err));
} else {
  console.log('MONGO_URI не найден в переменных окружения.');
}

// Схема для хранения сообщений
const messageSchema = new mongoose.Schema({
  username: String,
  text: String,
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.static(path.join(__dirname)));

io.on('connection', async (socket) => {
  console.log('Пользователь подключился');

  // Отправляем последние 50 сообщений при входе
  try {
    const history = await Message.find().sort({ time: 1 }).limit(50);
    socket.emit('chat history', history);
  } catch (err) {
    console.error('Ошибка загрузки истории:', err);
  }

  // Получение нового сообщения
  socket.on('chat message', async (data) => {
    try {
      const newMessage = new Message({
        username: data.username || 'Аноним',
        text: data.text
      });
      await newMessage.save();
      
      io.emit('chat message', {
        username: newMessage.username,
        text: newMessage.text
      });
    } catch (err) {
      console.error('Ошибка сохранения сообщения:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
