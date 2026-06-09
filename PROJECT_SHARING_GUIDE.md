# 📦 PROJECT SHARING GUIDE

## ✅ **What to DELETE before sharing:**

### 1. **Backend:**
- ❌ Delete `.venv` folder (Python virtual environment)
- ❌ Delete `__pycache__` folders
- ✅ Keep `requirements.txt` (needed to recreate environment)

### 2. **Frontend:**
- ❌ Delete `node_modules` folder (huge - 200MB+)
- ❌ Delete `build` folder (can be regenerated)
- ✅ Keep `package.json` and `package-lock.json` (needed to recreate)

### 3. **Sensitive Files:**
- ❌ Delete `.env` files (contain API keys)
- ❌ Delete `firebase-credentials.json` (sensitive)
- ✅ Keep `.env.example` files (show what's needed)

---

## 📁 **Files to DELETE:**

```
AI-StudyPlanner/
├── backend/
│   ├── .venv/          ❌ DELETE (200MB+)
│   ├── __pycache__/    ❌ DELETE
│   ├── .env            ❌ DELETE (has API keys)
│   └── firebase-credentials.json  ❌ DELETE (sensitive)
├── frontend/
│   ├── node_modules/   ❌ DELETE (300MB+)
│   ├── build/          ❌ DELETE (can rebuild)
│   └── .env            ❌ DELETE (has API keys)
```

---

## 🎯 **How to Share:**

### **Option 1: ZIP File (Recommended)**
1. Delete the folders mentioned above
2. Create ZIP of entire project
3. Share via Google Drive, Dropbox, or email

### **Option 2: GitHub (Best for developers)**
1. Create GitHub repository
2. Add `.gitignore` file (automatically excludes these folders)
3. Push code to GitHub
4. Share repository link

---

## 📋 **Setup Instructions for Your Teammate:**

Create this file for your teammate:

### **SETUP_INSTRUCTIONS.md**

```markdown
# 🚀 AI Study Planner - Setup Instructions

## Prerequisites:
- Python 3.8+ installed
- Node.js 18+ installed
- Git (if using GitHub)

## 📥 Setup Steps:

### 1. Backend Setup:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

### 2. Frontend Setup:
```bash
cd frontend
npm install
```

### 3. Environment Variables:
Create these files with your own API keys:

**backend/.env:**
```
GEMINI_API_KEY=your_gemini_key_here
GROQ_API_KEY=your_groq_key_here
```

**frontend/.env:**
```
REACT_APP_API_URL=http://localhost:5000
```

### 4. Firebase Setup:
- Create Firebase project
- Download `firebase-credentials.json`
- Place in `backend/` folder
- Update Firebase config in `frontend/src/firebase/config.js`

### 5. Run Project:
```bash
# Terminal 1 - Backend
cd backend
.venv\Scripts\activate
python app.py

# Terminal 2 - Frontend  
cd frontend
npm start
```

### 6. Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
```

---

## 💡 **Pro Tips:**

### **File Size Comparison:**
- **With node_modules + .venv:** ~800MB
- **Without them:** ~50MB (16x smaller!)

### **What Your Teammate Needs:**
1. **Your ZIP file** (without node_modules/.venv)
2. **Their own API keys:**
   - Gemini API key (Google AI Studio)
   - Groq API key (groq.com)
3. **Their own Firebase project**
4. **Setup instructions** (create the file above)

### **Security Note:**
Never share:
- API keys
- Firebase credentials
- Database passwords
- Any `.env` files

---

## 🔧 **Quick Commands for You:**

### **Before Sharing:**
```bash
# Delete large folders
rmdir /s /q frontend\node_modules
rmdir /s /q frontend\build  
rmdir /s /q backend\.venv
rmdir /s /q backend\__pycache__

# Delete sensitive files
del backend\.env
del frontend\.env
del backend\firebase-credentials.json
```

### **After Sharing (to restore your environment):**
```bash
# Recreate backend environment
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Recreate frontend dependencies
cd frontend
npm install
```

---

## ✅ **Checklist Before Sharing:**

- [ ] Deleted `node_modules` folder
- [ ] Deleted `.venv` folder  
- [ ] Deleted `build` folder
- [ ] Deleted `.env` files
- [ ] Deleted `firebase-credentials.json`
- [ ] Created setup instructions
- [ ] Tested file size (should be ~50MB)
- [ ] Ready to share! 🚀

---

**File size should go from ~800MB to ~50MB after cleanup!**