# L1 Automation Deep Dive - Exide Industries Use Cases

## Overview
This document provides detailed technical analysis and implementation guidance for three critical L1 automation use cases identified by Exide Industries.

**Key Requirement**: AI must **execute fixes**, not provide instructions or KB articles.

---

## Use Case 1: Printer Configuration & Troubleshooting

### Problem Statement
Users face common printer issues that consume L1 agent time:
- Printer not detected/offline
- Print jobs stuck in queue
- Driver issues
- Network printer connectivity
- Print spooler errors

### User Journey

#### Current State (Manual L1)
1. User reports: "My printer is not working"
2. Agent asks: Which printer? What error?
3. Agent guides user through: Device Manager checks, driver reinstall, spooler restart
4. Time: 15-30 minutes
5. Success rate: ~70% (many escalations)

#### Target State (AI-Automated)
1. User: "My printer HP LaserJet 4050 is not printing"
2. AI Agent:
   - Detects device and OS
   - Runs diagnostics automatically
   - Identifies issue (e.g., spooler stuck)
   - Executes fix remotely
   - Confirms resolution
3. Time: 2-3 minutes
4. Success rate target: 85%+

### Technical Implementation

#### Step 1: Discovery & Diagnostics
```javascript
// Remote device discovery (requires agent on endpoint)
const printerDiagnostics = {
  // Check if printer is visible to OS
  checkPrinterVisibility: async (printerName) => {
    // Windows: Get-Printer PowerShell command
    // Execute: Get-Printer -Name "*LaserJet*" | Select-Object Name, DriverName, PortName, PrinterStatus
    return {
      found: true,
      status: "Offline", // Online, Offline, Error, PaperJam
      driverVersion: "6.3.9600.17415",
      portType: "TCP/IP", // USB, Network
      queueLength: 3
    };
  },

  // Check print spooler service
  checkSpoolerService: async () => {
    // Execute: Get-Service -Name Spooler
    return {
      status: "Running", // Running, Stopped, StartPending
      startType: "Automatic"
    };
  },

  // Check pending print jobs
  checkPrintQueue: async (printerName) => {
    // Execute: Get-PrintJob -PrinterName $printerName
    return {
      jobs: [
        { id: 1, status: "Error", document: "report.pdf", pages: 10 },
        { id: 2, status: "Paused", document: "invoice.xlsx", pages: 2 }
      ]
    };
  },

  // Network connectivity for network printers
  checkNetworkConnectivity: async (printerIP) => {
    // Execute: Test-Connection -ComputerName $printerIP -Count 2
    return {
      reachable: false,
      latency: null,
      error: "Destination host unreachable"
    };
  }
};
```

#### Step 2: Root Cause Analysis
```javascript
const analyzePrinterIssue = async (diagnostics) => {
  const issues = [];

  // Issue 1: Spooler stuck/stopped
  if (diagnostics.spooler.status !== "Running") {
    issues.push({
      type: "SPOOLER_STOPPED",
      severity: "HIGH",
      autoFixable: true
    });
  }

  // Issue 2: Print jobs stuck
  if (diagnostics.queue.jobs.some(j => j.status === "Error")) {
    issues.push({
      type: "STUCK_PRINT_JOBS",
      severity: "MEDIUM",
      autoFixable: true
    });
  }

  // Issue 3: Printer offline/not reachable
  if (!diagnostics.network.reachable) {
    issues.push({
      type: "NETWORK_UNREACHABLE",
      severity: "HIGH",
      autoFixable: false, // Requires physical intervention
      suggestedAction: "Check network cable, printer power, or contact network team"
    });
  }

  // Issue 4: Driver issue
  if (diagnostics.printer.status === "Error" && diagnostics.printer.driverVersion === "unknown") {
    issues.push({
      type: "DRIVER_MISSING",
      severity: "HIGH",
      autoFixable: true
    });
  }

  return issues;
};
```

#### Step 3: Automated Remediation
```javascript
const remediatePrinterIssue = async (issue, deviceId) => {
  switch (issue.type) {
    case "SPOOLER_STOPPED":
      // Restart print spooler service
      await executeRemoteCommand(deviceId, [
        "Stop-Service -Name Spooler -Force",
        "Clear-Content -Path 'C:\\Windows\\System32\\spool\\PRINTERS\\*' -Force", // Clear spool folder
        "Start-Service -Name Spooler"
      ]);
      return { success: true, message: "Print spooler restarted successfully" };

    case "STUCK_PRINT_JOBS":
      // Clear all stuck print jobs
      await executeRemoteCommand(deviceId, [
        "Get-PrintJob -PrinterName $printerName | Where-Object {$_.JobStatus -eq 'Error'} | Remove-PrintJob"
      ]);
      return { success: true, message: "Cleared stuck print jobs" };

    case "DRIVER_MISSING":
      // Install printer driver (requires driver package in repository)
      await executeRemoteCommand(deviceId, [
        "pnputil.exe /add-driver 'C:\\Drivers\\HP_LaserJet\\hplj4050.inf' /install"
      ]);
      return { success: true, message: "Printer driver installed" };

    case "PRINTER_OFFLINE":
      // Set printer online
      await executeRemoteCommand(deviceId, [
        "Set-Printer -Name '$printerName' -PrinterStatus 'Normal'"
      ]);
      return { success: true, message: "Printer set to online" };

    default:
      return { success: false, message: "Unable to auto-remediate this issue" };
  }
};
```

