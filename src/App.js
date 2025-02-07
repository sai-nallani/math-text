import logo from './logo.svg';
import './App.css';
import { db } from './firebase';
// Import any Firestore methods you need, for example:
import { collection, addDoc, getDocs, query, orderBy, onSnapshot, where, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';  // You'll need to run: npm install js-cookie
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import 'katex/dist/katex.min.css';
import { HashRouter as Router } from 'react-router-dom';

function Login({ setUsername, setLoggedIn }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isRegistering) {
        // Check if username/email already exists
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, 
          where('username', '==', formData.username)
        );
        const userDocs = await getDocs(userQuery);
        
        if (!userDocs.empty) {
          setError('Username already exists');
          return;
        }

        // Create new user
        await addDoc(usersRef, {
          username: formData.username,
          email: formData.email,
          password: formData.password // Note: In production, use proper password hashing
        });
      } else {
        // Login
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, 
          where('username', '==', formData.username),
          where('password', '==', formData.password)
        );
        const userDocs = await getDocs(userQuery);
        
        if (userDocs.empty) {
          setError('Invalid credentials');
          return;
        }
      }

      setUsername(formData.username);
      setLoggedIn(true);
    } catch (error) {
      setError('An error occurred');
      console.error(error);
    }
  };

  return (
    <div className="login-container">
      <h2>{isRegistering ? 'Register' : 'Login'}</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Username"
          value={formData.username}
          onChange={(e) => setFormData({...formData, username: e.target.value})}
        />
        {isRegistering && (
          <input 
            type="email" 
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
        )}
        <input 
          type="password" 
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
        />
        <button type="submit">{isRegistering ? 'Register' : 'Login'}</button>
      </form>
      <button onClick={() => setIsRegistering(!isRegistering)}>
        {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
      </button>
    </div>
  );
}

