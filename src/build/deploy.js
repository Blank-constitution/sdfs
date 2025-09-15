const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Setup interactive CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Deployment configuration
let config = {
  appName: 'TradingBot',
  deploymentType: 'local', // local, docker, aws, azure
  buildType: 'development', // development, production
  saveApiKeys: false,
  autoStart: false
};

// Main deployment function
async function deployApp() {
  console.log('🤖 Trading Bot Deployment Wizard 🧙‍♂️\n');
  
  // Step 1: Setup configuration
  await setupConfiguration();
  
  // Step 2: Build the app
  await buildApp();
  
  // Step 3: Package the app
  await packageApp();
  
  // Step 4: Deploy the app
  await deployAppToTarget();
  
  // Step 5: Setup monitoring
  await setupMonitoring();
  
  console.log('\n✅ Deployment complete!');
  if (config.deploymentType === 'local') {
    console.log(`\nYour app is available at: ${path.resolve('./dist')}`);
    console.log('To start the app, run: npm run start:prod');
  } else if (config.deploymentType === 'docker') {
    console.log('\nYour Docker container is running!');
    console.log('To check status: docker ps');
  } else {
    console.log(`\nYour app is deployed to ${config.deploymentType.toUpperCase()}!`);
  }
  
  rl.close();
}

// Step 1: Setup configuration
async function setupConfiguration() {
  console.log('📝 STEP 1: Configuration Setup\n');
  
  config.appName = await askQuestion('Application name: ', 'TradingBot');
  
  const deployOptions = ['local', 'docker', 'aws', 'azure'];
  const deployType = await askQuestion(`Deployment target (${deployOptions.join('/')}): `, 'local');
  if (deployOptions.includes(deployType.toLowerCase())) {
    config.deploymentType = deployType.toLowerCase();
  }
  
  config.buildType = (await askQuestion('Build type (development/production): ', 'production')).toLowerCase();
  config.saveApiKeys = (await askQuestion('Save API keys in deployment? (yes/no): ', 'no')).toLowerCase() === 'yes';
  config.autoStart = (await askQuestion('Auto-start after deployment? (yes/no): ', 'yes')).toLowerCase() === 'yes';
  
  console.log('\nConfiguration Summary:');
  console.log(JSON.stringify(config, null, 2));
  const confirm = await askQuestion('\nConfirm configuration? (yes/no): ', 'yes');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Configuration canceled. Restarting setup...');
    await setupConfiguration();
  }
}

// Step 2: Build the app
async function buildApp() {
  console.log('\n🔨 STEP 2: Building Application\n');
  
  console.log('Installing dependencies...');
  execCommand('npm install');
  
  console.log('Building application...');
  if (config.buildType === 'production') {
    execCommand('npm run build');
  } else {
    execCommand('npm run build:dev');
  }
  
  console.log('Running tests...');
  try {
    execCommand('npm test');
  } catch (error) {
    const proceed = await askQuestion('Tests failed. Proceed anyway? (yes/no): ', 'no');
    if (proceed.toLowerCase() !== 'yes') {
      process.exit(1);
    }
  }
}

// Step 3: Package the app
async function packageApp() {
  console.log('\n📦 STEP 3: Packaging Application\n');
  
  if (config.deploymentType === 'local') {
    console.log('Creating executable...');
    execCommand('npx electron-builder');
    console.log('Executable created in ./dist directory');
  } else if (config.deploymentType === 'docker') {
    console.log('Building Docker image...');
    createDockerfile();
    execCommand(`docker build -t ${config.appName.toLowerCase()} .`);
  } else {
    console.log('Preparing deployment package...');
    execCommand('npm run build:deploy');
  }
}

// Step 4: Deploy the app
async function deployAppToTarget() {
  console.log('\n🚀 STEP 4: Deploying Application\n');
  
  if (config.deploymentType === 'local') {
    console.log('Local deployment - copying files to ./dist directory...');
    // Already done in packaging step
  } else if (config.deploymentType === 'docker') {
    console.log('Starting Docker container...');
    execCommand(`docker run -d -p 3000:3000 --name ${config.appName.toLowerCase()} ${config.appName.toLowerCase()}`);
  } else if (config.deploymentType === 'aws') {
    console.log('Deploying to AWS...');
    // Add AWS CLI commands here
    console.log('AWS deployment requires manual configuration. Please follow the steps at: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html');
  } else if (config.deploymentType === 'azure') {
    console.log('Deploying to Azure...');
    // Add Azure CLI commands here
    console.log('Azure deployment requires manual configuration. Please follow the steps at: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli');
  }
}

// Step 5: Setup monitoring
async function setupMonitoring() {
  console.log('\n📊 STEP 5: Setting Up Monitoring\n');
  
  const setupMonitoring = await askQuestion('Set up performance monitoring? (yes/no): ', 'yes');
  
  if (setupMonitoring.toLowerCase() === 'yes') {
    console.log('Setting up monitoring tools...');
    if (config.deploymentType === 'local') {
      createLocalMonitoringConfig();
    } else if (config.deploymentType === 'docker') {
      console.log('Adding Prometheus and Grafana to Docker setup...');
      // Add Docker monitoring setup
    } else {
      console.log(`Setting up cloud monitoring for ${config.deploymentType}...`);
      // Add cloud monitoring setup
    }
  }
}

// Helper functions
function askQuestion(question, defaultAnswer = '') {
  return new Promise(resolve => {
    rl.question(`${question}${defaultAnswer ? ` (${defaultAnswer})` : ''} `, answer => {
      resolve(answer || defaultAnswer);
    });
  });
}

function execCommand(command) {
  console.log(`> ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

function createDockerfile() {
  const dockerfileContent = `
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
  `.trim();
  
  fs.writeFileSync('./Dockerfile', dockerfileContent);
  console.log('Created Dockerfile');
}

function createLocalMonitoringConfig() {
  const monitorConfig = {
    performance: true,
    tradingMetrics: true,
    errorTracking: true,
    logRotation: true
  };
  
  fs.writeFileSync('./monitoring.json', JSON.stringify(monitorConfig, null, 2));
  console.log('Created monitoring configuration');
}

// Run the deployment process
deployApp().catch(console.error);
