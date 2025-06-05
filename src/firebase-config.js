import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCV2MvacCnnq8QNs18jZAXvH71ch86CiXw",
  authDomain: "wartelsuspas-kerobokan.firebaseapp.com",
  projectId: "wartelsuspas-kerobokan",
  storageBucket: "wartelsuspas-kerobokan.firebasestorage.app",
  messagingSenderId: "52510668491",
  appId: "1:52510668491:web:e5bf7cf71bc46dd4968d4e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };