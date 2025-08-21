// firebase.js
import { initializeApp } from "firebase/app";

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

// Firestoreは各コンポーネント側で必要時に dynamic import し、getFirestore(app) を呼び出します。
export { app };
