# 09. Deployment Strategy

This document outlines the deployment architecture for MaxiDOM. It distinguishes between the **Component Deployment** (running the code) and the **Enterprise Policy Deployment** (forcing the extension onto devices).

---

### 1. Backend Deployment (The Server)

The backend is designed to run as a persistent service on the target machine (Self-Hosted) or a central server.

#### 1.1. Production WSGI/ASGI Setup
For production, we do not use the development reloader. We use **Gunicorn** (Linux) or a direct **Uvicorn** worker (Windows) managed by a supervisor.

**Command:**
```bash
# Workers = 4 processes for concurrency
gunicorn -w 4 -k uvicorn.workers.UvicornWorker api:app --bind 0.0.0.0:8000
```

#### 1.2. Windows Self-Hosting (Background Service)
For the specific use case of protecting a local Windows machine, the backend is deployed as a **Hidden Background Task** using the Windows Startup folder.

**Implementation Details:**
1.  **Virtual Environment**: A dedicated `.venv` is created to isolate dependencies.
2.  **VBScript Wrapper**: A `.vbs` script is used to launch the batch file with `WindowStyle 0` (Hidden) to prevent console popups.
3.  **Persistence**: A shortcut to the wrapper is placed in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`.

---

### 2. Frontend Deployment (The Extension)

In a production/enterprise environment, users do not manually install security tools. The extension is **packaged** and **force-installed** via Group Policy.

#### 2.1. Packaging
1.  **Packing**: The developer packs the `frontend/` folder using Chrome's "Pack Extension" utility.
2.  **Signing**: This generates a private key (`.pem`) and the installer (`.crx`).
3.  **Update Manifest**: An `update.xml` file is generated to map the Extension ID to the `.crx` file URL.

#### 2.2. Enterprise Policy Enforcement (Windows)
To prevent users from disabling the security system, MaxiDOM utilizes the Windows Registry to set the **`ExtensionInstallForcelist`** policy.

**Target**: `HKEY_LOCAL_MACHINE` (HKLM)
*Reason*: Writing to HKLM requires Administrator privileges, which signals to Chrome that the policy is a "Device Mandate" rather than a user preference.

**Registry Script (PowerShell):**
```powershell
$policyPath = "HKLM:\Software\Policies\Google\Chrome\ExtensionInstallForcelist"
# "1" = "EXTENSION_ID;UPDATE_XML_URL"
Set-ItemProperty -Path $policyPath -Name "1" -Value "abcdef...;http://localhost:8000/static/update.xml"
```

---

### 3. Deployment Limitations & Security Context

**Crucial Note for Defense:**

While the HKLM Registry strategy is the industry standard for Enterprise Deployment, Google Chrome enforces specific restrictions on **Consumer Windows Editions** (Home/Pro not joined to an Active Directory Domain).

| Environment            | Behavior                                  | Result                                                                                                       |
| :--------------------- | :---------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **Linux / Mac**        | Root access is the ultimate trust anchor. | **Success.** Policy is applied, extension is force-installed.                                                |
| **Windows Enterprise** | Domain Controller is the trust anchor.    | **Success.** Policy is applied via Group Policy Object (GPO).                                                |
| **Windows Consumer**   | No central trust anchor.                  | **Blocked.** Chrome ignores local HKLM force-install policies from custom URLs to prevent malware hijacking. |

**Mitigation for Capstone Demo:**
If demonstrating on a personal (non-domain) Windows laptop, the Extension Policy will show as "Ignored" in `chrome://policy`. This is **expected behavior** for a secure browser. For the purpose of the demo, the extension is loaded manually via "Developer Mode," which functionally replicates the technical architecture of the installed system.
