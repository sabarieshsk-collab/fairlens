# FairLens - AI-Powered Hiring Fairness Platform

![FairLens](https://img.shields.io/badge/FairLens-Hiring%20Fairness-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**FairLens** is an intelligent compliance platform that detects and remediates hiring bias in real time. Built for HR teams in India, it uses AI and statistical analysis to audit hiring decisions against constitutional protections and DPDPA 2023 requirements.

## Features

- **Bias Detection**: Analyze hiring data against proxy variables (college tier, city, surname, career gaps)
- **Legal Framework Coverage**: 
  - Indian Constitution (Articles 15 & 16)
  - SC/ST Prevention of Atrocities Act 1989
  - Companies Act Amendment 2023
  - Digital Personal Data Protection Act 2023
  - EU AI Act 2024 (if applicable)
- **Automated Remediation**: AI-generated remediation proposals with 3-step approval workflow
- **Compliance Reports**: Professional PDF documentation for audit trails
- **Real-Time Monitoring**: Dashboard with fairness metrics and alerts
- **Data Privacy**: Full compliance with DPDPA 2023 data residency requirements

## Prerequisites

- **Node.js** 18.0 or higher
- **npm** or **yarn** package manager
- **Firebase CLI**: `npm install -g firebase-tools`
- **Firebase Project** with these services enabled:
  - Authentication (Google Sign-In provider)
  - Firestore Database
  - Cloud Storage
  - Cloud Functions (optional, for future enhancements)
  - Hosting

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/fairlens.git
cd fairlens
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the environment template and fill in your Firebase configuration:

```bash
cp .env.local.template .env.local
```

Edit `.env.local` with your values:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
```

### 4. Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click **Create API Key**
3. Copy the key and add it to `.env.local` as `REACT_APP_GEMINI_API_KEY`

### 5. Login to Firebase

```bash
firebase login
```

### 6. Set Your Firebase Project

```bash
firebase use your-project-id
```

You can find your project ID in your Firebase Console or by running:

```bash
firebase projects:list
```

## Development

### Start Development Server

```bash
npm start
```

The application will open at `http://localhost:3000` with hot reload enabled.

### Build for Production

```bash
npm run build
```

Creates an optimized production build in the `build/` directory.

### Run Tests

```bash
npm test
```

## Deployment

### Deploy to Firebase Hosting

```bash
npm run build && firebase deploy
```

This command:
1. Creates an optimized production build
2. Deploys to Firebase Hosting
3. Initializes Firestore indexes if needed
4. Sets up Cloud Functions if configured

#### First-Time Deployment Setup

If deploying for the first time, initialize Firebase in your project:

```bash
firebase init hosting
firebase init firestore
```

Then deploy:

```bash
firebase deploy
```

Your application will be live at: `https://your-project-id.web.app`

### View Deployment Logs

```bash
firebase hosting:channel:list
firebase functions:log --limit 50
```

## Project Structure

```
fairlens/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── TopBar.jsx
│   │   └── ui/
│   │       ├── AlertBadge.jsx
│   │       ├── ErrorBoundary.jsx
│   │       ├── FairnessGauge.jsx
│   │       ├── LoadingSpinner.jsx
│   │       ├── MetricCard.jsx
│   │       └── StatusBadge.jsx
│   ├── pages/
│   │   ├── AuditHistory.jsx
│   │   ├── CandidateDetail.jsx
│   │   ├── ComplianceReports.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Login.jsx
│   │   ├── Monitoring.jsx
│   │   ├── NewAudit.jsx
│   │   ├── Onboarding.jsx
│   │   ├── Remediation.jsx
│   │   └── Settings.jsx
│   ├── services/
│   │   ├── biasCalculator.js
│   │   ├── firebase.js
│   │   ├── gemini.js
│   │   ├── reportGenerator.js
│   │   └── surrogateModel.js
│   ├── hooks/
│   │   ├── useAudit.js
│   │   ├── useAuth.js
│   │   └── useOrganization.js
│   ├── utils/
│   │   ├── cityTiers.js
│   │   ├── collegeTiers.js
│   │   ├── constants.js
│   │   └── surnameMapping.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── .firebaserc
├── firebase.json
├── .env.local
├── .gitignore
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Architecture

### Frontend (React 19.2)
- **State Management**: React hooks + Context API
- **Routing**: React Router v7
- **Styling**: Tailwind CSS with custom color system
- **Charts**: Recharts for data visualization
- **PDF Generation**: jsPDF for compliance reports
- **Resume Parsing**: Google Gemini API integration

### Backend (Firebase)
- **Authentication**: Firebase Auth with Google Sign-In
- **Database**: Firestore for real-time data
- **Storage**: Cloud Storage for resume PDFs
- **Hosting**: Firebase Hosting

### AI/ML Services
- **Resume Parsing**: Gemini 1.5 Pro API
- **Bias Detection**: Statistical analysis + surrogate model
- **Remediation**: LLM-generated plain English summaries

## API Integration

### Gemini API Endpoints

**Parse Resume**
```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent
```

**Generate Bias Finding**
```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent
```

### Firestore Collections

```
organizations/
  {orgId}/
    ├── remediation_proposals/
    ├── compliance_reports/
    └── audit_history/

users/
  {userId}/
    └── profile/
```

## Configuration

### Firestore Security Rules

For production, implement proper security rules in Firebase Console:

```firebase-rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /organizations/{orgId}/{document=**} {
      allow read, write: if request.auth.uid == orgId;
    }
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### Environment Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| REACT_APP_FIREBASE_API_KEY | Firebase API key | AIzaSy... |
| REACT_APP_FIREBASE_PROJECT_ID | Firebase project ID | my-fairlens-app |
| REACT_APP_GEMINI_API_KEY | Google Gemini API key | AIzaSy... |

## Troubleshooting

### Firebase Connection Issues

```bash
# Verify Firebase configuration
firebase projects:list

# Check project status
firebase status

# Reinitialize Firebase
rm -rf .firebase .firebaserc
firebase init
```

### Resume Upload Issues

- Ensure Cloud Storage bucket is created in Firebase Console
- Check file size limits (Max 25MB)
- Verify CORS configuration for local development

### Gemini API Errors

- Verify API key is active in Google Cloud Console
- Check API quota and rate limits
- Ensure "Generative Language API" is enabled

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Performance Optimization

### Production Build Tips

1. **Enable gzip compression** in Firebase Hosting settings
2. **Optimize images** using tools like ImageOptim
3. **Lazy load components** using React.lazy()
4. **Monitor performance** with Firebase Analytics

### Bundle Size

```bash
# Analyze bundle size
npm install --save-dev source-map-explorer
npm run build
source-map-explorer 'build/static/js/*.js'
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and commit: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, feature requests, or questions:
- Create an issue on GitHub
- Email: support@fairlens.io
- Documentation: https://docs.fairlens.io

## Legal & Compliance

FairLens is compliant with:
- ✅ Digital Personal Data Protection Act 2023 (DPDPA)
- ✅ Indian Constitution (Articles 15 & 16)
- ✅ SC/ST Prevention of Atrocities Act 1989
- ✅ Companies Act Amendment 2023

**Disclaimer**: This tool is audit documentation generated by FairLens. It is not legal advice and does not constitute legal certification of compliance. A qualified legal professional must interpret specific liability.

## Roadmap

- [ ] ATS Integrations (Workday, Zoho, Keka)
- [ ] Push Notifications (Firebase Cloud Messaging)
- [ ] Regional Language Support (Hindi, Tamil, Telugu)
- [ ] WhatsApp Alert Notifications
- [ ] EU AI Act Compliance Mapping
- [ ] API for programmatic access
- [ ] Multi-tenant support

---

**Made with ❤️ for fair hiring in India**
