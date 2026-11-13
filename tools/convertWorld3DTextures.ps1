Add-Type -AssemblyName System.Drawing

$outDir = "e:\qianproject\arc-map\public\game-maps\world-3d"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Convert-PngToJpg($srcPath, $dstPath, [long]$quality = 92, [int]$maxDim = 4096) {
  if (-not (Test-Path $srcPath)) {
    Write-Host "SKIP missing: $srcPath"
    return
  }
  $bmp = [System.Drawing.Bitmap]::new($srcPath)
  $w = $bmp.Width
  $h = $bmp.Height
  if ($w -gt $maxDim -or $h -gt $maxDim) {
    $scale = $maxDim / [Math]::Max($w, $h)
    $w = [int]($w * $scale)
    $h = [int]($h * $scale)
  }
  $target = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($target)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $g.Dispose()
  $bmp.Dispose()

  $ep = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $ep.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, $quality)
  $target.Save($dstPath, $jpgCodec, $ep)
  $target.Dispose()
  $sizeKB = [Math]::Round((Get-Item $dstPath).Length / 1024, 1)
  Write-Host "Saved $dstPath ($($w)x$($h), $sizeKB KB)"
}

$feDir = "F:\arc-export\frontend-map\PioneerGame\Content\Pioneer\Environment\Props\FrontEnd\FrontEndMap_01"
$postDir = "F:\arc-export\frontend-map\PioneerGame\Content\Pioneer\Environment\Props\FrontEnd\PostIts_01"

Convert-PngToJpg "$feDir\T_FrontEndMap_01_N.png" "$outDir\T_FrontEndMap_01_N.jpg" 92 4096
Convert-PngToJpg "$feDir\T_FrontEndMap_Frame_01_CR.png" "$outDir\T_FrontEndMap_Frame_01_CR.jpg" 90 2048
Convert-PngToJpg "$feDir\T_FrontEndMap_Frame_01_N.png" "$outDir\T_FrontEndMap_Frame_01_N.jpg" 90 2048
Convert-PngToJpg "$postDir\T_PostIt_01_C.png" "$outDir\T_PostIt_01_C.jpg" 90 1024

Copy-Item "$feDir\SM_FrontEndMap_01.glb" "$outDir\SM_FrontEndMap_01.glb" -Force
Copy-Item "$feDir\SM_LightTrail_01.glb" "$outDir\SM_LightTrail_01.glb" -Force
Copy-Item "$feDir\SM_MapRoomWalls_A.glb" "$outDir\SM_MapRoomWalls_A.glb" -Force
Copy-Item "$postDir\SM_TheWall_Postits_01_A.glb" "$outDir\SM_TheWall_Postits_01_A.glb" -Force

Write-Host "All 3D World Map assets copied to $outDir"
