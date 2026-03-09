#!/bin/bash

echo "Fixing Railway Monitoring Client..."

cd client

# Remove old installations
echo "Removing old node_modules..."
rm -rf node_modules package-lock.json

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force

# Install dependencies
echo "Installing dependencies..."
npm install

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully!"
    echo "Starting the application..."
    npm start
else
    echo "Installation failed. Trying with yarn..."
    
    # Try with yarn
    npm install -g yarn
    yarn install
    yarn start
fi
