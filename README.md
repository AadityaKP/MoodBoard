# 🎵 MoodBoard - Music Mood Tracking Application

A comprehensive music mood tracking application that analyzes your music listening patterns and provides insights into your emotional states using machine learning and Spotify integration.

## 🌟 Features

- **Real-time Mood Analysis**: AI-powered mood classification of songs
- **Spotify Integration**: Seamless music playback and analysis
- **Interactive Dashboard**: Beautiful 5-column layout with mood tracking
- **Weekly Trends**: Visual charts showing mood patterns over time
- **Calendar Integration**: Monthly mood tracking and reflections
- **Music Player**: Built-in player with mood analysis
- **Insights Engine**: AI-powered recommendations and insights

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Python (v3.8+)
- FFmpeg (for audio processing)
- Spotify Developer Account

### Installation

1. **Clone or extract this package**
2. **Run the quick start script** (Windows):
   ```bash
   quick-start.bat
   ```
   
   Or manually install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   - Copy `env-template.txt` to `.env`
   - Add your Spotify API credentials

4. **Start all services**:
   ```bash
   start-all-services.bat
   ```
   
   Or start manually:
   ```bash
   # Terminal 1: Backend server
   node server.js
   
   # Terminal 2: Frontend dev server
   npm run dev
   
   # Terminal 3: ML API server
   python ML/ml_api.py
   ```

5. **Open your browser** to `http://localhost:5173` (frontend) or `http://localhost:3000` (backend)

## 📁 Project Structure

```
MoodBoard-Project-Package/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── pages/             # Page components
│   ├── services/          # API services
│   └── hooks/             # Custom hooks
├── ML/                    # Machine learning
│   ├── ml_api.py          # ML API server
│   ├── song_mood_classifier.py
│   └── song_mood_xgb_model_updated.pkl
├── CSVS/                  # Data files
├── UserPlaylist/          # Demo music files
├── public/                # Static assets
├── server.js              # Express backend
├── requirements.txt       # Python dependencies
└── SETUP_INSTRUCTIONS.md  # Detailed setup guide
```

## 🎯 Key Components

### Frontend (React + TypeScript)
- **Dashboard**: Unified mood tracking interface
- **Music Player**: Spotify-integrated player
- **Charts**: Recharts-based visualizations
- **Calendar**: Monthly mood tracking
- **UI Components**: Shadcn/ui component library

### Backend (Node.js + Express)
- **RESTful API**: Data endpoints
- **Spotify Integration**: OAuth and playback control
- **File Management**: CSV data persistence
- **CORS Support**: Cross-origin requests

### Machine Learning (Python)
- **XGBoost Model**: Song mood classification
- **Audio Analysis**: FFmpeg-based feature extraction
- **Real-time Processing**: Live mood analysis
- **Flask API**: ML model serving

## 🔧 Configuration

### Environment Variables
Create a `.env` file with:
```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
PORT=3000
NODE_ENV=development
```

### Spotify API Setup
1. Visit [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Get Client ID and Secret
4. Add redirect URI: `http://localhost:3000/callback`

## 📊 Data Management

The application uses CSV files for data storage:
- `listening_history.csv`: Music listening history
- `song_mood.csv`: Pre-classified song moods
- `user_mood.csv`: User mood entries
- `song_chunk_analysis.csv`: Audio analysis data

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop and mobile
- **Dark/Light Mode**: Theme switching support
- **Real-time Updates**: Live data synchronization
- **Interactive Charts**: Hover effects and animations
- **Accessibility**: ARIA labels and keyboard navigation

## 🔒 Security

- Environment variable protection
- CORS configuration
- Secure API key management
- Input validation and sanitization

## 🐛 Troubleshooting

### Common Issues

1. **Spotify Authentication Fails**
   - Verify API credentials
   - Check redirect URI
   - Ensure app is in development mode

2. **ML Model Errors**
   - Install Python dependencies
   - Verify FFmpeg installation
   - Check model file exists

3. **Port Conflicts**
   - Change PORT in .env
   - Kill existing processes

### Debug Mode
Enable debug logging:
```env
DEBUG=true
NODE_ENV=development
```

## 📈 Performance

- **Caching**: Frequently accessed data
- **Optimization**: ML model inference speed
- **CDN Ready**: Static asset optimization
- **Database Indexing**: Large dataset support

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

- Check troubleshooting section
- Review setup instructions
- Create GitHub issue

---

**Made with ❤️ for music lovers everywhere**

*Track your mood, understand your music, discover yourself.*
