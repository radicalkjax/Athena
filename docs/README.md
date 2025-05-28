# Athena Documentation Hub

Welcome to the comprehensive documentation for Athena, the AI-powered malware analysis platform. This hub provides easy navigation to all documentation sections.

## 🚀 Quick Start

**New to Athena? Start here:**

```mermaid
flowchart LR
    Start([New User]) --> Quick[📖 QUICKSTART.md<br/>━━━━━━━━<br/>Get running in<br/>2 minutes]
    
    Quick --> Setup[🔧 GETTING_STARTED.md<br/>━━━━━━━━<br/>Detailed setup<br/>and configuration]
    
    Setup --> User[👤 USER_GUIDE.md<br/>━━━━━━━━<br/>How to use<br/>all features]
    
    User --> Advanced[⚙️ Advanced Docs<br/>━━━━━━━━<br/>Architecture<br/>and development]
    
    style Start fill:#e1f5e1
    style Quick fill:#e1e5ff
    style Setup fill:#fff4e1
    style User fill:#e1f5e1
    style Advanced fill:#e1e5ff
```

## 📚 Documentation Map

### 🎯 Getting Started (Essential)
| Document | Purpose | Time | Audience |
|----------|---------|------|----------|
| [**QUICKSTART.md**](./QUICKSTART.md) | Get Athena running in 2 minutes | 5 min | Everyone |
| [**GETTING_STARTED.md**](./GETTING_STARTED.md) | Complete setup and configuration | 15 min | New users |
| [**USER_GUIDE.md**](./USER_GUIDE.md) | How to use all features | 30 min | End users |

### 🏗️ Architecture & Development  
| Document | Purpose | Audience |
|----------|---------|----------|
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | System architecture overview | Developers |
| [**API_INTEGRATION.md**](./API_INTEGRATION.md) | API integration patterns | Developers |
| [**CONTAINER_ISOLATION.md**](./CONTAINER_ISOLATION.md) | Security and isolation | DevOps/Security |

### 🔧 Technical Guides
| Document | Purpose | Audience |
|----------|---------|----------|
| [**API_CORS_HANDLING.md**](./API_CORS_HANDLING.md) | CORS configuration | Developers |
| [**TROUBLESHOOTING.md**](./TROUBLESHOOTING.md) | Common issues and solutions | Everyone |
| [**FONT_CONFIGURATION.md**](./FONT_CONFIGURATION.md) | Font setup and issues | Developers |

### 🧩 Component Documentation
| Component | Purpose |
|-----------|---------|
| [**AI_MODEL_SELECTOR.md**](./components/AI_MODEL_SELECTOR.md) | AI provider selection UI |
| [**ANALYSIS_OPTIONS_PANEL.md**](./components/ANALYSIS_OPTIONS_PANEL.md) | Analysis configuration UI |
| [**ANALYSIS_RESULTS.md**](./components/ANALYSIS_RESULTS.md) | Results display component |
| [**CONTAINER_CONFIG_SELECTOR.md**](./components/CONTAINER_CONFIG_SELECTOR.md) | Container settings UI |
| [**CONTAINER_MONITORING.md**](./components/CONTAINER_MONITORING.md) | Real-time monitoring UI |
| [**FILE_UPLOADER.md**](./components/FILE_UPLOADER.md) | File upload component |

### ⚡ Performance & Optimization
| Document | Purpose |
|----------|---------|
| [**ADAPTIVE_CIRCUIT_BREAKER.md**](./performance/ADAPTIVE_CIRCUIT_BREAKER.md) | Resilience patterns |
| [**BULKHEAD_PATTERN.md**](./performance/BULKHEAD_PATTERN.md) | Resource isolation |
| [**REDIS_CACHE_INTEGRATION.md**](./performance/REDIS_CACHE_INTEGRATION.md) | Distributed caching |
| [**APM_INTEGRATION.md**](./performance/APM_INTEGRATION.md) | Application monitoring |
| [**FEATURE_FLAGS.md**](./performance/FEATURE_FLAGS.md) | Runtime configuration |

### 🧪 Testing Documentation
| Document | Purpose |
|----------|---------|
| [**Testing README**](./testing/README.md) | Testing overview |
| [**Getting Started with Testing**](./testing/getting-started.md) | Test setup and execution |
| [**Testing Patterns**](./testing/patterns.md) | Best practices |
| [**API Testing**](./testing/api-testing.md) | API test strategies |
| [**Component Testing**](./testing/component-testing.md) | UI component tests |

## 🗺️ Navigation by Role

