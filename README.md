# 🌱 Renewable Energy Investment Planner

A comprehensive web application that analyzes renewable energy investment opportunities across different global locations. The platform evaluates solar and wind potential, political stability, embassy presence, and economic factors to provide investment scores and recommendations.

![Renewable Energy Investment Planner](https://img.shields.io/badge/Status-Live-green)
![Node.js](https://img.shields.io/badge/Node.js-18+-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-green)
![License](https://img.shields.io/badge/License-ISC-yellow)

## ✨ Features

### 🔍 Investment Analysis
- **Multi-factor Scoring Algorithm**: Evaluates solar potential, wind speed, political stability, and embassy presence
- **Real-time Data Integration**: Fetches live weather data, solar potential, and political information
- **Risk Assessment**: Analyzes political stability and diplomatic presence for investment security
- **Regional Weighting**: Dynamic scoring based on geographic and economic factors

### 🌍 Global Coverage
- **Multiple Countries**: Pre-configured analysis for US, Germany, India, Sri Lanka, and Brazil
- **Weather Integration**: Real-time wind speed and cloud coverage data
- **Solar Potential**: Integration with Global Solar Atlas for accurate solar energy calculations
- **Political Data**: World Bank political stability indicators

### 💼 Investment Management
- **Portfolio Tracking**: Save and manage investment analysis history
- **Score Visualization**: Color-coded scoring system (0-100 scale)
- **Detailed Reports**: Comprehensive analysis with multiple data points
- **Export Functionality**: Save analysis results for future reference

### 🎨 User Experience
- **Dark/Light Theme**: Toggle between themes for comfortable viewing
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: Live data fetching with loading indicators
- **Intuitive Interface**: Clean, modern design with clear data visualization

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- API keys for external services (see setup section)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/re-invest-planner.git
   cd re-invest-planner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your API keys:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/re-invest-planner
   
   # API Keys (Required)
   OPENWEATHERMAP_KEY=your_openweathermap_api_key_here
   EXCHANGERATE_KEY=your_exchangerate_api_key_here
   TRAVELINFO_KEY=your_travelinfo_api_key_here
   
   # Global Solar Atlas (Optional)
   GSA_LTA_URL=https://api.globalsolaratlas.info/data/lta
   
   # Server Configuration
   PORT=3001
   ```

4. **Start MongoDB**
   ```bash
   # On Windows
   net start MongoDB
   
   # On macOS/Linux
   sudo systemctl start mongod
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Open your browser**
   Navigate to `http://localhost:3001`

## 🔑 API Keys Setup

### Required API Keys

#### 1. OpenWeatherMap API
- **Purpose**: Weather data (wind speed, cloud coverage)
- **Sign up**: [OpenWeatherMap](https://openweathermap.org/api)
- **Free tier**: 1,000 calls/day
- **Environment variable**: `OPENWEATHERMAP_KEY`

#### 2. Exchange Rate API
- **Purpose**: Currency conversion rates
- **Sign up**: [ExchangeRate-API](https://www.exchangerate-api.com/)
- **Free tier**: 1,500 requests/month
- **Environment variable**: `EXCHANGERATE_KEY`

#### 3. Travel Info API
- **Purpose**: Embassy count data
- **Sign up**: [RapidAPI Travel Info](https://rapidapi.com/travelinfo/api/travel-info)
- **Free tier**: 100 requests/month
- **Environment variable**: `TRAVELINFO_KEY`

## 🏗️ Project Structure

```
re-invest-planner/
├── client/                 # Frontend application
│   ├── index.html         # Main HTML file
│   └── app.js            # Frontend JavaScript
├── server/                # Backend application
│   ├── index.js          # Main server file
│   ├── db.js             # Database connection
│   ├── middleware/       # Authentication middleware
│   │   ├── apiKey.js     # API key authentication
│   │   └── googleAuth.js # Google OAuth2
│   └── models/           # Database models
│       └── Record.js     # Investment record model
├── package.json          # Dependencies and scripts
├── SETUP.md             # Detailed setup guide
└── README.md            # This file
```

## 🔧 API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /api/score` - Investment analysis
- `GET /api/country/:name` - Country information
- `GET /api/weather/:city` - Weather data
- `GET /api/solar` - Solar potential data
- `GET /api/political/:code` - Political stability
- `GET /api/embassies/:src/:dest` - Embassy information

### Protected Endpoints (Require API Key)
- `POST /records` - Save investment analysis
- `GET /records` - Retrieve saved analyses
- `GET /records-secure` - Secure records (Google OAuth2)

## 📊 Scoring Algorithm

The application uses a sophisticated multi-factor scoring system:

### Energy Potential (0-100)
- **Solar Score**: Based on kWh/m²/day from Global Solar Atlas
- **Wind Score**: Based on wind speed (m/s) with 15 m/s as maximum
- **Cloud Penalty**: Reduces score based on cloud coverage percentage

### Risk Assessment (0-100)
- **Political Stability**: World Bank PV.EST indicator
- **Embassy Presence**: Number of diplomatic missions
- **Risk Categories**: Low, Medium, High, Extreme

### Final Score Calculation
```
Final Score = (Solar Score × Solar Weight) + (Wind Score × Wind Weight) - (Risk Score × Risk Weight)
```

### Regional Weights
- **Solar-heavy regions**: Africa, South America, South Asia (60% solar, 30% wind)
- **Wind-heavy regions**: Northern Europe, North America (30% solar, 60% wind)
- **Balanced regions**: Default (50% solar, 40% wind)

## 🎯 Usage Examples

### Analyze Investment Opportunity
1. Select a country/city from the dropdown
2. Click "Analyze Location"
3. Review the generated scores and recommendations
4. Save the analysis to your portfolio

### View Investment History
- Access the "Investment History" section
- View previously saved analyses
- Compare different locations and scores

### API Integration
```javascript
// Fetch investment analysis
const response = await fetch('/api/score?country=United%20States&city=New%20York');
const data = await response.json();

// Save analysis
await fetch('/records', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    country: data.country,
    score: data.score,
    data: data
  })
});
```

## 🛠️ Development

### Running in Development Mode
```bash
# Start server with auto-reload
npm run dev

# Start client development server
cd client
python -m http.server 8080
```

### Environment Variables for Development
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/re-invest-planner-dev
```

### Testing
```bash
# Run tests (when implemented)
npm test

# Test API endpoints
curl http://localhost:3001/health
curl "http://localhost:3001/api/score?country=United%20States&city=New%20York"
```

## 🚀 Deployment

### Production Environment Variables
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://your-production-mongodb-uri
OPENWEATHERMAP_KEY=your-production-key
EXCHANGERATE_KEY=your-production-key
TRAVELINFO_KEY=your-production-key
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex algorithms
- Update documentation for new features
- Test all API endpoints before submitting

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenWeatherMap](https://openweathermap.org/) for weather data
- [Global Solar Atlas](https://globalsolaratlas.info/) for solar potential data
- [World Bank](https://data.worldbank.org/) for political stability indicators
- [REST Countries](https://restcountries.com/) for country information
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Font Awesome](https://fontawesome.com/) for icons

## 📞 Support

If you encounter any issues or have questions:

1. Check the [SETUP.md](SETUP.md) file for troubleshooting
2. Review the [Issues](https://github.com/sanjula77/re-invest-planner/issues) page
3. Create a new issue with detailed information
4. Contact: sanjulagihan94@gmail.com

## 🔮 Roadmap

### Upcoming Features
- [ ] Additional countries and regions
- [ ] Advanced portfolio analytics
- [ ] Export to PDF/Excel functionality
- [ ] Real-time notifications for score changes
- [ ] Mobile application
- [ ] Machine learning predictions
- [ ] Social sharing features
- [ ] Multi-language support

### Version History
- **v1.0.0** - Initial release with core functionality
- **v1.1.0** - Added wind score calculation fix
- **v1.2.0** - Enhanced UI and dark mode support

---

**Made with ❤️ for sustainable energy investment planning**