#### Step 4: Verification
```javascript
const verifyPrinterFix = async (printerName, deviceId) => {
  // Wait 5 seconds for services to stabilize
  await sleep(5000);

  // Re-run diagnostics
  const postFixDiagnostics = await printerDiagnostics.checkPrinterVisibility(printerName);

  if (postFixDiagnostics.status === "Online" && postFixDiagnostics.queueLength === 0) {
    return {
      success: true,
      message: "Printer is now operational. Please try printing a test page."
    };
  } else {
    return {
      success: false,
      message: "Issue partially resolved. Escalating to L2 support.",
      escalationReason: postFixDiagnostics.status
    };
  }
};
```

### Demo Scenarios

#### Scenario 1: Print Spooler Stuck
```
User: "My printer HP LaserJet 4050 in the Finance department is not printing"

AI Agent Response:
┌─────────────────────────────────────────────────────┐
│ 🔍 Diagnosing printer issue...                      │
│                                                     │
│ ✓ Printer detected: HP LaserJet 4050               │
│ ✓ Network connectivity: OK (192.168.10.45)         │
│ ✗ Print spooler: STOPPED                           │
│ ✗ Print queue: 3 stuck jobs                        │
│                                                     │
│ 🔧 Identified Issue:                                │
│ Print spooler service has stopped, causing jobs    │
│ to get stuck in the queue.                         │
│                                                     │
│ 🚀 Executing automated fix...                       │
│ • Stopping print spooler service                   │
│ • Clearing spool folder                            │
│ • Restarting print spooler service                 │
│ • Removing stuck print jobs                        │
│                                                     │
│ ✅ Fix Complete!                                     │
│ Your printer is now online. Please try printing.   │
│                                                     │
│ Time taken: 2 minutes 14 seconds                   │
│ No manual intervention required.                   │
└─────────────────────────────────────────────────────┘
```

#### Scenario 2: Network Printer Unreachable
```
User: "Can't print to the shared printer on Floor 3"

AI Agent Response:
┌─────────────────────────────────────────────────────┐
│ 🔍 Diagnosing network printer issue...              │
│                                                     │
│ ✓ Printer configured: Floor3-Canon-MX920           │
│ ✗ Network connectivity: FAILED                     │
│   IP: 192.168.10.125 (unreachable)                 │
│                                                     │
│ 🔧 Identified Issue:                                │
│ Printer is not reachable on the network.           │
│                                                     │
│ ⚠️  This requires physical check:                   │
│ 1. Verify printer is powered on                    │
│ 2. Check network cable connection                  │
│ 3. Check if printer displays any error             │
│                                                     │
│ 🎫 Creating ticket for on-site support...          │
│ Ticket #IT-2847 assigned to Floor 3 support team   │
│                                                     │
│ In the meantime, you can use:                      │
│ • Floor3-HP-OfficeJet (192.168.10.126) ✓ Online    │
└─────────────────────────────────────────────────────┘
```

---

## Use Case 2: System Performance Optimization (Cleanup Tasks)

### Problem Statement
Users experience slow system performance due to:
- Temp files accumulation (Windows Temp, Browser cache, Downloads)
- Unused applications consuming resources
- Disk space running low
- Background processes/startup items
- Memory-hogging applications

### User Journey

#### Current State (Manual L1)
1. User: "My laptop is running very slow"
2. Agent guides through: Disk Cleanup, Task Manager, Uninstall programs
3. User struggles with technical steps
4. Time: 30-45 minutes
5. Often requires remote session

#### Target State (AI-Automated)
1. User: "My laptop is slow"
2. AI runs performance scan
3. AI shows findings and gets approval
4. AI executes cleanup automatically
5. Time: 3-5 minutes

### Technical Implementation

#### Step 1: Performance Diagnostics
```javascript
const performanceDiagnostics = {
  // Check disk space
  checkDiskSpace: async () => {
    // Execute: Get-PSDrive C | Select-Object Used,Free
    return {
      drives: [
        {
          letter: "C:",
          totalGB: 512,
          usedGB: 487,
          freeGB: 25,
          percentFree: 4.9,
          status: "CRITICAL" // OK, WARNING, CRITICAL
        }
      ]
    };
  },

  // Check memory usage
  checkMemoryUsage: async () => {
    // Execute: Get-CimInstance Win32_OperatingSystem
    return {
      totalGB: 16,
      availableGB: 2.1,
      percentUsed: 86.9,
      status: "WARNING",
      topProcesses: [
        { name: "Chrome.exe", memoryMB: 2048, instances: 15 },
        { name: "Teams.exe", memoryMB: 1024, instances: 1 },
        { name: "Outlook.exe", memoryMB: 856, instances: 1 }
      ]
    };
  },

  // Check temp file accumulation
  checkTempFiles: async () => {
    // Check Windows Temp, Browser Cache, Downloads
    return {
      locations: [
        { path: "C:\\Windows\\Temp", sizeMB: 3450, fileCount: 1247 },
        { path: "C:\\Users\\username\\AppData\\Local\\Temp", sizeMB: 2100, fileCount: 856 },
        { path: "C:\\Users\\username\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache", sizeMB: 1850, fileCount: 4521 },
        { path: "C:\\Users\\username\\Downloads", sizeMB: 8750, fileCount: 234, oldFilesDays: 90 }
      ],
      totalReclaimableMB: 16150,
      totalReclaimableGB: 15.8
    };
  },

  // Check startup programs
  checkStartupPrograms: async () => {
    // Execute: Get-CimInstance Win32_StartupCommand
    return {
      programs: [
        { name: "Spotify", publisher: "Spotify AB", impact: "High", enabled: true },
        { name: "Skype", publisher: "Microsoft", impact: "Medium", enabled: true },
        { name: "Adobe Creative Cloud", publisher: "Adobe", impact: "High", enabled: true },
        { name: "OneDrive", publisher: "Microsoft", impact: "Low", enabled: true }
      ],
      recommendDisable: ["Spotify", "Skype"] // Non-essential high impact items
    };
  },

  // Check for unused applications
  checkUnusedApplications: async () => {
    // Cross-reference installed apps with usage logs
    return {
      unusedApps: [
        { name: "WinRAR", installDate: "2023-05-10", lastUsed: null, sizeMB: 4.5 },
        { name: "Java 8 Update 301", installDate: "2023-03-15", lastUsed: null, sizeMB: 152 },
        { name: "Old VPN Client", installDate: "2022-11-20", lastUsed: "2024-01-15", sizeMB: 85 }
      ]
    };
  },

  // CPU usage check
  checkCPUUsage: async () => {
    return {
      averageLoad: 78,
      status: "WARNING",
      topProcesses: [
        { name: "MsMpEng.exe", cpu: 35, description: "Windows Defender" },
        { name: "Chrome.exe", cpu: 25, description: "Google Chrome" }
      ]
    };
  }
};
```

