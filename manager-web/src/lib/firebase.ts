import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC593pQKjcrxY6wJbEe95LOwvrgGp0v4tU",
  authDomain: "barber-booking-app-2ad2b.firebaseapp.com",
  projectId: "barber-booking-app-2ad2b",
  storageBucket: "barber-booking-app-2ad2b.firebasestorage.app",
  messagingSenderId: "27538477845",
  appId: "1:27538477845:web:31818a678014923a414f1c",
  measurementId: "G-E5X0LL66S6",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
