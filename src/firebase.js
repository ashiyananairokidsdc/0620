import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase ウェブ設定（このキーは公開前提のものです。データの保護は Firestore のルールで行います）
const firebaseConfig = {
  apiKey: "AIzaSyB6-8Io-a-zJknuGnW2dhV9zsECzKbCVzQ",
  authDomain: "questionnaire-26436.firebaseapp.com",
  projectId: "questionnaire-26436",
  storageBucket: "questionnaire-26436.firebasestorage.app",
  messagingSenderId: "997954998638",
  appId: "1:997954998638:web:b027bb1f6f60dfa6a0317f",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
