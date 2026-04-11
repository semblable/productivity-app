Set WshShell = CreateObject("WScript.Shell")
scriptPath = WScript.ScriptFullName
Set fso = CreateObject("Scripting.FileSystemObject")
scriptFolder = fso.GetParentFolderName(scriptPath)
batPath = scriptFolder & "\startup-launcher.bat"
WshShell.Run chr(34) & batPath & chr(34), 0
Set WshShell = Nothing