#### Step 2: Generate Cleanup Plan
```javascript
const generateCleanupPlan = async (diagnostics) => {
  const plan = {
    estimatedTimeMinutes: 3,
    estimatedSpaceRecoveredGB: 0,
    actions: []
  };

  // Action 1: Temp files cleanup
  if (diagnostics.tempFiles.totalReclaimableGB > 1) {
    plan.actions.push({
      type: "CLEANUP_TEMP",
      description: "Remove temporary files and cache",
      impact: `Free up ${diagnostics.tempFiles.totalReclaimableGB.toFixed(1)} GB`,
      risk: "LOW",
      requiresApproval: false
    });
    plan.estimatedSpaceRecoveredGB += diagnostics.tempFiles.totalReclaimableGB;
  }

  // Action 2: Disable high-impact startup programs
  if (diagnostics.startup.recommendDisable.length > 0) {
    plan.actions.push({
      type: "DISABLE_STARTUP",
      description: `Disable ${diagnostics.startup.recommendDisable.length} non-essential startup programs`,
      impact: "Faster boot time, reduced memory usage",
      programs: diagnostics.startup.recommendDisable,
      risk: "LOW",
      requiresApproval: true // User should know what's being disabled
    });
  }

  // Action 3: Empty Recycle Bin
  plan.actions.push({
    type: "EMPTY_RECYCLE_BIN",
    description: "Empty Recycle Bin",
    impact: "Recover deleted file space",
    risk: "MEDIUM",
    requiresApproval: true
  });

  // Action 4: Run Disk Cleanup utility
  plan.actions.push({
    type: "DISK_CLEANUP",
    description: "Run Windows Disk Cleanup (Windows Update files, system files)",
    impact: "Additional 2-5 GB space recovery",
    risk: "LOW",
    requiresApproval: false
  });

  // Action 5: Suggest unused app removal
  if (diagnostics.unusedApps.unusedApps.length > 0) {
    plan.actions.push({
      type: "SUGGEST_UNINSTALL",
      description: `${diagnostics.unusedApps.unusedApps.length} unused applications detected`,
      impact: "Optional space recovery",
      apps: diagnostics.unusedApps.unusedApps,
      risk: "MEDIUM",
      requiresApproval: true, // Always confirm before uninstalling
      autoExecute: false // Present as suggestion only
    });
  }

  return plan;
};
```

#### Step 3: Execute Cleanup (with approval)
```javascript
const executeCleanup = async (plan, deviceId, userApprovals) => {
  const results = [];

  for (const action of plan.actions) {
    // Skip if requires approval but not given
    if (action.requiresApproval && !userApprovals[action.type]) {
      results.push({
        action: action.type,
        status: "SKIPPED",
        reason: "User approval not provided"
      });
      continue;
    }

    try {
      switch (action.type) {
        case "CLEANUP_TEMP":
          await executeRemoteCommand(deviceId, [
            // Clean Windows Temp
            "Remove-Item -Path 'C:\\Windows\\Temp\\*' -Recurse -Force -ErrorAction SilentlyContinue",
            // Clean User Temp
            "Remove-Item -Path '$env:TEMP\\*' -Recurse -Force -ErrorAction SilentlyContinue",
            // Clean Browser Cache (Chrome)
            "Remove-Item -Path '$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache\\*' -Recurse -Force -ErrorAction SilentlyContinue",
            // Clean prefetch
            "Remove-Item -Path 'C:\\Windows\\Prefetch\\*' -Force -ErrorAction SilentlyContinue"
          ]);
          results.push({
            action: action.type,
            status: "SUCCESS",
            message: "Temporary files cleaned"
          });
          break;

        case "EMPTY_RECYCLE_BIN":
          await executeRemoteCommand(deviceId, [
            "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"
          ]);
          results.push({
            action: action.type,
            status: "SUCCESS",
            message: "Recycle bin emptied"
          });
          break;

        case "DISK_CLEANUP":
          await executeRemoteCommand(deviceId, [
            "cleanmgr.exe /sagerun:1" // Runs with predefined settings
          ]);
          results.push({
            action: action.type,
            status: "SUCCESS",
            message: "Disk cleanup completed"
          });
          break;

        case "DISABLE_STARTUP":
          for (const program of action.programs) {
            await executeRemoteCommand(deviceId, [
              `Get-CimInstance Win32_StartupCommand | Where-Object {$_.Name -eq '${program}'} | Remove-CimInstance`
            ]);
          }
          results.push({
            action: action.type,
            status: "SUCCESS",
            message: `Disabled ${action.programs.length} startup programs`
          });
          break;
      }
    } catch (error) {
      results.push({
        action: action.type,
        status: "FAILED",
        error: error.message
      });
    }
  }

  return results;
};
```

