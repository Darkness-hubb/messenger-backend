const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Раздаем файлы сайта (index.html, стили и скрипты)
app.use(express.static(__dirname));

// Логика подключения пользователей
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Прием и рассылка текстовых сообщений
  socket.on('message', (data) => {
    io.emit('message', data);
  });

  // Передача сигналов для WebRTC (видео/аудио звонки)
  socket.on('signal', (data) => {
    socket.broadcast.emit('signal', data);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

// Запуск сервера на порту 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Сервер успешно запущен! Открывай: http://localhost:${PORT}`);
});