function ChatRoom({ username }) {
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');  // New state for room creation password
  const [roomPassword, setRoomPassword] = useState('');  // New state for room entry password
  const [showPasswordModal, setShowPasswordModal] = useState(false);  // Control password modal visibility
  const [attemptingRoomId, setAttemptingRoomId] = useState(null);  // Track which room we're trying to join
  const [passwordError, setPasswordError] = useState('');  // Track password errors
  const [authorizedRooms, setAuthorizedRooms] = useState(new Set(JSON.parse(Cookies.get('authorizedRooms') || '[]')));

  // Clear messages when switching rooms
  useEffect(() => {
    setMessages([]);
  }, [selectedRoom]);

  // Save authorized rooms to cookies
  useEffect(() => {
    Cookies.set('authorizedRooms', JSON.stringify([...authorizedRooms]), { 
      expires: 7,
      sameSite: 'Strict',
      secure: true
    });
  }, [authorizedRooms]);

  // Add this useEffect to initialize MathJax configuration
  useEffect(() => {
    if (window.MathJax) {
      window.MathJax = {
        ...window.MathJax,
        tex: {
          inlineMath: [['$', '$']],
          displayMath: [['$$', '$$']]
        },
        svg: {
          fontCache: 'global'
        }
      };
    }
  }, []);

  // Add this useEffect to render math when messages change
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      try {
        window.MathJax.typesetPromise();
      } catch (error) {
        console.error('MathJax error:', error);
      }
    }
  }, [messages]);

  const createRoom = async () => {
    if (!newRoomName.trim() || !newRoomPassword.trim()) {
      alert('Please provide both room name and password');
      return;
    }
    
    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('username', '==', username));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        console.error('User not found');
        return;
      }

      const userDocRef = userSnapshot.docs[0].ref;
      const roomsRef = collection(db, 'rooms');
      await addDoc(roomsRef, {
        name: newRoomName,
        password: newRoomPassword,  // Store the room password
        members: [userDocRef],
        createdBy: userDocRef
      });
      setNewRoomName('');
      setNewRoomPassword('');
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const attemptRoomJoin = (roomId) => {
    if (authorizedRooms.has(roomId)) {
      setSelectedRoom(roomId);
    } else {
      setAttemptingRoomId(roomId);
      setShowPasswordModal(true);
      setPasswordError('');
      setRoomPassword('');
    }
  };

  const handleRoomPasswordSubmit = async () => {
    try {
      const roomRef = doc(db, 'rooms', attemptingRoomId);
      const roomDoc = await getDoc(roomRef);
      
      if (!roomDoc.exists()) {
        setPasswordError('Room not found');
        return;
      }

      const roomData = roomDoc.data();
      if (roomData.password === roomPassword) {
        setSelectedRoom(attemptingRoomId);
        setShowPasswordModal(false);
        setPasswordError('');
        setRoomPassword('');
        // Add room to authorized rooms
        setAuthorizedRooms(prev => new Set([...prev, attemptingRoomId]));
      } else {
        setPasswordError('Incorrect password');
      }
    } catch (error) {
      console.error('Error verifying room password:', error);
      setPasswordError('Error verifying password');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = async (content) => {
    try {
      const processor = unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkRehype)
        .use(rehypeKatex)
        .use(rehypeStringify);

      const result = await processor.process(content);
      return { __html: result.toString() };
    } catch (error) {
      console.error('Error formatting message:', error);
      return { __html: content };
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom) return;
    
    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('username', '==', username));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        console.error('User not found');
        return;
      }

      const userDocRef = userSnapshot.docs[0].ref;
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        message: messageInput,
        roomId: doc(db, 'rooms', selectedRoom),
        username: userDocRef,
        createdAt: new Date()
      });
      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteDoc(doc(db, 'messages', messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  useEffect(() => {
    // Fetch rooms
    const roomsRef = collection(db, 'rooms');
    const unsubscribeRooms = onSnapshot(roomsRef, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRooms(roomsData);
    });

    return () => unsubscribeRooms();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;

    // Fetch messages for selected room
    const messagesRef = collection(db, 'messages');
    const messagesQuery = query(
      messagesRef, 
      where('roomId', '==', doc(db, 'rooms', selectedRoom)),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const messagesData = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        // Fetch the user document using the reference
        const userDoc = await getDoc(data.username);
        return {
          id: doc.id,
          message: data.message,
          username: userDoc.exists() ? userDoc.data().username : 'Unknown User',
          createdAt: data.createdAt?.toDate() || new Date()
        };
      }));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [selectedRoom]);

  return (
    <div className="chat-container">
      <div className="rooms-sidebar">
        <div className="create-room">
          <input
            type="text"
            placeholder="New Room Name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <input
            type="password"
            placeholder="Room Password"
            value={newRoomPassword}
            onChange={(e) => setNewRoomPassword(e.target.value)}
          />
          <button onClick={createRoom}>Create Room</button>
        </div>
        <div className="rooms-list">
          {rooms.map(room => (
            <div
              key={room.id}
              className={`room-item ${selectedRoom === room.id ? 'selected' : ''}`}
              onClick={() => attemptRoomJoin(room.id)}
            >
              {room.name}
            </div>
          ))}
        </div>
      </div>
      
      {showPasswordModal && (
        <div className="password-modal">
          <div className="password-modal-content">
            <h3>Enter Room Password</h3>
            {passwordError && <p className="error">{passwordError}</p>}
            <input
              type="password"
              placeholder="Room Password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRoomPasswordSubmit()}
            />
            <div className="password-modal-buttons">
              <button onClick={handleRoomPasswordSubmit}>Join Room</button>
              <button onClick={() => setShowPasswordModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectedRoom ? (
        <div className="chat-area">
          <div className="message-list">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`message-item ${message.username === username ? 'own-message' : ''}`}
              >
                <div className="message-header">
                  <span className="username">{message.username}</span>
                  <span className="timestamp">
                    {message.createdAt instanceof Date 
                      ? message.createdAt.toLocaleTimeString()
                      : message.createdAt.toDate().toLocaleTimeString()}
                  </span>
                  {message.username === username && (
                    <button 
                      className="delete-message"
                      onClick={() => handleDeleteMessage(message.id)}
                      title="Delete message"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="message-content">
                  {message.message.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="message-input-container">
            <textarea 
              placeholder="Type a message... Use $...$ for inline math and $$...$$ for display math"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>
        </div>
      ) : (
        <div className="no-room-selected">
          Select a room to start chatting
        </div>
      )}
    </div>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState(() => {
    const savedUsername = Cookies.get('username');
    return !!savedUsername;
  });
  const [username, setUsername] = useState(() => Cookies.get('username') || '');

  const handleLoginSuccess = (user) => {
    setUsername(user);
    setLoggedIn(true);
    Cookies.set('username', user, { 
      expires: 7,
      sameSite: 'Strict',
      secure: true
    });
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUsername('');
    Cookies.remove('username');
    Cookies.remove('authorizedRooms');
  };

  return (
    <Router>
      {!loggedIn ? (
        <Login setUsername={handleLoginSuccess} setLoggedIn={setLoggedIn}/>
      ) : (
        <div className="app-container">
          <div className="header">
            <span>Welcome, {username}</span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
          <ChatRoom username={username} />
        </div>
      )}
    </Router>
  );
}

export default App;
