@echo off
title Iniciando Servidor Dental 3D
echo ==========================================
echo    INICIANDO SERVIDOR DENTAL 3D
echo ==========================================
echo.
echo Acessando pasta do projeto...
cd /d "c:\Users\Agnaldo\OneDrive\Área de Trabalho\sistema-aistudio-main\sistema-aistudio-main"
echo.
echo Verificando gerenciadores de pacotes instalados...

where bun >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Bun detectado! Iniciando servidor de desenvolvimento...
    echo.
    bun dev
) else (
    where npm >nul 2>nul
    if %errorlevel% equ 0 (
        echo [OK] Node.js/NPM detectado! Iniciando servidor de desenvolvimento...
        echo.
        npm run dev
    ) else (
        echo.
        echo [ERRO] Nao foi possivel encontrar o 'bun' ou 'npm' (Node.js) instalado em sua maquina.
        echo Por favor, certifique-se de que o Node.js ou Bun estao instalados e configurados no PATH.
        echo.
        pause
    )
)
