// Import the functions you need from the SDKs you need
import { getAnalytics, isSupported } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCyDNLuEtNR1Ev7hDKgixH4lnBs68yt0hw",
  authDomain: "flowstry-aaaa9.firebaseapp.com",
  projectId: "flowstry-aaaa9",
  storageBucket: "flowstry-aaaa9.firebasestorage.app",
  messagingSenderId: "522751782790",
  appId: "1:522751782790:web:d456868726f7f91085c607",
  measurementId: "G-H2WKD2KWT9"
};

// Initialize Firebase (prevent re-initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics only on client-side
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined") {
  isSupported().then((supported: boolean) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { analytics, app };