### 👨‍💻 **Developers**
```mermaid
flowchart TD
    Dev[Developer] --> Arch[ARCHITECTURE.md<br/>System Overview]
    Dev --> API[API_INTEGRATION.md<br/>Integration Patterns]
    Dev --> Test[testing/<br/>Testing Strategy]
    
    Arch --> Comp[components/<br/>UI Components]
    API --> Perf[performance/<br/>Optimization]
    Test --> Trouble[TROUBLESHOOTING.md<br/>Debug Issues]
    
    style Dev fill:#e1f5e1
    style Arch fill:#e1e5ff
    style API fill:#e1e5ff
    style Test fill:#e1e5ff
```

### 👨‍💼 **DevOps/Admins**
```mermaid
flowchart TD
    Admin[DevOps/Admin] --> Setup[GETTING_STARTED.md<br/>System Setup]
    Admin --> Container[CONTAINER_ISOLATION.md<br/>Security Config]
    Admin --> Perf[performance/<br/>Optimization]
    
    Setup --> Monitor[APM_INTEGRATION.md<br/>Monitoring]
    Container --> Cache[REDIS_CACHE_INTEGRATION.md<br/>Caching]
    Perf --> Trouble[TROUBLESHOOTING.md<br/>Issues]
    
    style Admin fill:#e1f5e1
    style Setup fill:#fff4e1
    style Container fill:#ffe4e1
    style Perf fill:#e1e5ff
```

### 👤 **End Users**
```mermaid
flowchart TD
    User[End User] --> Quick[QUICKSTART.md<br/>Quick Setup]
    Quick --> Guide[USER_GUIDE.md<br/>How to Use]
    Guide --> Trouble[TROUBLESHOOTING.md<br/>Common Issues]
    
    style User fill:#e1f5e1
    style Quick fill:#e1e5ff
    style Guide fill:#e1f5e1
    style Trouble fill:#fff4e1
```

## 🎨 Documentation Legend

### 📊 Diagram Types
- **🔄 Flowcharts**: Process flows and decision trees
- **🎯 Sequence Diagrams**: Step-by-step interactions
- **🏗️ Architecture Diagrams**: System structure and relationships
- **📈 State Diagrams**: Component states and transitions
- **🎨 UI Mockups**: Visual component representations

### 🏷️ Color Coding
- 🟢 **Green (`fill:#e1f5e1`)**: Success, completion, ready states
- 🔵 **Blue (`fill:#e1e5ff`)**: Information, neutral processes  
- 🟡 **Yellow (`fill:#fff4e1`)**: Warnings, attention needed
- 🔴 **Red (`fill:#ffe4e1`)**: Errors, critical issues

### 📝 Document Types
- **📖 Guides**: Step-by-step instructions
- **📋 Reference**: Technical specifications
- **🔧 Troubleshooting**: Problem resolution
- **🏗️ Architecture**: System design
- **🧩 Components**: UI element documentation

## 🚀 Common Workflows

### 🆕 First Time Setup
1. [QUICKSTART.md](./QUICKSTART.md) - Get running quickly
2. Run `/scripts/athena` → Option 2 (Check API Keys)  
3. [USER_GUIDE.md](./USER_GUIDE.md) - Learn to use features

### 🐛 Troubleshooting Issues
1. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Find your issue category
2. Follow the visual decision trees
3. Check specific component docs if UI-related
4. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system issues

### 🔧 Development Setup
1. [GETTING_STARTED.md](./GETTING_STARTED.md) - Complete setup
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
3. [testing/getting-started.md](./testing/getting-started.md) - Setup tests
4. Component docs for UI work

### ⚡ Performance Optimization  
1. [performance/](./performance/) - Review all performance docs
2. [APM_INTEGRATION.md](./performance/APM_INTEGRATION.md) - Setup monitoring
3. [REDIS_CACHE_INTEGRATION.md](./performance/REDIS_CACHE_INTEGRATION.md) - Optimize caching

## 🔍 Quick Search

**Looking for specific topics?**
- **API Keys**: [GETTING_STARTED.md](./GETTING_STARTED.md#configure-api-keys)
- **Container Setup**: [CONTAINER_ISOLATION.md](./CONTAINER_ISOLATION.md)
- **Error Messages**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Performance Issues**: [performance/](./performance/)
- **Testing**: [testing/](./testing/)
- **UI Components**: [components/](./components/)

## 📱 Interactive CLI Reference

The new Athena CLI (`/scripts/athena`) provides a beautiful interactive menu:

```bash
/scripts/athena
```

**Main Options:**
- **🚀 Option 1**: Start Athena Web (most common)
- **🔑 Option 2**: Check API Keys  
- **📦 Option 3**: Update Everything
- **🔧 Option 7**: Run Setup
- **🧪 Option 11**: Run All Tests

---

**💡 Tip**: Each document includes visual diagrams and cross-references to related documentation. Use the navigation maps above to find exactly what you need!