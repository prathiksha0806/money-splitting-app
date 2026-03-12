# Splitter - Full Stack Setup Guide

## What you need (all free):
1. Firebase account → https://console.firebase.google.com
2. Anthropic API key → https://console.anthropic.com (for AI chat)

---

## STEP 1 — Install dependencies

In your terminal (inside the splitter folder):
```
npm install firebase recharts
```

---

## STEP 2 — Create Firebase project

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → give it a name like "splitter-app" → Continue
3. Disable Google Analytics (optional) → **Create project**

### Enable Authentication:
4. In left sidebar → **Authentication** → **Get started**
5. Click **Email/Password** → Enable → Save

### Enable Firestore:
6. In left sidebar → **Firestore Database** → **Create database**
7. Choose **Start in test mode** → Next → Select a location → Done

### Get your config:
8. Go to **Project Settings** (gear icon) → **Your apps** → click **</>** (Web)
9. Register app (any nickname) → Copy the `firebaseConfig` object

---

## STEP 3 — Add Firebase config

Open `src/firebase/config.js` and replace the placeholder values:
```js
const firebaseConfig = {
  apiKey: "AIza...",           // ← paste your values here
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  ...
};
```

---

## STEP 4 — Add Firestore security rules

In Firebase → Firestore → **Rules** tab, paste this:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    match /expenses/{id} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.memberIds;
      allow create: if request.auth != null;
    }
    match /friends/{id} {
      allow read, write: if request.auth != null;
    }
    match /settlements/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```
Click **Publish**.

---

## STEP 5 — Add Anthropic API key (for AI chat)

Open `src/pages/AIInsights.js` and replace:
```js
const ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_API_KEY_HERE";
```
with your key from https://console.anthropic.com

---

## STEP 6 — Copy files into your project

Copy everything from `src/` into your React project's `src/` folder.
Then run:
```
npm start
```

---

## How to use:

1. **Register** with your email and name
2. **Add friends** by searching their email (they must also be registered)
3. **Add expenses** and split them equally, by % or by exact amount
4. **Settlements** tab shows the minimum transactions needed to clear all debts
5. **AI Insights** answers questions about your spending

---

## Folder structure:
```
src/
  App.js                    ← Main app + all styles
  firebase/
    config.js               ← Your Firebase config goes here
  hooks/
    useAuth.js              ← Authentication context
  pages/
    AuthPage.js             ← Login / Register
    Dashboard.js            ← Overview + charts
    Expenses.js             ← Expense list + add modal
    Friends.js              ← Add/remove real friends
    Settlements.js          ← Debt simplification
    AIInsights.js           ← AI chat (needs API key)
```
