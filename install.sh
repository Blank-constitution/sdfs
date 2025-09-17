#!/bin/bash

echo "===== Installing Digital Monk Trading System ====="
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python is not installed! Please install Python 3.8 or higher."
    echo "Download from: https://www.python.org/downloads/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed! Please install Node.js 16 or higher."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

echo "Installing Python dependencies..."
pip3 install -r requirements.txt

echo "Installing Node.js dependencies..."
npm install

echo
echo "===== Installation Complete! ====="
echo
echo "To start the application:"
echo "1. Start the Python backend: python3 main.py"
echo "2. Start the React frontend: npm start"
echo
echo "Enjoy trading with Digital Monk!"
