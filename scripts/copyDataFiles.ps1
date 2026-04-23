# ============================================================
# BioBalance - Copy Data Files Script
# ============================================================
# 
# This script copies the nutrition data files from Downloads
# to the project's data folder.
#
# Usage: .\scripts\copyDataFiles.ps1
# ============================================================

Write-Host "🥗 BioBalance Data Copy Script" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DataDir = Join-Path $ProjectDir "data"

# Create data directory if it doesn't exist
if (!(Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    Write-Host "📁 Created data directory" -ForegroundColor Yellow
}

# Source paths
$Downloads = "$env:USERPROFILE\Downloads"
$MOH_Source = Join-Path $Downloads "moh_mitzrachim.csv"
$USDA_Food_Source = Join-Path $Downloads "FoodData_Central_foundation_food_csv_2025-12-18\food.csv"
$USDA_Nutrient_Source = Join-Path $Downloads "FoodData_Central_foundation_food_csv_2025-12-18\food_nutrient.csv"

# Destination paths
$MOH_Dest = Join-Path $DataDir "moh_mitzrachim.csv"
$USDA_Food_Dest = Join-Path $DataDir "usda_food.csv"
$USDA_Nutrient_Dest = Join-Path $DataDir "usda_food_nutrient.csv"

# Copy files
$files = @(
    @{ Source = $MOH_Source; Dest = $MOH_Dest; Name = "Israeli MOH Data" },
    @{ Source = $USDA_Food_Source; Dest = $USDA_Food_Dest; Name = "USDA Food Data" },
    @{ Source = $USDA_Nutrient_Source; Dest = $USDA_Nutrient_Dest; Name = "USDA Nutrient Data" }
)

foreach ($file in $files) {
    if (Test-Path $file.Source) {
        Copy-Item -Path $file.Source -Destination $file.Dest -Force
        $size = (Get-Item $file.Dest).Length / 1MB
        Write-Host "✅ $($file.Name): $([math]::Round($size, 2)) MB" -ForegroundColor Green
    } else {
        Write-Host "❌ $($file.Name): File not found" -ForegroundColor Red
        Write-Host "   Expected: $($file.Source)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "📊 Data files location: $DataDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set up Supabase environment variables"
Write-Host "2. Run the SQL schema in Supabase"
Write-Host "3. Run: node scripts/seedNutritionData.js"




