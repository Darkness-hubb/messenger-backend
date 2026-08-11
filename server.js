const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const GOOGLE_CLIENT_ID = '874189976905-p2fvq2et5ujeui2tsrtapkfpfco62b0c.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'смени-меня-на-случайную-строку-12345';

const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);

const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('Успешно подключились к MongoDB Atlas!'))
    .catch(err => console.error('Ошибка подключения к базе данных:', err));
} else {
  console.log('Внимание: MONGO_URI не найден в Environment Variables!');
}

const messageSchema = new mongoose.Schema({
  username: String,
  text: String,
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  name: String,
  picture: String,
  tag: String,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

app.use(express.json());

app.post('/api/auth/google', async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: 'No token' });

    const ticket = await oauth2Client.verifyIdToken({
      idToken: id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = new User({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        tag: '@' + (payload.email.split('@')[0] || 'user')
      });
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
        picture: user.picture,
        tag: user.tag
      }
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Auth failed' });
  }
});

app.use(express.static(path.join(__dirname)));

io.on('connection', async (socket) => {
  console.log('Пользователь подключился');

  try {
    const history = await Message.find().sort({ time: 1 }).limit(50);
    socket.emit('chat history', history);
  } catch (err) {
    console.error('Ошибка при загрузке истории:', err);
  }

  socket.on('chatMessage', async (data) => {
    try {
      const username = data.username || 'Аноним';
      const text = data.text;
      if (!text) return;

      const newMessage = new Message({ username, text });
      await newMessage.save();

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