#### Step 4: Post-Cleanup Verification
```javascript
const verifyCleanup = async (deviceId, priorDiskSpace, priorMemory) => {
  // Wait for cleanup operations to complete
  await sleep(10000);

  // Re-run diagnostics
  const postCleanup = {
    diskSpace: await performanceDiagnostics.checkDiskSpace(),
    memory: await performanceDiagnostics.checkMemoryUsage()
  };

  const improvement = {
    diskSpaceRecoveredGB: postCleanup.diskSpace.drives[0].freeGB - priorDiskSpace,
    memoryFreedMB: (postCleanup.memory.availableGB - priorMemory) * 1024,
    bootTimeImprovement: "Expected 20-30% faster boot" // Based on disabled startup items
  };

  return improvement;
};
```

### Demo Scenarios

#### Scenario 1: Low Disk Space Critical Alert
```
User: "I'm getting a low disk space warning and my laptop is really slow"

AI Agent Response:
┌─────────────────────────────────────────────────────┐
│ 🔍 Running performance diagnostics...               │
│                                                     │
│ ⚠️  CRITICAL: Disk Space Low                        │
│ Drive C: 25 GB free of 512 GB (4.9%)                │
│                                                     │
│ 📊 Performance Issues Detected:                     │
│ • 15.8 GB of temporary files can be removed         │
│ • 3 high-impact startup programs slowing boot       │
│ • Memory usage at 87% (2.1 GB available)            │
│                                                     │
│ 🧹 Recommended Cleanup Plan:                        │
│                                                     │
│ ✓ Clear temp files & cache       → +15.8 GB        │
│ ✓ Empty Recycle Bin               → +2.3 GB        │
│ ✓ Run Disk Cleanup                → +3.5 GB        │
│ ⚠️  Disable startup programs:                       │
│   - Spotify (High impact)                           │
│   - Adobe Creative Cloud (High impact)              │
│   - Skype (Medium impact)                           │
│                                                     │
│ Total space to recover: ~21.6 GB                    │
│ Estimated time: 3 minutes                           │
│                                                     │
│ 🤔 Approve cleanup plan?                            │
│ [✓ Approve All] [⚙️ Customize] [✗ Cancel]           │
└─────────────────────────────────────────────────────┘

[User clicks: Approve All]

┌─────────────────────────────────────────────────────┐
│ 🚀 Executing cleanup...                             │
│                                                     │
│ ✅ Cleared Windows temp files (3.4 GB)              │
│ ✅ Cleared user temp files (2.1 GB)                 │
│ ✅ Cleared browser cache (1.9 GB)                   │
│ ✅ Cleared downloads folder old files (8.4 GB)      │
│ ✅ Emptied Recycle Bin (2.3 GB)                     │
│ ✅ Ran Disk Cleanup (3.7 GB)                        │
│ ✅ Disabled 3 startup programs                      │
│                                                     │
│ 🎉 Cleanup Complete!                                │
│                                                     │
│ 📈 Results:                                         │
│ • Disk space recovered: 21.8 GB                     │
│ • Free space now: 46.8 GB (9.1%)                    │
│ • Boot time improvement: ~25% faster                │
│ • Memory freed: 512 MB                              │
│                                                     │
│ 💡 Recommendation:                                  │
│ Consider uninstalling these unused apps:            │
│ • WinRAR (not used, 4.5 MB)                         │
│ • Java 8 Update 301 (not used, 152 MB)              │
│ • Old VPN Client (last used Jan 2024, 85 MB)        │
│                                                     │
│ Time taken: 2 minutes 47 seconds                    │
└─────────────────────────────────────────────────────┘
```

---

## Use Case 3: Network Connectivity Troubleshooting (VPN, Wi-Fi)

### Problem Statement
Network connectivity issues are among the most common L1 tickets:
- VPN connection failures
- Wi-Fi disconnections/poor signal
- Cannot access internal resources
- Slow network performance
- Certificate/credential issues

### User Journey

#### Current State (Manual L1)
1. User: "VPN not connecting" or "No internet"
2. Agent asks: Error message? When did it start?
3. Agent guides: Restart adapter, reinstall VPN client, check credentials
4. Time: 20-40 minutes
5. High frustration due to remote troubleshooting

#### Target State (AI-Automated)
1. User: "VPN won't connect"
2. AI runs network diagnostics
3. AI identifies issue (e.g., expired certificate)
4. AI fixes automatically
5. Time: 2-4 minutes

### Technical Implementation

