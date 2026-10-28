# NextVisit Desktop (Windows POS)

This directory contains the desktop application configuration for NextVisit POS powered by **Tauri v2** and the existing **React 19 + Vite** frontend.

---

## 1. Prerequisites (Windows)

To run or build the desktop application, ensure your Windows development environment has:

1. **Node.js & npm**:
   - Node.js $\ge$ 18.0 (Verified with v24)
   - npm $\ge$ 9.0

2. **Rust & Cargo**:
   - Current Rust Stable toolchain $\ge$ **1.85.0** (required by Tauri v2 transitive crates).
   - If Rust is already installed via `rustup`, update to the latest stable toolchain:
     ```powershell
     rustup update stable
     rustup default stable
     ```
   - Target: `x86_64-pc-windows-msvc`

3. **Microsoft C++ Build Tools**:
   - Visual Studio 2022 or "Build Tools for Visual Studio" with the **"Desktop development with C++"** workload selected.

4. **Microsoft Edge WebView2**:
   - Pre-installed on Windows 10 (1809+) and Windows 11.

---

## 2. Development Workflow

### Running the Desktop App Locally
1. Start the FastAPI backend server (in a separate terminal):
   ```powershell
   cd Backend
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. Start the Tauri Desktop App:
   ```powershell
   cd Frontend
   npm run desktop:dev
   ```
   *Note: This automatically runs `npm run dev` for Vite and opens the native Windows application window.*

### Running the Standard Web App (Unchanged)
The existing web app workflows are completely preserved:
```powershell
npm run dev        # Starts Vite web development server
npm run build      # Compiles production web bundle to dist/
npm run preview    # Previews production bundle
```

---

## 3. Building the Windows Production Installer

To produce a production `.msi` and `.exe` installer for Windows:

```powershell
cd Frontend
npm run desktop:build
```

The build command will:
1. Run `npm run build` to compile the optimized React production bundle into `Frontend/dist/`.
2. Compile the Rust backend with optimizations (`--release`).
3. Generate standalone Windows installers in:
   `Frontend/src-tauri/target/release/bundle/msi/`
   `Frontend/src-tauri/target/release/bundle/nsis/`

---

## 4. Architecture & File Structure

```text
Frontend/
├── src-tauri/
│   ├── Cargo.toml               # Rust dependencies and package configuration
│   ├── build.rs                 # Tauri build hook
│   ├── tauri.conf.json          # Window configuration, bundle identifier, security
│   ├── capabilities/
│   │   └── default.json         # Tauri permissions and security capabilities
│   ├── icons/                   # POS application icons (ICO, PNG)
│   └── src/
│       ├── main.rs              # Windows entry point
│       └── lib.rs               # Tauri application builder & plugins
├── src/
│   ├── lib/
│   │   └── desktop.ts           # Runtime detection helper (isDesktopApp)
│   └── ...                      # Existing React 19 application
└── package.json                 # Desktop npm scripts (desktop:dev, desktop:build)
```
