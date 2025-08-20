// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebaseの設定（Firebaseコンソールの値を使用）
const firebaseConfig = {
  apiKey: "AIzaSyB1ZKM2j8epqauRiYnlwd9GemHw5qltyOk",
  authDomain: "kaede-vote-back.firebaseapp.com",
  projectId: "kaede-vote-back",
  storageBucket: "kaede-vote-back.firebasestorage.app",
  messagingSenderId: "612230015492",
  appId: "1:612230015492:web:285cef7c4a267d0ecde351",
  measurementId: "G-SY3402QMCD"
}
;

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firestoreのインスタンスを取得
const db = getFirestore(app);

export { db };
