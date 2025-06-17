## 🏗️ Infrastructure & Tech Stack

- **Frontend:** React Native (Expo)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (cloud)
- **Authentication:** JWT
- **API Communication:** REST (JSON)

---

## 🚀 Getting Started

### 1. Setup the Backend (HSUBackend)

#### a. Create a .env file in HSUBackend/ with the following content:

```sh
MONGODB_URI=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_jwt_secret
```


#### b. Install dependencies and run backend server:

```sh
cd ../HSUBackend
npm install
npm run dev // run Backend
```