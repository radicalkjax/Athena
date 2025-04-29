# Getting Started with Athena

> **IMPORTANT DISCLAIMER:** The containerization and analysis components described in this documentation are still being designed and developed. Their current implementation and documentation are not reflective of what the final design could be. This documentation represents a conceptual overview and may change significantly as development progresses.

This guide will help you set up and start using Athena, the AI-powered malware analysis assistant. It provides step-by-step instructions for installation, configuration, and basic usage.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Athena](#running-athena)
- [Your First Analysis](#your-first-analysis)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or later): [Download from nodejs.org](https://nodejs.org/)
- **npm** (v8 or later): Included with Node.js
- **Git**: [Download from git-scm.com](https://git-scm.com/downloads)
- **Docker** and **Docker Compose** (for database setup): [Download from docker.com](https://www.docker.com/products/docker-desktop/)
- **PostgreSQL** (optional, if not using Docker): [Download from postgresql.org](https://www.postgresql.org/download/)

You'll also need API keys for the AI models you want to use:

- **OpenAI API key**: [Get from OpenAI Platform](https://platform.openai.com/account/api-keys)
- **Claude API key**: [Get from Anthropic Console](https://console.anthropic.com/account/keys)
- **DeepSeek API key**: [Get from DeepSeek Platform](https://platform.deepseek.com/)

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/athena.git
cd athena
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all the necessary dependencies for Athena, including React Native, Expo, and other required packages.

### Step 3: Create Environment File

Create a `.env` file in the Athena directory to store your API keys:

```bash
touch Athena/.env
```

Open the `.env` file in your favorite text editor and add your API keys:

```
# API Keys for AI Models
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional: Override API Base URLs if needed
# OPENAI_API_BASE_URL=https://api.openai.com/v1
# CLAUDE_API_BASE_URL=https://api.anthropic.com/v1
# DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
```

You can also use the provided `.env.example` file as a template:

```bash
cp Athena/.env.example Athena/.env
```

Then edit the `.env` file to add your API keys.

## Configuration

### API Keys

You can configure API keys in two ways:

1. **Environment Variables**: As described above, you can add your API keys to the `.env` file.
2. **Settings Screen**: You can also add your API keys through the Settings screen in the application.

### Container Configuration (Optional)

If you want to use the container isolation feature for safer malware analysis, you'll need to set up a container service. This is optional but recommended for analyzing potentially harmful files.

1. Install Docker: [Get Docker](https://docs.docker.com/get-docker/)
2. Configure the container service in the Settings screen

## Running Athena

### Web Version (Recommended for Development)

To run Athena as a web application:

```bash
cd Athena
npx serve dist
```

This will serve the built app from the dist directory using a static file server. Open your web browser and navigate to `http://localhost:3000` to access Athena.

### Mobile Version (Currently Not Working)

> **Important:** The Expo launch method is currently not working. Please use the web version with `npx serve dist` instead.

When working, to run Athena on a mobile device using Expo Go:

1. Install the Expo Go app on your device:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Android Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Start the Expo development server:
   ```bash
   cd Athena
   npx expo start
   ```

3. Scan the QR code displayed in the terminal with your device:
   - iOS: Use the device's camera
   - Android: Use the Expo Go app's QR code scanner

The app would then load on your device.

## Your First Analysis

Let's walk through a basic malware analysis using Athena:

### Step 1: Configure API Keys

1. Open Athena in your browser or on your mobile device
2. Navigate to the Settings screen (click the gear icon in the tab bar)
3. Enter your API keys in the respective fields
4. Click the "Save" button next to each field
5. Verify that the keys are saved by clicking the "Check" button

### Step 2: Upload a File

1. Navigate to the Home screen
2. In the "Uploaded Files" section, click the "Upload" button
3. Select a file to analyze (for testing, you can use a simple script file)
4. The file will appear in the list of uploaded files
5. Click on the file to select it for analysis

### Step 3: Select an AI Model

1. In the "Select AI Model" section, you'll see a list of available AI models
2. Click on a model to select it (e.g., OpenAI GPT-4)

### Step 4: Run Analysis

1. (Optional) Configure analysis options:
   - Use Container: Toggle this option to run the analysis in an isolated container
2. Click the "Analyze" button
3. Wait for the analysis to complete (this may take some time depending on the file size and complexity)

### Step 5: View Results

Once the analysis is complete, you'll see the results in the "Analysis Results" section:

1. **Deobfuscated Code**: Shows the cleaned, readable version of the code
2. **Analysis Report**: Provides a detailed report of the analysis findings
3. **Vulnerabilities**: Lists detected vulnerabilities with severity ratings and details

## Troubleshooting

### API Key Issues

**Problem**: The AI models are not showing up in the selector.

**Solution**:
1. Go to the Settings screen
2. Check if your API keys are entered correctly
3. Click the "Check" button next to each API key to verify it's working
4. If the keys are not working, try re-entering them
5. Make sure you're connected to the internet

### File Upload Issues

**Problem**: Unable to upload files.

**Solution**:
1. Make sure the file is accessible on your device
2. Check if the file size is reasonable (very large files may cause issues)
3. Try a different file format
4. If using the web version, try a different browser

### Analysis Issues

**Problem**: Analysis fails or takes too long.

**Solution**:
1. Check your internet connection
2. Try a smaller or less complex file
3. Try a different AI model
4. If using container analysis, try disabling it
5. Check the console for error messages (if you're familiar with developer tools)

## Helper Scripts

Athena comes with several helper scripts to make it easier to set up and run the application. These scripts are located in the `scripts` directory.

### Setup Script

The setup script helps with the initial setup of Athena. It checks for required dependencies, installs npm packages, and creates a `.env` file if one doesn't exist.

```bash
# Make the script executable
chmod +x scripts/setup.sh

# Run the setup script
./scripts/setup.sh
```

### API Key Validation Script

The API key validation script checks if your API keys for OpenAI, Claude, and DeepSeek are valid. It makes test requests to each API and provides a summary of the results.

```bash
# Make the script executable
chmod +x scripts/check-api-keys.js

# Run the API key validation script
node scripts/check-api-keys.js
```

This script will:
1. Check if your API keys are present in the `.env` file
2. Validate each API key by making a test request
3. Allow you to update invalid or missing API keys
4. Provide a summary of which AI models you can use

### Run Script

The run script helps you run Athena in different modes (web, iOS, Android, or Expo).

```bash
# Make the script executable
chmod +x scripts/run.sh

# Run Athena in web mode (default)
./scripts/run.sh

# Run Athena in iOS mode (requires macOS)
./scripts/run.sh ios

# Run Athena in Android mode
./scripts/run.sh android

# Run Athena using Expo
./scripts/run.sh expo

# Show help
./scripts/run.sh help
```

## Database Setup

Athena uses PostgreSQL for persistent storage of container configurations, monitoring data, and analysis results. You can set up the database using Docker Compose or connect to an existing PostgreSQL server.

### Using Docker Compose (Recommended)

The easiest way to set up the PostgreSQL database is using Docker Compose:

```bash
# Make the setup script executable
chmod +x Athena/scripts/setup-db.sh

# Run the setup script
./Athena/scripts/setup-db.sh
```

This script will:
1. Check if Docker and Docker Compose are installed
2. Create a `.env` file from `.env.example` if it doesn't exist
3. Start the PostgreSQL and pgAdmin containers
4. Create the database
5. Initialize the database schema
6. Run a test to verify the setup
7. Display connection information

You can also manually start the database containers:

```bash
cd Athena
docker-compose up -d
```

This will start:
- A PostgreSQL container with the configuration from your `.env` file
- A pgAdmin container for database management

You can access pgAdmin at http://localhost:5050 (or the port specified in your `.env` file) with the credentials from your `.env` file.

### Using an Existing PostgreSQL Server

If you already have PostgreSQL installed or prefer not to use Docker:

1. Update your `.env` file with your PostgreSQL connection details:

```
DB_HOST=your_postgres_host
DB_PORT=your_postgres_port
DB_NAME=athena_db
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
```

2. Create and initialize the database:

```bash
# Create the database
npm run db:create

# Initialize the database schema
npm run init-db
```

### Verifying the Database Setup

To verify that the database is set up correctly:

```bash
# Run the database test script
npm run db:test
```

This script will:
- Initialize the database
- Create container configurations for Windows, Linux, and macOS
- Create container instances for each OS
- Retrieve and display all container configurations and instances

## Next Steps

Now that you've set up Athena and performed your first analysis, here are some next steps to explore:

1. **Try Different AI Models**: Experiment with different AI models to see which ones work best for your specific use cases
2. **Explore Container Isolation**: If you're analyzing potentially harmful files, set up and use the container isolation feature
3. **Set Up Container Monitoring**: Configure the container monitoring system to track container activity during analysis
4. **Integrate with Metasploit**: If you're using Metasploit for vulnerability research, configure the Metasploit integration
5. **Learn More**: Check out the other documentation files to learn more about Athena's architecture and components:
   - [Architecture Documentation](./ARCHITECTURE.md)
   - [API Integration](./API_INTEGRATION.md)
   - [Container Isolation](./CONTAINER_ISOLATION.md)
   - [Database Setup](../Athena/docs/DATABASE_SETUP.md)
   - [Container Monitoring](../Athena/docs/CONTAINER_MONITORING.md)
   - [Component Documentation](./components/)
