param(
    [Parameter(Mandatory=$true)][int]$targetPid,
    [Parameter(Mandatory=$true)][ValidateSet("suspend","resume","kill")][string]$action
)

$def = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class WinProcControl {
    [DllImport("ntdll.dll")]
    public static extern uint NtSuspendProcess(IntPtr h);
    [DllImport("ntdll.dll")]
    public static extern uint NtResumeProcess(IntPtr h);
    public static void Suspend(int p) { 
        using (Process proc = Process.GetProcessById(p)) {
            NtSuspendProcess(proc.Handle); 
        }
    }
    public static void Resume(int p) { 
        using (Process proc = Process.GetProcessById(p)) {
            NtResumeProcess(proc.Handle); 
        }
    }
}
"@

Add-Type -TypeDefinition $def -ErrorAction SilentlyContinue

try {
    if ($action -eq "suspend") {
        [WinProcControl]::Suspend($targetPid)
        Write-Output "SUSPENDED"
    } elseif ($action -eq "resume") {
        [WinProcControl]::Resume($targetPid)
        Write-Output "RESUMED"
    } elseif ($action -eq "kill") {
        Stop-Process -Id $targetPid -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output "KILLED"
    }
} catch {
    Write-Error $_.Exception.Message
}
