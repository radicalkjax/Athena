#!/bin/bash

# Run WASM Analysis Engine Benchmarks

echo "Installing benchmark dependencies..."
npm install

echo -e "\nRunning performance benchmarks..."
npm run bench

echo -e "\nBenchmark complete! Check the generated CSV file for detailed results."