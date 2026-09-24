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

# sharedStrings
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

# Convertir a tabla de celdas por columna (A, B, C, ...)
$rowsOut = @()
foreach ($r in $sheetXml.worksheet.sheetData.row) {
    $cells = @{}
    foreach ($c in $r.c) {
        $col = ($c.r -replace '\d', '')   # letra(s) de columna
        $val = $c.v
        if ($c.t -eq "s" -and $val -ne $null) { $val = $shared[[int]$val] }
        $cells[$col] = $val
    }
    $rowsOut += ,@{ row = [int]$r.r; cells = $cells }
}

Write-Output "=== Todas las filas de PRO.FREJOL (columnas B,C,D,E,F,G,H,I,J,K) ==="
foreach ($ro in $rowsOut) {
    $c = $ro.cells
    Write-Output ("F" + $ro.row + " | NOMBRE(B)=" + $c['B'] + " | MARCA(D)=" + $c['D'] + " | LOTE(E)=" + $c['E'] + " | UND(H)=" + $c['H'] + " | CANT(I)=" + $c['I'] + " | TOTAL(K)=" + $c['K'])
}
