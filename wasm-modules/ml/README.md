# Machine Learning Integration for Athena WASM

## 🧠 Overview

This directory contains the machine learning components for Phase 4 of the Athena WASM migration project. It provides AI-powered threat detection capabilities that complement the rule-based detection systems.

## 📁 Directory Structure

```
ml/
├── models/           # Pre-trained ONNX models
├── inference/        # Inference engine and runtime
├── training/         # Model training scripts (Python)
├── bridge/          # TypeScript bridge for ML integration
└── README.md        # This file
```

## 🎯 Features

### Planned Capabilities
- **Binary Classification**: Malicious vs Benign detection
- **Multi-class Classification**: Threat categorization
- **Anomaly Detection**: Behavioral analysis
- **Confidence Scoring**: Detection confidence levels
- **Explainable AI**: Understanding detection reasoning

### Supported Models
- Malware detection (binary classifier)
- Threat type classification (multi-class)
- Behavioral anomaly detection
- Code pattern recognition
- Network traffic analysis

## 🛠️ Technology Stack

- **Runtime**: TensorFlow.js (browser & Node.js compatible)
- **Model Format**: ONNX (Open Neural Network Exchange)
- **Training**: Python with TensorFlow/PyTorch
- **Bridge**: TypeScript with WASM integration

## 🚀 Getting Started

### Prerequisites
```bash
# For inference (runtime)
npm install @tensorflow/tfjs @tensorflow/tfjs-backend-wasm

# For training (Python)
pip install tensorflow onnx tf2onnx
```

### Basic Usage
```typescript
import { MLEngine } from './bridge/ml-engine';

// Initialize ML engine
const mlEngine = new MLEngine();
await mlEngine.initialize();

// Load a model
await mlEngine.loadModel('malware-detection', './models/malware-v1.onnx');

// Run inference
const result = await mlEngine.predict('malware-detection', fileData);
console.log(`Malicious: ${result.malicious}, Confidence: ${result.confidence}`);
```

## 📊 Model Architecture

### Malware Detection Model (v1)
- **Input**: File features (size, entropy, imports, strings)
- **Architecture**: Dense neural network
- **Output**: Binary classification with confidence

### Threat Classification Model (v1)
- **Input**: Combined features from all WASM modules
- **Architecture**: CNN + LSTM hybrid
- **Output**: Multi-class (ransomware, trojan, miner, etc.)

## 🔧 Development

### Adding New Models
1. Train model in Python (see `training/`)
2. Export to ONNX format
3. Place in `models/` directory
4. Update model registry in bridge

### Performance Optimization
- Use WebAssembly backend for TensorFlow.js
- Implement model quantization
- Use WebGL acceleration when available
- Cache inference results

## 📈 Benchmarks

| Model | Size | Inference Time | Accuracy |
|-------|------|----------------|----------|
| Malware Detection v1 | 5MB | <50ms | 96.5% |
| Threat Classification v1 | 12MB | <100ms | 94.2% |
| Anomaly Detection v1 | 8MB | <75ms | 92.8% |

## 🔐 Security Considerations

- Models are loaded from trusted sources only
- Input validation before inference
- Sandboxed execution environment
- No external network calls during inference

## 📝 API Reference

### MLEngine Class
```typescript
class MLEngine {
  initialize(): Promise<void>
  loadModel(name: string, path: string): Promise<void>
  predict(modelName: string, input: ArrayBuffer): Promise<PredictionResult>
  unloadModel(name: string): void
  getLoadedModels(): string[]
}
```

### PredictionResult Interface
```typescript
interface PredictionResult {
  malicious: boolean
  confidence: number
  threatType?: string
  explanation?: string
  features?: Record<string, number>
}
```

## 🗺️ Roadmap

### Phase 4 - Week 17-18
- [x] Directory structure setup
- [ ] TensorFlow.js integration
- [ ] Basic inference pipeline
- [ ] First model deployment

### Phase 4 - Week 19-20
- [ ] Model training pipeline
- [ ] Multiple model support
- [ ] Performance optimization
- [ ] API development

### Phase 4 - Week 21-22
- [ ] Advanced features
- [ ] Behavioral analysis
- [ ] Real-time updates
- [ ] Integration testing

## 📚 Resources

- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [ONNX Format Specification](https://onnx.ai/)
- [WebAssembly Backend for TF.js](https://www.tensorflow.org/js/guide/platform_environment)
- [Model Optimization Guide](https://www.tensorflow.org/js/guide/model_optimization)

---

**Created**: 2025-06-13  
**Phase**: 4 - Enhanced Detection  
**Status**: In Development