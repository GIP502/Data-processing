Option Explicit

Dim files, shell, root, scriptPath, powershellPath, command, result, failure
Set files = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = files.GetParentFolderName(WScript.ScriptFullName)
scriptPath = files.BuildPath(root, "launcher\launch.ps1")
powershellPath = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")

If Not files.FileExists(scriptPath) Then
    MsgBox "Extract the entire ZIP before running START-WINDOW.vbs.", vbCritical, "Window Starter"
    WScript.Quit 1
End If

If Not files.FileExists(powershellPath) Then
    MsgBox "Windows PowerShell was not found.", vbCritical, "Window Starter"
    WScript.Quit 1
End If

' WScript is a GUI host; style 0 hides the child console from creation.
' Run PowerShell directly, without opening cmd.exe.
command = Quote(powershellPath) & " -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Quote(scriptPath)
On Error Resume Next
result = shell.Run(command, 0, True)
failure = Err.Description
If Err.Number <> 0 Then
    On Error GoTo 0
    MsgBox failure, vbCritical, "Window Starter"
    WScript.Quit 1
End If
On Error GoTo 0
WScript.Quit result

Function Quote(value)
    Quote = Chr(34) & value & Chr(34)
End Function

