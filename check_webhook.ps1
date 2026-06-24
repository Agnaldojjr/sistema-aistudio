$url = "https://dragnaldoferreira.netlify.app/api/webhook"
while ($true) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -ErrorAction Stop
        Write-Host "Success!"
        break
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -ne 404) {
            Write-Host "Live with status $statusCode"
            break
        }
        Write-Host "Still 404, waiting..."
    }
    Start-Sleep -Seconds 5
}