#### Step 1: Network Diagnostics
```javascript
const networkDiagnostics = {
  // Check basic connectivity
  checkInternetConnectivity: async () => {
    // Test connection to known endpoints
    const tests = [
      { host: "8.8.8.8", name: "Google DNS", type: "ICMP" },
      { host: "google.com", name: "Google", type: "HTTP" },
      { host: "cloudflare.com", name: "Cloudflare", type: "HTTP" }
    ];

    return {
      hasInternet: true,
      latency: 24, // ms
      failedTests: []
    };
  },

  // Check Wi-Fi connection
  checkWiFiStatus: async () => {
    // Execute: netsh wlan show interfaces
    return {
      connected: true,
      ssid: "Exide-Corporate-5G",
      signal: 85, // percentage
      channel: 36,
      authentication: "WPA2-Enterprise",
      cipher: "CCMP",
      ipAddress: "192.168.100.45",
      gateway: "192.168.100.1",
      dns: ["192.168.100.10", "192.168.100.11"]
    };
  },

  // Check VPN status
  checkVPNStatus: async () => {
    // Execute: Get-VpnConnection
    return {
      configured: true,
      name: "Exide-GlobalProtect",
      status: "Disconnected", // Connected, Disconnected, Connecting
      serverAddress: "vpn.exide.com",
      lastError: "The certificate has expired",
      lastConnected: "2026-02-07 14:23:10",
      clientVersion: "5.2.9",
      protocols: ["IKEv2", "L2TP"]
    };
  },

  // Check DNS resolution
  checkDNSResolution: async () => {
    const testDomains = [
      "exide.com",
      "intranet.exide.local",
      "mail.exide.com"
    ];

    return {
      results: [
        { domain: "exide.com", resolved: true, ip: "203.122.45.67" },
        { domain: "intranet.exide.local", resolved: false, error: "NXDOMAIN" },
        { domain: "mail.exide.com", resolved: true, ip: "203.122.45.69" }
      ],
      dnsServers: ["192.168.100.10", "192.168.100.11"],
      issues: ["Internal domain resolution failing"]
    };
  },

  // Check network adapter status
  checkNetworkAdapters: async () => {
    // Execute: Get-NetAdapter
    return {
      adapters: [
        {
          name: "Wi-Fi",
          status: "Up",
          speed: "866.7 Mbps",
          macAddress: "A4:34:D9:12:34:56"
        },
        {
          name: "Ethernet",
          status: "Disabled",
          speed: "0 Mbps",
          macAddress: "00:1B:44:11:3A:B7"
        },
        {
          name: "VPN - GlobalProtect",
          status: "Disconnected",
          speed: "0 Mbps",
          macAddress: "00:FF:12:34:56:78"
        }
      ]
    };
  },

  // Check firewall rules
  checkFirewall: async () => {
    return {
      firewallEnabled: true,
      vpnAllowed: true,
      blockingRules: []
    };
  },

  // Check proxy settings
  checkProxySettings: async () => {
    return {
      proxyEnabled: true,
      proxyServer: "proxy.exide.com:8080",
      bypassList: ["*.local", "localhost", "127.0.0.1"],
      pacFile: null
    };
  },

  // Trace route to internal resources
  checkInternalAccess: async () => {
    return {
      reachable: false,
      target: "sharepoint.exide.local",
      reason: "VPN not connected",
      requiresVPN: true
    };
  }
};
```

#### Step 2: Root Cause Analysis
```javascript
const analyzeNetworkIssue = async (diagnostics) => {
  const issues = [];

  // Issue 1: VPN Certificate Expired
  if (diagnostics.vpn.status === "Disconnected" &&
      diagnostics.vpn.lastError.includes("certificate")) {
    issues.push({
      type: "VPN_CERT_EXPIRED",
      severity: "HIGH",
      autoFixable: true,
      description: "VPN client certificate has expired",
      solution: "Renew certificate and reconnect"
    });
  }

  // Issue 2: DNS Resolution Failure
  if (diagnostics.dns.issues.length > 0) {
    issues.push({
      type: "DNS_RESOLUTION_FAILED",
      severity: "HIGH",
      autoFixable: true,
      description: "Cannot resolve internal domain names",
      solution: "Reset DNS cache and verify DNS servers"
    });
  }

  // Issue 3: Wi-Fi Signal Weak
  if (diagnostics.wifi.connected && diagnostics.wifi.signal < 50) {
    issues.push({
      type: "WIFI_WEAK_SIGNAL",
      severity: "MEDIUM",
      autoFixable: false,
      description: `Weak Wi-Fi signal: ${diagnostics.wifi.signal}%`,
      suggestion: "Move closer to access point or switch to Ethernet"
    });
  }

  // Issue 4: VPN Client Not Running
  if (!diagnostics.vpn.configured) {
    issues.push({
      type: "VPN_NOT_INSTALLED",
      severity: "HIGH",
      autoFixable: true,
      description: "VPN client not installed or configured",
      solution: "Install and configure VPN client"
    });
  }

  // Issue 5: No Internet Connectivity
  if (!diagnostics.internet.hasInternet) {
    issues.push({
      type: "NO_INTERNET",
      severity: "CRITICAL",
      autoFixable: true,
      description: "No internet connectivity detected",
      solution: "Reset network adapter and check physical connection"
    });
  }

  // Issue 6: Incorrect Proxy Settings
  if (diagnostics.proxy.proxyEnabled && !diagnostics.internet.hasInternet) {
    issues.push({
      type: "PROXY_MISCONFIGURED",
      severity: "HIGH",
      autoFixable: true,
      description: "Proxy settings may be blocking connectivity",
      solution: "Verify or reset proxy configuration"
    });
  }

  return issues;
};
```

