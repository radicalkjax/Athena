# Installing k6 Load Testing Tool

## Quick Installation

### macOS
```bash
brew install k6
```

### Ubuntu/Debian
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Windows
```powershell
choco install k6
```

### Docker (No installation needed)
```bash
docker pull grafana/k6
docker run --rm -i grafana/k6 run - <script.js
```

## Verify Installation
```bash
k6 version
```

## VSCode Extension
Install the k6 extension for syntax highlighting and IntelliSense:
- Extension ID: `k6.k6`

## Additional Tools

### k6-to-html (Optional)
For generating HTML reports:
```bash
go install github.com/benc-uk/k6-to-html@latest
```

## Documentation
- Official Docs: https://k6.io/docs/
- JavaScript API: https://k6.io/docs/javascript-api/