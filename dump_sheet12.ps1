Set-Location "c:\Users\usuario1\Desktop\inventrio de del proyecto de analisi de alimentos"
$xlsx = Get-ChildItem -Filter *.xlsx | Select-Object -First 1
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($xlsx.FullName)

function GetEntry($name) {
    $e = $zip.Entries | Where-Object { $_.FullName -eq $name }
    $sr = New-Object System.IO.StreamReader($e.Open())
    $t = $sr.ReadToEnd()
    $sr.Close()
    return $t
}

# Cargar sharedStrings
$shared = @()
if ($zip.Entries | Where-Object { $_.FullName -eq "xl/sharedStrings.xml" }) {
    $ssXml = [xml](GetEntry "xl/sharedStrings.xml")
    foreach ($si in $ssXml.sst.si) {
        $txt = ""
        if ($si.t -is [string]) { $txt = $si.t }
        elseif ($si.t.'#text') { $txt = $si.t.'#text' }
        elseif ($si.r) { foreach ($run in $si.r) { $txt += $run.t } }
        $shared += $txt
    }
}

$sheetXml = [xml](GetEntry "xl/worksheets/sheet12.xml")
$zip.Dispose()

$rows = $sheetXml.worksheet.sheetData.row
Write-Output ("Total filas: " + @($rows).Count)
$i = 0
foreach ($r in $rows) {
    $i++
    if ($i -le 14) {
        $cells = @()
        foreach ($c in $r.c) {
            $val = $c.v
            if ($c.t -eq "s" -and $val -ne $null) { $val = $shared[[int]$val] }
            $cells += ($c.r + "=" + $val)
        }
        Write-Output ("F" + $r.r + ": " + ($cells -join " | "))
    }
}