#### Step 3: Automated Remediation
```javascript
const remediateNetworkIssue = async (issue, deviceId) => {
  switch (issue.type) {
    case "VPN_CERT_EXPIRED":
      // Renew certificate and reconnect
      await executeRemoteCommand(deviceId, [
        // Stop VPN service
        "Stop-Service -Name 'PanGPS' -Force",
        // Clear old certificates
        "Get-ChildItem Cert:\\CurrentUser\\My | Where-Object {$_.Subject -like '*GlobalProtect*' -and $_.NotAfter -lt (Get-Date)} | Remove-Item",
        // Request new certificate from CA
        "certreq -submit -config 'ca.exide.local\\Exide-CA' C:\\VPNConfig\\vpn-cert-request.req",
        // Import new certificate
        "Import-Certificate -FilePath 'C:\\VPNConfig\\vpn-cert.cer' -CertStoreLocation Cert:\\CurrentUser\\My",
        // Restart VPN service
        "Start-Service -Name 'PanGPS'",
        // Attempt connection
        "Start-Process 'C:\\Program Files\\Palo Alto Networks\\GlobalProtect\\PanGPA.exe' -ArgumentList '-connect'"
      ]);
      return {
        success: true,
        message: "VPN certificate renewed. Attempting connection..."
      };

    case "DNS_RESOLUTION_FAILED":
      // Flush DNS cache and reset
      await executeRemoteCommand(deviceId, [
        "ipconfig /flushdns",
        "ipconfig /registerdns",
        // Reset DNS to corporate servers
        "Set-DnsClientServerAddress -InterfaceAlias 'Wi-Fi' -ServerAddresses ('192.168.100.10','192.168.100.11')"
      ]);
      return {
        success: true,
        message: "DNS cache cleared and servers reset"
      };

    case "NO_INTERNET":
      // Reset network adapter
      await executeRemoteCommand(deviceId, [
        "Disable-NetAdapter -Name 'Wi-Fi' -Confirm:$false",
        "Start-Sleep -Seconds 5",
        "Enable-NetAdapter -Name 'Wi-Fi' -Confirm:$false",
        "ipconfig /release",
        "ipconfig /renew"
      ]);
      return {
        success: true,
        message: "Network adapter reset and IP renewed"
      };

    case "VPN_NOT_INSTALLED":
      // Install VPN client silently
      await executeRemoteCommand(deviceId, [
        "Start-Process 'msiexec.exe' -ArgumentList '/i \\\\fileserver\\Software\\VPN\\GlobalProtect.msi /quiet /norestart' -Wait"
      ]);
      return {
        success: true,
        message: "VPN client installed successfully"
      };

    case "PROXY_MISCONFIGURED":
      // Reset proxy settings to corporate standard
      await executeRemoteCommand(deviceId, [
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 1",
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyServer -Value 'proxy.exide.com:8080'",
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyOverride -Value '*.local;localhost;127.0.0.1'"
      ]);
      return {
        success: true,
        message: "Proxy settings configured to corporate standards"
      };

    case "WIFI_WEAK_SIGNAL":
      // Cannot auto-fix, but can suggest alternatives
      const alternatives = await executeRemoteCommand(deviceId, [
        "netsh wlan show networks mode=bssid"
      ]);
      return {
        success: false,
        message: "Cannot improve Wi-Fi signal automatically",
        suggestions: [
          "Move closer to access point",
          "Switch to Ethernet if available",
          "Connect to alternate network: Exide-Corporate-2.4G"
        ]
      };

    default:
      return {
        success: false,
        message: "Unable to auto-remediate this issue"
      };
  }
};
```

#### Step 4: VPN Connection Verification
```javascript
const verifyVPNConnection = async (deviceId) => {
  // Wait for VPN to establish connection
  let attempts = 0;
  const maxAttempts = 6; // 30 seconds total (5 sec intervals)

  while (attempts < maxAttempts) {
    await sleep(5000);

    const vpnStatus = await networkDiagnostics.checkVPNStatus();

    if (vpnStatus.status === "Connected") {
      // Verify internal resource access
      const internalAccess = await networkDiagnostics.checkInternalAccess();

      return {
        success: true,
        message: "VPN connected successfully",
        details: {
          connectedAt: new Date().toISOString(),
          serverAddress: vpnStatus.serverAddress,
          internalAccessVerified: internalAccess.reachable
        }
      };
    }

    attempts++;
  }

  // If we get here, connection timed out
  const vpnStatus = await networkDiagnostics.checkVPNStatus();
  return {
    success: false,
    message: "VPN connection attempt timed out",
    lastStatus: vpnStatus.status,
    recommendation: "Escalating to network team for manual review"
  };
};
```

### Demo Scenarios

#### Scenario 1: VPN Certificate Expired
```
User: "I can't connect to VPN to access our internal systems"

AI Agent Response:
┌─────────────────────────────────────────────────────┐
│ 🔍 Diagnosing VPN connectivity issue...             │
│                                                     │
│ ✓ Internet connectivity: OK                        │
│ ✓ Wi-Fi connection: OK (85% signal)                │
│ ✓ VPN client installed: Yes (GlobalProtect 5.2.9)  │
│ ✗ VPN status: Disconnected                         │
│                                                     │
│ 🔧 Identified Issue:                                │
│ Error: "The certificate has expired"                │
│                                                     │
│ Your VPN client certificate expired on Feb 3, 2026. │
│ This prevents secure VPN connections.               │
│                                                     │
│ 🚀 Executing automated fix...                       │
│ • Stopping VPN service                             │
│ • Removing expired certificate                     │
│ • Requesting new certificate from CA               │
│ • Installing renewed certificate                   │
│ • Restarting VPN service                           │
│ • Initiating VPN connection                        │
│                                                     │
│ ⏳ Connecting to vpn.exide.com...                   │
│ ✅ VPN Connected Successfully!                       │
│                                                     │
│ 📊 Connection Details:                              │
│ • Server: vpn.exide.com (203.122.45.100)           │
│ • Protocol: IKEv2                                  │
│ • Internal IP: 10.200.45.142                       │
│ • Certificate valid until: Feb 9, 2027             │
│                                                     │
│ ✓ Verified access to internal resources            │
│                                                     │
│ Time taken: 3 minutes 12 seconds                   │
└─────────────────────────────────────────────────────┘
```

