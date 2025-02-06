import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration object
const firebaseConfig = {

  apiKey: "AIzaSyAEbLZ3QgNhY_uWZ_2XthSmIEhvsG2ZHPY",

  authDomain: "math-chat-37cda.firebaseapp.com",

  databaseURL: "https://math-chat-37cda-default-rtdb.firebaseio.com",

  projectId: "math-chat-37cda",

  storageBucket: "math-chat-37cda.firebasestorage.app",

  messagingSenderId: "724781391419",

  appId: "1:724781391419:web:7f972437a2b81ef06bc61e",

  measurementId: "G-H74CXZTN8G"

};



// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app); 