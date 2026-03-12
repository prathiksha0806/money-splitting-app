// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Replace these values with YOUR Firebase project config
// Go to: https://console.firebase.google.com
// → Create project → Add app (Web) → Copy config here
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkpgyHpC1yNAKSScAFjuyZpQT2s_jhp34",
  authDomain: "money-spliting-app.firebaseapp.com",
  projectId: "money-spliting-app",
  storageBucket: "money-spliting-app.firebasestorage.app",
  messagingSenderId: "54501201848",
  appId: "1:54501201848:web:981689c67444fb67a7a14d",
  measurementId: "G-Q6440SCG25"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;