#### Scenario 2: Wi-Fi Connected but No Internet
```
User: "Connected to Wi-Fi but can't access anything"

AI Agent Response:
┌─────────────────────────────────────────────────────┐
│ 🔍 Diagnosing network connectivity...               │
│                                                     │
│ ✓ Wi-Fi connected: Exide-Corporate-5G (78%)        │
│ ✗ Internet connectivity: FAILED                    │
│ ✗ DNS resolution: FAILED                           │
│                                                     │
│ 🔧 Identified Issues:                               │
│                                                     │
│ 1. DNS Resolution Failure                          │
│    Cannot resolve domain names (internal/external) │
│                                                     │
│ 2. Possible IP Configuration Issue                 │
│    Current IP: 169.254.12.45 (APIPA/self-assigned) │
│    Expected: 192.168.100.x                         │
│                                                     │
│ 🚀 Executing automated fix...                       │
│ • Flushing DNS cache                               │
│ • Resetting network adapter                        │
│ • Releasing IP address                             │
│ • Requesting new IP from DHCP                      │
│ • Configuring DNS servers                          │
│                                                     │
│ ✅ Fix Complete!                                     │
│                                                     │
│ 📊 Network Status:                                  │
│ ✓ Wi-Fi: Connected (78% signal)                    │
│ ✓ IP Address: 192.168.100.67 (via DHCP)            │
│ ✓ Gateway: 192.168.100.1 (reachable)               │
│ ✓ DNS Servers: 192.168.100.10, 192.168.100.11      │
│ ✓ Internet: Connected (24ms latency)               │
│ ✓ DNS Resolution: Working                          │
│                                                     │
│ 🌐 Test Results:                                    │
│ ✓ google.com - Reachable                           │
│ ✓ exide.com - Reachable                            │
│ ✓ intranet.exide.local - Reachable                 │
│                                                     │
│ Your network is now fully functional.               │
│ Time taken: 1 minute 52 seconds                    │
└─────────────────────────────────────────────────────┘
```

#### Scenario 3: Weak Wi-Fi Signal
```
User: "Internet is very slow and keeps disconnecting"

AI Agent Response:
┌─────────────────────────────────────────────────────┐
│ 🔍 Analyzing network performance...                 │
│                                                     │
│ ⚠️  Wi-Fi Signal Strength: 38% (WEAK)               │
│ Network: Exide-Corporate-5G                         │
│ Current location: Building B, Floor 3               │
│                                                     │
│ 📊 Network Analysis:                                │
│ • Latency: 124ms (should be <50ms)                 │
│ • Packet loss: 8% (high)                           │
│ • Connection drops: 3 in last 10 minutes           │
│                                                     │
│ 🔧 Recommendations:                                 │
│                                                     │
│ 1. ✓ Move closer to access point                   │
│    Nearest AP: Floor3-AP-East (15m away)           │
│                                                     │
│ 2. ✓ Switch to 2.4GHz network                      │
│    Exide-Corporate-2.4G available (better range)   │
│    Signal: 68% (GOOD)                              │
│                                                     │
│ 3. ✓ Use Ethernet connection                       │
│    Ethernet port detected on your device           │
│    Desk ports available in your area               │
│                                                     │
│ 🤔 Would you like me to:                            │
│ [A] Switch you to 2.4GHz network automatically     │
│ [B] Create ticket for network team to check AP     │
│ [C] Show me a Wi-Fi coverage map                   │
└─────────────────────────────────────────────────────┘

[User selects: A]

┌─────────────────────────────────────────────────────┐
│ 🔄 Switching to Exide-Corporate-2.4G...             │
│                                                     │
│ ✅ Connected to Exide-Corporate-2.4G                 │
│                                                     │
│ 📊 New Network Status:                              │
│ ✓ Signal Strength: 68% (GOOD)                      │
│ ✓ Latency: 32ms (excellent)                        │
│ ✓ Packet loss: 0%                                  │
│ ✓ Connection: Stable                               │
│                                                     │
│ Your connection should now be much more reliable.   │
│ Note: 2.4GHz has better range but lower max speed. │
└─────────────────────────────────────────────────────┘
```

---

## Integration Architecture

### Remote Execution Engine
For all three use cases, you need a **device agent** or **remote management capability**:

```javascript
// Option 1: Custom Agent (installed on each device)
const deviceAgent = {
  // Agent runs on user's machine with elevated privileges
  executeCommand: async (command) => {
    // Execute PowerShell/Command Prompt commands
    // Return output and exit code
  },

  getSystemInfo: async () => {
    // Return OS, version, hostname, IP, etc.
  }
};

// Option 2: Integration with ManageEngine Desktop Central
const manageEngineAPI = {
  // Use ManageEngine's API to execute remote scripts
  executeScript: async (deviceId, scriptPath, params) => {
    const response = await fetch(`https://desktopcentral.exide.com/api/scripts/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ME_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceId,
        scriptPath,
        parameters: params,
        async: false // Wait for completion
      })
    });
    return response.json();
  },

  // Get device information
  getDeviceInfo: async (deviceId) => {
    const response = await fetch(`https://desktopcentral.exide.com/api/devices/${deviceId}`);
    return response.json();
  },

  // Get installed software
  getInstalledSoftware: async (deviceId) => {
    const response = await fetch(`https://desktopcentral.exide.com/api/devices/${deviceId}/software`);
    return response.json();
  }
};

// Option 3: Integration with Microsoft Endpoint Manager (Intune)
const intuneAPI = {
  // Execute PowerShell script via Intune
  runRemoteAction: async (deviceId, scriptContent) => {
    const response = await fetch(`https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/${deviceId}/runScript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AZURE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scriptContent: Buffer.from(scriptContent).toString('base64')
      })
    });
    return response.json();
  }
};
```

### AI Orchestration Layer
```javascript
// Main AI Agent that orchestrates diagnosis and remediation
class L1AutomationAgent {
  constructor(llmProvider, remoteExecutor) {
    this.llm = llmProvider; // Claude, GPT-4, etc.
    this.executor = remoteExecutor; // Device agent or API
  }

  async handleTicket(ticket) {
    // Step 1: Understand the issue using LLM
    const issueAnalysis = await this.llm.analyzeIssue(ticket.description);

    // Step 2: Route to appropriate diagnostic flow
    let diagnostics;
    switch (issueAnalysis.category) {
      case 'PRINTER':
        diagnostics = await printerDiagnostics.runAll(ticket.deviceId);
        break;
      case 'PERFORMANCE':
        diagnostics = await performanceDiagnostics.runAll(ticket.deviceId);
        break;
      case 'NETWORK':
        diagnostics = await networkDiagnostics.runAll(ticket.deviceId);
        break;
    }

    // Step 3: Identify root causes
    const issues = await this.analyzeIssues(diagnostics, issueAnalysis.category);

    // Step 4: Generate remediation plan
    const plan = await this.generateRemediationPlan(issues);

    // Step 5: Get user approval if needed
    if (plan.requiresApproval) {
      const approval = await this.requestUserApproval(plan, ticket.userId);
      if (!approval) {
        return { status: 'APPROVAL_DENIED', plan };
      }
    }

    // Step 6: Execute remediation
    const results = await this.executeRemediation(plan, ticket.deviceId);

    // Step 7: Verify fix
    const verification = await this.verifyFix(diagnostics, ticket.deviceId);

    // Step 8: Update ticket and notify user
    await this.updateTicket(ticket.id, results, verification);

    return {
      status: verification.success ? 'RESOLVED' : 'ESCALATED',
      results,
      verification
    };
  }
}
```

---

## Demo Flow Recommendation

### For Exide Demo (Wednesday Session)

**Duration**: 40 minutes

**Structure**:
1. **Introduction** (5 min)
   - Quick recap of their requirements
   - Demo objectives

2. **Live Demo - Printer Issue** (10 min)
   - Show real-time diagnostics
   - Automated remediation
   - Verification

3. **Live Demo - Performance Cleanup** (10 min)
   - System scan
   - User approval flow
   - Before/after comparison

4. **Live Demo - VPN Issue** (10 min)
   - Certificate expiry scenario
   - Automated renewal
   - Connection verification

5. **Q&A + Technical Discussion** (5 min)
   - Integration with ManageEngine
   - Security & permissions
   - Rollout approach

### Key Messages
- ✅ **Executes fixes**, not instructions
- ✅ **Device-level automation** with proper security
- ✅ **Reduces L1 ticket volume** by 60-70%
- ✅ **Integrates with existing tools** (ManageEngine)
- ✅ **Starts simple**, scales to complex scenarios

---

## Next Steps for Implementation

1. **Proof of Concept Scope**
   - Select 2-3 most common ticket types from Exide's data
   - Build working demos for those scenarios
   - Test with 10-20 pilot users

2. **Integration Requirements**
   - ManageEngine API access
   - Device agent deployment (if needed)
   - Active Directory integration
   - Security approvals for remote execution

3. **Success Metrics**
   - L1 ticket reduction %
   - Average resolution time
   - User satisfaction scores
   - Escalation rate reduction

---

## Technical Questions for Exide

Before building the POC, we need to clarify:

1. **Remote Execution Method**:
   - Does ManageEngine Desktop Central have remote script execution capabilities?
   - Do you use any endpoint management tools (Intune, SCCM)?
   - Are you open to deploying a lightweight agent on endpoints?

2. **Security & Permissions**:
   - What permissions are required for automated fixes?
   - Do you have service accounts for automation?
   - What approval workflows exist for system changes?

3. **Infrastructure**:
   - VPN solution in use? (GlobalProtect, Cisco AnyConnect, etc.)
   - Printer setup: Network vs local? Print server?
   - Common software/applications in use?

4. **Metrics & Baselines**:
   - Current average ticket resolution time?
   - Most common ticket categories?
   - Current ticket volume (tickets/day)?

Would you like me to:
1. Build working prototypes for any of these scenarios?
2. Create a technical integration document for ManageEngine?
3. Prepare demo scripts and test data?
